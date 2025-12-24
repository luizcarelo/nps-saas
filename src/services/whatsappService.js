// ============================================
// NPS MANAGER V5 - WHATSAPP SERVICE (MULTI-TENANT)
// ============================================

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    delay, 
    jidDecode,
    jidNormalizedUser
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

// ============================================
// CONFIGURAÇÕES
// ============================================

const BASE_AUTH_PATH = path.resolve(__dirname, '../../auth_info_baileys');
const CONFIG = {
    minDelay: parseInt(process.env.WA_MIN_DELAY) || 3000,
    maxDelay: parseInt(process.env.WA_MAX_DELAY) || 8000,
    batchSize: parseInt(process.env.WA_BATCH_SIZE) || 15,
    batchCooldown: parseInt(process.env.WA_BATCH_COOLDOWN) || 45000,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10 // Aumentado para tolerância
};

// ============================================
// ESTADO
// ============================================

const sessions = new Map();
const conversationStates = new Map();
const lidToPhoneMap = new Map(); // Mapeia LID -> número real

let eventEmitter = null;
let messageHandler = null;
let pollHandler = null;

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

const smartDelay = (min = CONFIG.minDelay, max = CONFIG.maxDelay) => {
    const time = Math.floor(Math.random() * (max - min + 1) + min);
    return new Promise(r => setTimeout(r, time));
};

// Verifica se é um LID (Linked ID) do WhatsApp Business
// LIDs são identificadores internos que não correspondem a números de telefone reais
const isLID = (phone) => {
    if (!phone) return false;
    const clean = phone.replace(/\D/g, '');
    
    // LIDs têm características específicas:
    // 1. Geralmente têm mais de 14 dígitos
    // 2. Começam com padrões como 6469, 5629, etc (não são códigos de país válidos)
    // 3. Números brasileiros válidos: 55 + DDD(2) + número(8-9) = 12-13 dígitos
    
    // Se tem mais de 14 dígitos, provavelmente é LID
    if (clean.length > 14) return true;
    
    // Padrões conhecidos de LID
    const lidPrefixes = ['6469', '5629', '6529', '5649', '4629', '4569', '5469', '6549'];
    for (const prefix of lidPrefixes) {
        if (clean.startsWith(prefix)) return true;
    }
    
    // Se não começa com 55 (Brasil) e tem mais de 11 dígitos, pode ser LID
    if (!clean.startsWith('55') && clean.length > 11) {
        // Verifica se não é um número internacional válido
        // Números válidos geralmente começam com código de país (1-3 dígitos)
        const firstDigits = clean.substring(0, 2);
        // Se os primeiros dígitos não parecem código de país comum
        if (!['1', '7', '20', '27', '30', '31', '32', '33', '34', '39', '44', '49', '51', '52', '54', '56', '57', '58'].some(c => clean.startsWith(c))) {
            return true;
        }
    }
    
    return false;
};

// Mapeia LID para número real
const mapLidToPhone = (lid, realPhone) => {
    if (lid && realPhone) {
        const cleanLid = lid.replace(/\D/g, '');
        const cleanPhone = realPhone.replace(/\D/g, '');
        lidToPhoneMap.set(cleanLid, cleanPhone);
        console.log(`🔗 [LID Map] ${cleanLid} -> ${cleanPhone}`);
    }
};

// Resolve LID para número real se existir mapeamento
const resolvePhone = (phone) => {
    if (!phone) return phone;
    const clean = phone.replace(/\D/g, '');
    
    // Se temos mapeamento, retorna o número real
    if (lidToPhoneMap.has(clean)) {
        return lidToPhoneMap.get(clean);
    }
    
    return clean;
};

const formatPhone = (phone) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length === 11 && clean.startsWith('9')) return `55${clean}`;
    if (clean.length === 10 || clean.length === 11) return `55${clean}`;
    return clean;
};

const isValidPhone = (phone) => {
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 10 && clean.length <= 15;
};

// Store Local para mensagens (Essencial para Reply/Polls)
const makeSimpleStore = () => {
    return {
        messages: {},
        bind(ev) {
            ev.on('messages.upsert', (m) => {
                for (const msg of m.messages) {
                    if (msg.key && msg.key.id) {
                        this.messages[msg.key.id] = msg;
                    }
                }
            });
        },
        loadMessage: async (key) => {
            return this.messages[key.id] || undefined;
        }
    };
};

// --- GERENCIAMENTO DE ESTADO DA CONVERSA ---

function setConversationContext(tenantId, phone, context) {
    const cleanPhone = formatPhone(phone);
    const key = `${tenantId}:${cleanPhone}`;
    const current = conversationStates.get(key) || {};
    conversationStates.set(key, { ...current, ...context, updatedAt: Date.now() });
    // console.log(`💾 [State] Definido para ${cleanPhone}: ${context.stage}`);
}

function getConversationContext(tenantId, phone) {
    const cleanPhone = formatPhone(phone);
    const key = `${tenantId}:${cleanPhone}`;
    return conversationStates.get(key);
}

function clearConversationContext(tenantId, phone) {
    const cleanPhone = formatPhone(phone);
    const key = `${tenantId}:${cleanPhone}`;
    conversationStates.delete(key);
}

// ============================================
// GERENCIAMENTO DE SESSÃO
// ============================================

function getSession(tenantId) {
    return sessions.get(tenantId) || { status: 'DISCONNECTED', retries: 0 };
}

function updateSession(tenantId, data) {
    const current = sessions.get(tenantId) || { retries: 0 };
    
    if (current.connectedNumber && !data.connectedNumber && data.status === 'CONNECTED') {
        data.connectedNumber = current.connectedNumber;
    }
    if (current.store && !data.store) {
        data.store = current.store;
    }

    sessions.set(tenantId, { ...current, ...data });
    
    if (eventEmitter) {
        eventEmitter.emit('whatsapp:status', { tenantId, status: getStatus(tenantId) });
    }
}

// ============================================
// CONEXÃO PRINCIPAL
// ============================================

async function connectToWhatsApp(tenantId, emitter = null) {
    if (emitter) eventEmitter = emitter;
    
    const session = getSession(tenantId);
    if (session.status === 'CONNECTING' || session.status === 'CONNECTED') {
        updateSession(tenantId, {}); // Force update UI
        return;
    }

    console.log(`🔄 [WhatsApp] Inicializando serviço para Tenant: ${tenantId}`);
    updateSession(tenantId, { status: 'CONNECTING' });

    try {
        const authPath = path.join(BASE_AUTH_PATH, tenantId);
        if (!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(authPath);
        const store = makeSimpleStore();

        const sock = makeWASocket({
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            auth: state,
            browser: ['NPS Manager', 'Chrome', '120.0.0'],
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 15000,
            generateHighQualityLinkPreview: true,
            markOnlineOnConnect: false,
            getMessage: async (key) => {
                const msg = await store.loadMessage(key);
                return msg?.message || undefined;
            }
        });

        store.bind(sock.ev);
        updateSession(tenantId, { sock, store });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                try {
                    const qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 256, margin: 2, color: { dark: '#1f2937', light: '#ffffff' } });
                    updateSession(tenantId, { status: 'WAITING_QR', qr, qrDataUrl: qrCodeDataUrl, connectedNumber: null });
                    console.log(`📱 [WhatsApp] QR Code aguardando leitura para Tenant: ${tenantId}`);
                } catch (e) { console.error(`Erro QR Code:`, e); }
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log(`❌ [WhatsApp] Conexão fechada (${tenantId}). Código: ${statusCode}`);
                
                if (shouldReconnect) {
                    updateSession(tenantId, { status: 'RECONNECTING', sock: null, retries: getSession(tenantId).retries + 1 });
                    setTimeout(() => connectToWhatsApp(tenantId, eventEmitter), CONFIG.reconnectInterval);
                } else {
                    if (statusCode === DisconnectReason.loggedOut) await clearSession(tenantId);
                    else updateSession(tenantId, { status: 'DISCONNECTED', sock: null });
                }
            } else if (connection === 'open') {
                let connectedNumber = getSession(tenantId).connectedNumber;
                if (!connectedNumber && sock.user?.id) {
                    const decoded = jidDecode(sock.user.id);
                    connectedNumber = decoded?.user;
                }
                console.log(`✅ [WhatsApp] Tenant ${tenantId} CONECTADO! Número: ${connectedNumber}`);
                updateSession(tenantId, { status: 'CONNECTED', qr: null, qrDataUrl: null, retries: 0, connectedNumber });
            }
        });

        // Handlers de Mensagem
        sock.ev.on('messages.upsert', async (m) => {
            try {
                const msg = m.messages[0];
                if (!msg?.key?.fromMe && m.type === 'notify' && msg.message) {
                    if (msg.message.pollUpdateMessage) return; // Ignora polls aqui
                    
                    const remoteJid = msg.key.remoteJid;
                    const decoded = jidDecode(remoteJid);
                    let phone = decoded?.user;
                    
                    // Tenta extrair o número real do participante (para grupos ou LID)
                    const participant = msg.key.participant;
                    if (participant) {
                        const participantDecoded = jidDecode(participant);
                        if (participantDecoded?.user) {
                            phone = participantDecoded.user;
                        }
                    }
                    
                    // Verifica se há número real no pushName ou no campo verifiedBizName
                    // O WhatsApp às vezes inclui o número real em outros campos
                    const pushName = msg.pushName || '';
                    
                    // Se o phone parece ser um LID (muito longo ou formato estranho)
                    // tenta usar o remoteJid direto se parecer um número
                    if (phone && phone.length > 15) {
                        // Provavelmente é um LID, loga para debug
                        console.log(`📱 [WA] Recebido LID: ${phone} | PushName: ${pushName}`);
                        
                        // Tenta extrair número do remoteJid se não for LID format
                        const jidParts = remoteJid.split('@')[0];
                        if (jidParts && jidParts.length <= 15 && /^\d+$/.test(jidParts)) {
                            phone = jidParts;
                        }
                    }
                    
                    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                    
                    console.log(`📥 [WA Raw] From: ${phone} | JID: ${remoteJid} | Text: "${text?.substring(0, 50)}"`);
                    
                    if (text && phone && messageHandler) {
                        await messageHandler(phone, text, msg, tenantId);
                    }
                }
            } catch (e) { console.error(`Erro msg:`, e.message); }
        });

        // Handlers de Poll (Botões)
        sock.ev.on('messages.update', async (updates) => {
            for (const update of updates) {
                if (update.update.pollUpdates) {
                    const pollUpdates = update.update.pollUpdates;
                    for (const pollUpdate of pollUpdates) {
                        if (pollUpdate.vote && pollUpdate.vote.selectedOptions.length > 0) {
                            const msgId = update.key.id;
                            const voterJid = update.key.remoteJid;
                            const selectedOption = pollUpdate.vote.selectedOptions[0];
                            if (pollHandler) await pollHandler({ msgId, voterJid, selectedOption, tenantId });
                        }
                    }
                }
            }
        });

    } catch (error) {
        console.error(`Erro init:`, error);
        updateSession(tenantId, { status: 'DISCONNECTED' });
    }
}

// ============================================
// LÓGICA DE RESILIÊNCIA (RETRY)
// ============================================

// Aguarda conexão ativa por até 10 segundos
const waitForConnection = async (tenantId, maxAttempts = 10) => {
    for (let i = 0; i < maxAttempts; i++) {
        const session = getSession(tenantId);
        if (session.status === 'CONNECTED' && session.sock) {
            return true;
        }
        await delay(1000); // Espera 1s
    }
    return false;
};

// ============================================
// ENVIO
// ============================================

async function sendMessage(tenantId, phone, text) {
    let session = getSession(tenantId);

    // Se não estiver conectado, tenta esperar reconexão (ex: erro 515 recuperando)
    if (!session.sock || session.status !== 'CONNECTED') {
        console.log(`⚠️ [WhatsApp] Aguardando conexão para enviar mensagem...`);
        const connected = await waitForConnection(tenantId);
        if (!connected) return { success: false, error: 'NOT_CONNECTED' };
        session = getSession(tenantId); // Atualiza referência
    }
    
    if (!isValidPhone(phone)) return { success: false, error: 'INVALID_PHONE' };

    const formattedPhone = formatPhone(phone);
    const jid = `${formattedPhone}@s.whatsapp.net`;

    try {
        await session.sock.sendPresenceUpdate('composing', jid);
        await delay(600);
        const result = await session.sock.sendMessage(jid, { text });
        await session.sock.sendPresenceUpdate('paused', jid);
        
        return { success: true, messageId: result.key.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function sendPoll(tenantId, phone, question, optionsArray) {
    let session = getSession(tenantId);

    if (!session.sock || session.status !== 'CONNECTED') {
        console.log(`⚠️ [WhatsApp] Aguardando conexão para enviar enquete...`);
        const connected = await waitForConnection(tenantId);
        if (!connected) return { success: false, error: 'NOT_CONNECTED' };
        session = getSession(tenantId);
    }

    const formattedPhone = formatPhone(phone);
    const jid = `${formattedPhone}@s.whatsapp.net`;

    try {
        await session.sock.sendPresenceUpdate('composing', jid);
        await delay(500);

        const result = await session.sock.sendMessage(jid, {
            poll: { name: question, values: optionsArray, selectableCount: 1 }
        });

        await session.sock.sendPresenceUpdate('paused', jid);
        return { success: true, messageId: result.key.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function getStatus(tenantId) {
    const s = getSession(tenantId);
    return {
        status: s.status,
        qr: s.qrDataUrl,
        isConnected: s.status === 'CONNECTED',
        connectedNumber: s.connectedNumber,
        tenantId
    };
}

async function logout(tenantId) {
    const session = getSession(tenantId);
    try {
        if (session.sock) await session.sock.logout();
        await clearSession(tenantId);
        return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
}

async function clearSession(tenantId) {
    const authPath = path.join(BASE_AUTH_PATH, tenantId);
    if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });
    sessions.delete(tenantId);
    updateSession(tenantId, { status: 'DISCONNECTED', connectedNumber: null });
}

function setMessageHandler(handler) { messageHandler = handler; }
function setPollHandler(handler) { pollHandler = handler; }

async function restoreSessions(tenantIds, emitter) {
    eventEmitter = emitter;
    for (const id of tenantIds) {
        const authPath = path.join(BASE_AUTH_PATH, id);
        if (fs.existsSync(authPath)) {
            connectToWhatsApp(id, emitter);
            await delay(2000);
        }
    }
}

module.exports = { 
    connectToWhatsApp, 
    sendMessage, 
    sendPoll, 
    getStatus, 
    logout, 
    setMessageHandler, 
    setPollHandler, 
    restoreSessions, 
    isValidPhone,
    setConversationContext,
    getConversationContext,
    clearConversationContext,
    // Funções de LID
    isLID,
    mapLidToPhone,
    resolvePhone
};