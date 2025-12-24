// ============================================
// NPS MANAGER V5 - SERVIDOR PRINCIPAL (CORREÇÃO DASHBOARD)
// ============================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { EventEmitter } = require('events');
const { PrismaClient } = require('@prisma/client');

// Serviços
const whatsappService = require('./services/whatsappService');
const emailService = require('./services/emailService');

// ============================================
// CONFIGURAÇÕES
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'nps_manager_v5_secret_key_change_in_production';
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || `http://localhost:${PORT}`;

const eventBus = new EventEmitter();

// Configuração do Upload (CSV)
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv') || file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos CSV são permitidos'));
        }
    }
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingTimeout: 60000,
    pingInterval: 25000
});

const prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

// ============================================
// MIDDLEWARES
// ============================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // Aumentado para evitar bloqueio em dev/dashboard intenso
    message: { error: "Muitas requisições. Tente novamente em alguns minutos." }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 tentativas de login
    message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." }
});

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../public')));

if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// ============================================
// ROTAS SUPERADMIN
// ============================================
const superadminRoutes = require('./routes/superadmin');
app.use('/api/superadmin', superadminRoutes);

// Views do SuperAdmin
app.get('/superadmin', (req, res) => {
    res.render('superadmin/login');
});

app.get('/superadmin/dashboard', (req, res) => {
    res.render('superadmin/dashboard');
});

app.get('/superadmin/tenants', (req, res) => {
    res.render('superadmin/tenants');
});

app.get('/superadmin/tenants/new', (req, res) => {
    res.render('superadmin/tenants');
});

app.get('/superadmin/plans', (req, res) => {
    res.render('superadmin/plans');
});

app.get('/superadmin/reports', (req, res) => {
    res.render('superadmin/dashboard'); // Temporário - usar dashboard
});

// ============================================
// AUTENTICAÇÃO E SOCKET
// ============================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1];

    if (!token) return res.status(401).json({ error: "Token não fornecido." });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Token inválido." });
        req.user = decoded;
        next();
    });
};

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error("Token necessário"));

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error("Token inválido"));
        socket.user = decoded;
        next();
    });
});

io.on('connection', (socket) => {
    console.log(`🔌 Socket conectado: ${socket.user.email} (Tenant: ${socket.user.tenantId})`);
    const tenantRoom = `tenant:${socket.user.tenantId}`;
    socket.join(tenantRoom);
    
    // Envia status inicial do WhatsApp ao conectar
    const status = whatsappService.getStatus(socket.user.tenantId);
    socket.emit('whatsapp:status', status);
});

// Broadcast de eventos do WhatsApp para o front-end via Socket
eventBus.on('whatsapp:status', (data) => {
    if (data.tenantId) {
        io.to(`tenant:${data.tenantId}`).emit('whatsapp:status', data.status);
    }
});

// ============================================
// HELPERS & ANALYTICS
// ============================================

const analyzeSentiment = (text) => {
    if (!text) return { tags: [], sentiment: 'NEUTRAL' };
    
    const tags = new Set();
    const lower = text.toLowerCase();

    // Categorização
    if (lower.match(/preço|caro|valor|custo|barato|pagamento|boleto|fatura/)) tags.add('FINANCEIRO');
    if (lower.match(/atendimento|suporte|ajuda|demora|atenção|educação|grosso/)) tags.add('ATENDIMENTO');
    if (lower.match(/produto|qualidade|quebrado|funciona|bug|erro|falha/)) tags.add('PRODUTO');
    if (lower.match(/entrega|prazo|chegou|atraso|envio|frete|logística/)) tags.add('LOGÍSTICA');
    if (lower.match(/site|app|sistema|lento|travando|login|senha/)) tags.add('TECNOLOGIA');

    // Sentimento
    let sentiment = 'NEUTRAL';
    const positiveWords = /excelente|ótimo|maravilh|perfeito|recomendo|satisfeito|parabéns|top|10/;
    const negativeWords = /péssimo|horrível|terrível|nunca|pior|decepcion|insatisf|lixo|0/;
    
    if (positiveWords.test(lower)) sentiment = 'POSITIVE';
    if (negativeWords.test(lower)) sentiment = 'NEGATIVE';

    return { tags: Array.from(tags), sentiment };
};

// Atualiza o Dashboard em Tempo Real
async function broadcastDashboardUpdate(tenantId) {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) return;

        // Calcula métricas gerais (sem filtro de data para o broadcast rápido)
        // O cliente vai fazer refetch se precisar de dados filtrados
        const filters = { campaign: { tenantId }, status: 'ANSWERED' };

        const [total, promoters, detractors, neutrals] = await Promise.all([
            prisma.nPSResponse.count({ where: filters }),
            prisma.nPSResponse.count({ where: { ...filters, score: { gte: 9 } } }),
            prisma.nPSResponse.count({ where: { ...filters, score: { lte: 6 } } }),
            prisma.nPSResponse.count({ where: { ...filters, score: { gte: 7, lte: 8 } } })
        ]);

        const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
        
        // Dados Recentes
        const feedbacks = await prisma.nPSResponse.findMany({
            where: { ...filters, comment: { not: null } },
            take: 5,
            orderBy: { answeredAt: 'desc' },
            include: { customer: { select: { name: true, role: true } } }
        });

        // Taxa de Resposta
        const totalSent = await prisma.nPSResponse.count({ 
            where: { campaign: { tenantId }, status: { in: ['SENT', 'DELIVERED', 'ANSWERED'] } } 
        });
        const responseRate = totalSent > 0 ? Math.round((total / totalSent) * 100) : 0;

        // Emitir evento com log para debug
        console.log(`📡 Enviando update via Socket para Tenant: ${tenantId}. NPS: ${nps}`);
        io.to(`tenant:${tenantId}`).emit('dashboard:update', {
            metrics: { nps, total, promoters, detractors, neutrals, responseRate },
            feedbacks
        });
    } catch (e) {
        console.error("❌ Broadcast error:", e.message);
    }
}

// Templates Padrão (Fallback)
const WA_TEMPLATES = {
    PADRAO: (d) => `Olá *${d.contactName}*! 👋\n\nComo você avalia sua experiência com a *${d.companyName}*?`,
    FORMAL: (d) => `Prezado(a) *${d.contactName}*,\n\nQual nota você daria para a *${d.companyName}*?`,
    AMIGAVEL: (d) => `Oi *${d.contactName}*! Tudo bem? 😃\n\nDe 0 a 10, quanto você recomenda a *${d.companyName}*?`,
    ONBOARDING: (d) => `Olá *${d.contactName}*! 🚀\n\nQue bom ter você conosco! De 0 a 10, como você avalia nosso atendimento inicial na *${d.companyName}*?`,
    SUPORTE: (d) => `Olá *${d.contactName}*! 🎧\n\nRecentemente você foi atendido pela *${d.companyName}*. De 0 a 10, como foi nossa qualidade de suporte?`
};

const DEFAULT_SETTINGS = {
    regions: ["Sul", "Sudeste", "Centro-Oeste", "Norte", "Nordeste"],
    sectors: ["Varejo", "Tecnologia", "Saúde", "Financeiro", "Serviços", "Indústria"],
    roles: ["CEO", "Diretor", "Gerente", "Coordenador", "Analista", "Assistente"]
};

// ============================================
// HANDLER DE CONVERSA (MÁQUINA DE ESTADOS)
// ============================================

// Função para normalizar telefone brasileiro
function normalizePhone(phone) {
    if (!phone) return '';
    let clean = phone.replace(/\D/g, '');
    
    // Remove prefixo de ligação internacional se presente
    if (clean.startsWith('0')) clean = clean.slice(1);
    
    // Se não tem código do país, adiciona 55
    if (clean.length === 10 || clean.length === 11) {
        clean = '55' + clean;
    }
    
    // Retorna os últimos 12-13 dígitos (formato brasileiro padrão)
    return clean.slice(-13);
}

// Função para verificar se dois telefones são o mesmo
function phonesMatch(phone1, phone2) {
    const p1 = normalizePhone(phone1);
    const p2 = normalizePhone(phone2);
    
    if (!p1 || !p2) return false;
    
    // Match exato
    if (p1 === p2) return true;
    
    // Match pelos últimos 8 dígitos (número sem DDD)
    if (p1.slice(-8) === p2.slice(-8)) return true;
    
    // Match pelos últimos 9 dígitos (número com 9 na frente)
    if (p1.slice(-9) === p2.slice(-9)) return true;
    
    // Match pelos últimos 11 dígitos (DDD + número)
    if (p1.slice(-11) === p2.slice(-11)) return true;
    
    return false;
}

async function handleResponse(tenantId, phone, content, originalMsg = null) {
    let cleanPhone = phone.replace(/\D/g, '');
    
    // Função local para detectar LID caso a do serviço não esteja disponível
    const detectLID = (phoneNum) => {
        if (!phoneNum) return false;
        const clean = phoneNum.replace(/\D/g, '');
        
        // LIDs têm mais de 14 dígitos
        if (clean.length > 14) return true;
        
        // Padrões conhecidos de LID
        const lidPrefixes = ['6469', '5629', '6529', '5649', '4629', '4569', '5469', '6549'];
        for (const prefix of lidPrefixes) {
            if (clean.startsWith(prefix)) return true;
        }
        
        // Se não começa com 55 (Brasil) e tem 12+ dígitos, provavelmente é LID
        if (!clean.startsWith('55') && clean.length >= 12) {
            // Verifica se parece um número brasileiro sem código de país
            // DDDs brasileiros: 11-99
            const possibleDDD = parseInt(clean.substring(0, 2));
            if (possibleDDD < 11 || possibleDDD > 99) {
                return true;
            }
        }
        
        return false;
    };
    
    // Verifica se é um LID
    const isLID = whatsappService.isLID ? whatsappService.isLID(cleanPhone) : detectLID(cleanPhone);
    let resolvedPhone = cleanPhone;
    
    if (isLID) {
        console.log(`🔗 [LID] Detectado LID: ${cleanPhone}`);
        // Tenta resolver via mapeamento
        if (whatsappService.resolvePhone) {
            resolvedPhone = whatsappService.resolvePhone(cleanPhone);
        }
    }
    
    // Tenta obter contexto com o telefone original
    let ctx = whatsappService.getConversationContext(tenantId, cleanPhone);
    
    // Se não encontrou e temos um telefone resolvido diferente, tenta com ele
    if (!ctx && resolvedPhone !== cleanPhone) {
        ctx = whatsappService.getConversationContext(tenantId, resolvedPhone);
    }
    
    // Tenta também com o telefone normalizado
    if (!ctx) {
        const normalizedPhone = normalizePhone(cleanPhone);
        ctx = whatsappService.getConversationContext(tenantId, normalizedPhone);
    }
    
    // -----------------------------------------------------------------
    // RECUPERAÇÃO DE CONTEXTO DO BANCO DE DADOS
    // -----------------------------------------------------------------
    if (!ctx) {
        try {
            console.log(`🔍 [Context Recovery] Buscando contexto para: ${cleanPhone} (LID: ${isLID})`);
            
            // Busca todos os clientes do tenant
            const customers = await prisma.customer.findMany({
                where: {
                    tenantId,
                    phone: { not: null }
                },
                select: { id: true, phone: true, name: true }
            });
            
            // Encontra cliente com telefone compatível
            let customer = customers.find(c => phonesMatch(c.phone, cleanPhone));
            
            // Se não encontrou, tenta LID Recovery (independente de ser detectado como LID)
            // Porque o sistema pode receber IDs que não seguem padrões conhecidos
            if (!customer) {
                console.log(`🔍 [LID Recovery] Buscando por resposta recente...`);
                
                // Busca respostas enviadas nos últimos 30 minutos
                const recentSent = await prisma.nPSResponse.findMany({
                    where: {
                        campaign: { tenantId },
                        status: { in: ['SENT', 'DELIVERED'] },
                        channel: 'WHATSAPP',
                        sentAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }
                    },
                    orderBy: { sentAt: 'desc' },
                    take: 10,
                    include: { customer: true }
                });
                
                if (recentSent.length > 0) {
                    // Se só tem uma resposta pendente recente, assume que é dela
                    if (recentSent.length === 1) {
                        const response = recentSent[0];
                        customer = response.customer;
                        console.log(`✅ [LID Recovery] Única resposta pendente: ${customer.name}`);
                        
                        // Mapeia o LID para o número real para futuras mensagens
                        if (whatsappService.mapLidToPhone && customer.phone) {
                            whatsappService.mapLidToPhone(cleanPhone, customer.phone);
                        }
                    } else {
                        // Múltiplas pendentes - verifica se já temos mapeamento de LID similar
                        // ou tenta deduzir pelo tempo de envio
                        const now = Date.now();
                        
                        // Ordena por quem foi enviado mais recentemente
                        const sortedBySent = [...recentSent].sort((a, b) => 
                            new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
                        );
                        
                        // Pega o mais recente como melhor palpite
                        const response = sortedBySent[0];
                        customer = response.customer;
                        console.log(`⚠️ [LID Recovery] ${recentSent.length} pendentes, usando mais recente: ${customer.name} (${customer.phone})`);
                        
                        // Mapeia o LID
                        if (whatsappService.mapLidToPhone && customer.phone) {
                            whatsappService.mapLidToPhone(cleanPhone, customer.phone);
                        }
                    }
                }
            }
            
            if (customer) {
                console.log(`✅ [Context Recovery] Cliente encontrado: ${customer.name} (${customer.phone})`);
                
                // Busca a resposta pendente mais recente do cliente
                const recentPending = await prisma.nPSResponse.findFirst({
                    where: {
                        customerId: customer.id,
                        campaign: { tenantId },
                        status: { in: ['SENT', 'DELIVERED'] }
                    },
                    orderBy: { sentAt: 'desc' },
                    include: { customer: true, campaign: true }
                });

                // Se não encontrou pendente, busca ANSWERED mas com stage != DONE
                let targetResponse = recentPending;
                if (!targetResponse) {
                    targetResponse = await prisma.nPSResponse.findFirst({
                        where: {
                            customerId: customer.id,
                            campaign: { tenantId },
                            status: 'ANSWERED',
                            updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } // Última 1 hora
                        },
                        orderBy: { updatedAt: 'desc' },
                        include: { customer: true, campaign: true }
                    });
                }

                if (targetResponse) {
                    // Recupera metadados do JSON (parse seguro)
                    let meta = targetResponse.metadata;
                    if (typeof meta === 'string') {
                        try { meta = JSON.parse(meta); } catch (e) { meta = {}; }
                    } else {
                        meta = meta || {};
                    }
                    
                    const dbStage = meta.stage || 'VOTE';

                    // Só restaura se não estiver DONE
                    if (dbStage !== 'DONE') {
                        ctx = {
                            token: targetResponse.token,
                            campaignId: targetResponse.campaignId,
                            stage: dbStage,
                            startTime: Date.now(),
                            customerPhone: targetResponse.customer.phone
                        };
                        
                        // Restaura na memória com múltiplas chaves
                        whatsappService.setConversationContext(tenantId, cleanPhone, ctx);
                        whatsappService.setConversationContext(tenantId, customer.phone, ctx);
                        
                        console.log(`✅ [Contexto] Restaurado: ${customer.name} -> Estágio: ${dbStage}`);
                    } else {
                        console.log(`ℹ️ [Contexto] Conversa já finalizada para ${customer.name}`);
                    }
                } else {
                    console.log(`⚠️ [Context Recovery] Nenhuma pesquisa pendente para ${customer.name}`);
                }
            } else {
                console.log(`⚠️ [Context Recovery] Cliente não encontrado para: ${cleanPhone}`);
            }
        } catch (e) { 
            console.error("Erro Context Recovery:", e.message); 
        }
    }

    if (!ctx) {
        // Se receber número sem contexto e parecer um voto, loga para debug
        if (content && content.match(/^[0-9]{1,2}$/)) {
            console.log(`⚠️ [Handler] Possível voto "${content}" sem contexto para ${cleanPhone}`);
        }
        return;
    }

    const { token, stage } = ctx;
    const cleanContent = content ? content.toString().trim() : '';
    const replyId = ctx.customerPhone || cleanPhone;

    console.log(`📥 [Msg] ${cleanPhone} | Stage: ${stage} | Content: "${cleanContent}"`);

    try {
        // --- ESTÁGIO 1: RECEBER NOTA ---
        if (stage === 'VOTE') {
            const score = parseInt(cleanContent);
            
            // Validações
            if (isNaN(score) || score < 0 || score > 10) {
                if (cleanContent.match(/sair|cancelar/i)) {
                     whatsappService.clearConversationContext(tenantId, cleanPhone);
                     return;
                }
                if (cleanContent.length < 5) {
                    await whatsappService.sendMessage(tenantId, replyId, "Por favor, digite apenas um número de *0 a 10*.");
                }
                return;
            }

            // Atualiza DB
            const currentRecord = await prisma.nPSResponse.findUnique({ where: { token } });
            let currentMeta = currentRecord?.metadata;
            if (typeof currentMeta === 'string') try { currentMeta = JSON.parse(currentMeta); } catch(e) { currentMeta = {}; }
            else currentMeta = currentMeta || {};

            const newMeta = { ...currentMeta, stage: 'ASK_FEEDBACK', responderId: cleanPhone };
            
            // Tratamento JSON para compatibilidade SQLite/Postgres
            const metaToSave = process.env.DATABASE_URL.includes('sqlite') ? JSON.stringify(newMeta) : newMeta;

            await prisma.nPSResponse.update({
                where: { token },
                data: { 
                    score, 
                    status: 'ANSWERED', 
                    answeredAt: new Date(), 
                    channel: 'WHATSAPP_TEXT',
                    metadata: metaToSave
                }
            });

            await prisma.campaign.update({
                where: { id: ctx.campaignId },
                data: { totalAnswered: { increment: 1 } }
            });

            await broadcastDashboardUpdate(tenantId);

            // Avança memória
            whatsappService.setConversationContext(tenantId, cleanPhone, { ...ctx, stage: 'ASK_FEEDBACK' });

            // Pede feedback
            await whatsappService.sendMessage(tenantId, replyId, 
                `Nota ${score} recebida! ✅\n\nGostaria de deixar uma opinião, crítica ou sugestão?\n\nResponda *SIM* ou *NÃO*.`);

        } 
        // --- ESTÁGIO 2: DECISÃO (SIM/NÃO) ---
        else if (stage === 'ASK_FEEDBACK') {
            const response = cleanContent.toUpperCase();
            const isYes = ['SIM', 'S', 'QUERO', 'CLARO', 'YES', 'COM CERTEZA', 'QUERIA', 'PODE SER'].some(w => response.includes(w));
            const isNo = ['NÃO', 'NAO', 'N', 'NO', 'OBRIGADO'].some(w => response.includes(w));

            const currentRecord = await prisma.nPSResponse.findUnique({ where: { token } });
            let currentMeta = currentRecord?.metadata;
            if (typeof currentMeta === 'string') try { currentMeta = JSON.parse(currentMeta); } catch(e) { currentMeta = {}; }
            else currentMeta = currentMeta || {};

            if (isYes) {
                const newMeta = { ...currentMeta, stage: 'WAIT_FEEDBACK' };
                const metaToSave = process.env.DATABASE_URL.includes('sqlite') ? JSON.stringify(newMeta) : newMeta;

                await prisma.nPSResponse.update({
                    where: { token },
                    data: { metadata: metaToSave }
                });

                whatsappService.setConversationContext(tenantId, cleanPhone, { ...ctx, stage: 'WAIT_FEEDBACK' });
                await whatsappService.sendMessage(tenantId, replyId, "Por favor, escreva sua opinião abaixo:");
            
            } else if (isNo) {
                const newMeta = { ...currentMeta, stage: 'DONE' };
                const metaToSave = process.env.DATABASE_URL.includes('sqlite') ? JSON.stringify(newMeta) : newMeta;

                await prisma.nPSResponse.update({
                    where: { token },
                    data: { metadata: metaToSave }
                });

                whatsappService.clearConversationContext(tenantId, cleanPhone);
                await whatsappService.sendMessage(tenantId, replyId, "Entendido! Agradecemos sua participação. Tenha um ótimo dia! 🤝");
            
            } else {
                await whatsappService.sendMessage(tenantId, replyId, "Desculpe, não entendi. Responda *SIM* para comentar ou *NÃO* para encerrar.");
            }

        } 
        // --- ESTÁGIO 3: RECEBER COMENTÁRIO ---
        else if (stage === 'WAIT_FEEDBACK') {
            const analysis = analyzeSentiment(cleanContent);
            const currentRecord = await prisma.nPSResponse.findUnique({ where: { token } });
            let currentMeta = currentRecord?.metadata;
            if (typeof currentMeta === 'string') try { currentMeta = JSON.parse(currentMeta); } catch(e) { currentMeta = {}; }
            else currentMeta = currentMeta || {};
            
            const newMeta = { ...currentMeta, stage: 'DONE' };
            const metaToSave = process.env.DATABASE_URL.includes('sqlite') ? JSON.stringify(newMeta) : newMeta;

            await prisma.nPSResponse.update({
                where: { token },
                data: { 
                    comment: cleanContent,
                    tags: analysis.tags,
                    sentiment: analysis.sentiment,
                    metadata: metaToSave
                }
            });

            whatsappService.clearConversationContext(tenantId, cleanPhone);
            await whatsappService.sendMessage(tenantId, replyId, "Recebemos sua opinião! Obrigado pela parceria trazendo melhorias ao processo. 🚀");
            
            await broadcastDashboardUpdate(tenantId);
        }

    } catch (e) {
        console.error("Erro handleResponse:", e);
    }
}

// Wrapper para unificar o handler
const handleIncoming = async (phone, content, msg, tenantId) => {
    if (!content) return;
    
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Salva mensagem recebida no chat
    try {
        // Busca cliente pelo telefone
        const customer = await prisma.customer.findFirst({
            where: {
                tenantId,
                OR: [
                    { phone: cleanPhone },
                    { phone: { endsWith: cleanPhone.slice(-8) } }
                ]
            }
        });
        
        // Salva a mensagem
        const chatMessage = await prisma.chatMessage.create({
            data: {
                tenantId,
                customerId: customer?.id || null,
                customerName: customer?.name || msg?.pushName || 'Cliente',
                phone: cleanPhone,
                content,
                direction: 'incoming',
                status: 'delivered',
                messageId: msg?.key?.id || null
            }
        });
        
        // Emite evento para atualizar o chat em tempo real
        eventBus.emit('chat:message', {
            tenantId,
            conversationId: customer?.id || cleanPhone,
            message: chatMessage
        });
        
        console.log(`💬 [Chat] Mensagem recebida de ${cleanPhone}: "${content.substring(0, 50)}..."`);
        
    } catch (e) {
        console.error('Erro ao salvar mensagem no chat:', e.message);
    }
    
    // Processa resposta NPS
    await handleResponse(tenantId, phone, content);
};

// Registra os handlers
whatsappService.setMessageHandler((p, t, m, tid) => handleIncoming(p, t, m, tid));
whatsappService.setPollHandler(async () => {}); 

// ============================================
// JOB DE DISPARO
// ============================================

async function processCampaignBackground(campaignId, tenantId, customers, options = {}) {
    const { channel = 'WHATSAPP', template = 'PADRAO', branding = {}, customMessage } = options;
    console.log(`🚀 [JOB] Campanha ${campaignId} | ${customers.length} contatos`);

    for (const custData of customers) {
        try {
            const cleanPhone = custData.phone?.replace(/\D/g, '') || '';
            const customer = await prisma.customer.upsert({
                where: { tenantId_phone: { tenantId, phone: cleanPhone || `email_${Date.now()}` } },
                update: { name: custData.name },
                create: { 
                    name: custData.name, 
                    phone: cleanPhone, 
                    email: custData.email, 
                    role: custData.role, 
                    regional: custData.regional, 
                    tenantId,
                    isActive: true
                }
            });

            const token = crypto.randomBytes(16).toString('hex');
            const initialMeta = { stage: 'VOTE' };
            const metaToSave = process.env.DATABASE_URL.includes('sqlite') ? JSON.stringify(initialMeta) : initialMeta;

            // Cria registro INICIAL
            await prisma.nPSResponse.create({
                data: { 
                    token, 
                    status: 'PENDING', 
                    channel, 
                    campaignId, 
                    customerId: customer.id,
                    metadata: metaToSave 
                }
            });

            let sent = false;
            let msgId = null;

            if (channel === 'WHATSAPP') {
                let messageText = "";
                if (customMessage) {
                    messageText = customMessage
                        .replace(/{{nome}}/gi, customer.name.split(' ')[0])
                        .replace(/{{empresa}}/gi, branding.companyName || 'nossa empresa');
                } else {
                    const msgTemplate = WA_TEMPLATES[template] || WA_TEMPLATES.PADRAO;
                    messageText = msgTemplate({ 
                        contactName: customer.name.split(' ')[0], 
                        companyName: branding.companyName || 'nossa empresa'
                    });
                }

                const fullMessage = `${messageText}\n\nDigite sua nota de *0 a 10*:`;
                const result = await whatsappService.sendMessage(tenantId, cleanPhone, fullMessage);
                
                if (result.success) {
                    sent = true;
                    msgId = result.messageId;

                    // Inicia contexto na memória com múltiplas chaves para match
                    const contextData = {
                        token,
                        campaignId,
                        stage: 'VOTE',
                        startTime: Date.now(),
                        customerPhone: cleanPhone,
                        metadata: { messageId: msgId }
                    };
                    
                    // Salva com o telefone limpo
                    whatsappService.setConversationContext(tenantId, cleanPhone, contextData);
                    
                    // Também salva com formato normalizado (55 + número)
                    const normalized = normalizePhone(cleanPhone);
                    if (normalized !== cleanPhone) {
                        whatsappService.setConversationContext(tenantId, normalized, contextData);
                    }
                    
                    console.log(`✅ [WA] Enviado para: ${cleanPhone} | Token: ${token.slice(0,8)}...`);
                } else {
                    console.log(`❌ [WA] Erro envio para ${cleanPhone}: ${result.error}`);
                }

            } else if (channel === 'EMAIL') {
                if (!customer.email) {
                    console.log(`⚠️ [EMAIL] Cliente ${customer.name} sem email cadastrado`);
                    continue;
                }
                
                const templateData = {
                    customerName: customer.name.split(' ')[0],
                    companyName: branding.companyName || 'Nossa Empresa',
                    token, 
                    frontendUrl: FRONTEND_URL, 
                    branding
                };
                const result = await emailService.sendTemplateEmail('NPS_SURVEY', templateData, customer.email);
                sent = result.success;
                msgId = result.messageId;
                
                if (sent) {
                    console.log(`✅ [EMAIL] Enviado para: ${customer.email}`);
                } else {
                    console.log(`❌ [EMAIL] Falha para ${customer.email}: ${result.error}`);
                }
            }

            if (sent) {
                const meta = { stage: 'VOTE', messageId: msgId };
                const metaUpdate = process.env.DATABASE_URL.includes('sqlite') ? JSON.stringify(meta) : meta;

                await prisma.nPSResponse.update({ 
                    where: { token }, 
                    data: { 
                        status: 'SENT', 
                        sentAt: new Date(),
                        metadata: metaUpdate
                    } 
                });
            } else {
                await prisma.nPSResponse.update({ where: { token }, data: { status: 'FAILED' } });
            }

        } catch (e) {
            console.error(`Erro envio ${custData.name}:`, e.message);
        }
    }

    await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'COMPLETED', completedAt: new Date() }
    });
    
    await broadcastDashboardUpdate(tenantId);
}

// ============================================
// ROTAS - PÁGINAS (GET)
// ============================================

app.get('/', (req, res) => res.redirect('/login.html'));

app.get('/dashboard', (req, res) => res.render('dashboard', { user: { email: 'Admin' }, settings: { brandColor: '#4F46E5' } }));

app.get('/clients', async (req, res) => { res.render('clients', { user: { email: 'Admin' }, settings: { brandColor: '#4F46E5' } }); });

app.get('/messages', (req, res) => res.render('messages-new', { user: { email: 'Admin' }, settings: { brandColor: '#4F46E5' } }));

app.get('/create-campaign', (req, res) => res.render('create-campaign', { user: { email: 'Admin' }, settings: { brandColor: '#4F46E5' } }));

app.get('/settings', (req, res) => res.render('settings', { user: { email: 'Admin' }, settings: { brandColor: '#4F46E5', logoUrl: '', webhookUrl: '' } }));

app.get('/vote', async (req, res) => {
    try {
        const { t } = req.query;
        if (!t) return res.status(400).send("Link inválido");

        const response = await prisma.nPSResponse.findUnique({
            where: { token: t },
            include: { campaign: { include: { tenant: { include: { settings: true } } } }, customer: true }
        });

        if (!response) return res.status(404).send("Pesquisa não encontrada");
        if (response.status === 'ANSWERED') {
            return res.send(`<div style="text-align:center;font-family:sans-serif;padding:50px;"><h2>✅ Você já respondeu!</h2></div>`);
        }

        res.render('vote', {
            response, customer: response.customer, tenant: response.campaign.tenant,
            branding: response.campaign.tenant.settings || { brandColor: '#4F46E5' }
        });
    } catch (e) {
        res.status(500).send("Erro interno");
    }
});

app.get('/wall/:slug', async (req, res) => {
    try {
        const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, include: { settings: true } });
        if (!tenant) return res.status(404).send("Página não encontrada");

        const testimonials = await prisma.nPSResponse.findMany({
            where: { campaign: { tenantId: tenant.id }, status: 'ANSWERED', score: { gte: 9 }, comment: { not: null } },
            take: 30, orderBy: { answeredAt: 'desc' },
            include: { customer: { select: { name: true, role: true } } }
        });

        res.render('wall', { tenant, branding: tenant.settings || { brandColor: '#4F46E5' }, testimonials: testimonials.filter(t => t.comment?.trim().length > 3) });
    } catch (e) {
        res.status(500).send("Erro interno");
    }
});

// ============================================
// ROTAS - API (VOTAÇÃO / RESPOSTAS NPS)
// ============================================

// POST /api/vote - Recebe voto do formulário web
app.post('/api/vote', async (req, res) => {
    try {
        const { token, score, comment, problemSolved, serviceRating } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: "Token obrigatório" });
        }
        
        if (score === undefined || score === null || isNaN(parseInt(score)) || score < 0 || score > 10) {
            return res.status(400).json({ error: "Score deve ser um número entre 0 e 10" });
        }

        // Busca a resposta pelo token
        const response = await prisma.nPSResponse.findUnique({
            where: { token },
            include: { campaign: { include: { tenant: true } }, customer: true }
        });

        if (!response) {
            return res.status(404).json({ error: "Pesquisa não encontrada" });
        }

        if (response.status === 'ANSWERED') {
            return res.status(400).json({ error: "Esta pesquisa já foi respondida" });
        }

        // Analisa sentimento do comentário se existir
        let analysis = { tags: [], sentiment: 'NEUTRAL' };
        if (comment && comment.trim()) {
            analysis = analyzeSentiment(comment);
        }

        // Atualiza a resposta
        const updated = await prisma.nPSResponse.update({
            where: { token },
            data: {
                score: parseInt(score),
                comment: comment || null,
                problemSolved: problemSolved !== undefined ? problemSolved : null,
                serviceRating: serviceRating ? parseInt(serviceRating) : null,
                status: 'ANSWERED',
                answeredAt: new Date(),
                tags: analysis.tags,
                sentiment: analysis.sentiment,
                metadata: {
                    stage: 'DONE',
                    source: 'WEB_FORM',
                    answeredVia: 'web'
                }
            }
        });

        // Atualiza contador da campanha
        await prisma.campaign.update({
            where: { id: response.campaignId },
            data: { totalAnswered: { increment: 1 } }
        });

        // Broadcast para dashboard
        await broadcastDashboardUpdate(response.campaign.tenantId);

        console.log(`✅ [VOTO WEB] Token: ${token} | Score: ${score} | Cliente: ${response.customer?.name}`);

        res.json({ success: true, message: "Voto registrado com sucesso" });

    } catch (e) {
        console.error("Erro POST /api/vote:", e);
        res.status(500).json({ error: "Erro ao registrar voto" });
    }
});

// GET /api/vote-quick - Voto rápido via link de email (1-click)
app.get('/api/vote-quick', async (req, res) => {
    try {
        const { t: token, s: scoreStr } = req.query;
        
        if (!token || !scoreStr) {
            return res.status(400).send(renderQuickVoteResult('error', 'Link inválido'));
        }

        const score = parseInt(scoreStr);
        if (isNaN(score) || score < 0 || score > 10) {
            return res.status(400).send(renderQuickVoteResult('error', 'Nota inválida'));
        }

        // Busca a resposta pelo token
        const response = await prisma.nPSResponse.findUnique({
            where: { token },
            include: { campaign: { include: { tenant: { include: { settings: true } } } }, customer: true }
        });

        if (!response) {
            return res.status(404).send(renderQuickVoteResult('error', 'Pesquisa não encontrada'));
        }

        if (response.status === 'ANSWERED') {
            return res.send(renderQuickVoteResult('already', 'Você já respondeu esta pesquisa!', response.campaign.tenant));
        }

        // Registra o voto
        await prisma.nPSResponse.update({
            where: { token },
            data: {
                score,
                status: 'ANSWERED',
                answeredAt: new Date(),
                metadata: {
                    stage: 'DONE',
                    source: 'EMAIL_QUICK',
                    answeredVia: 'email-oneclick'
                }
            }
        });

        // Atualiza contador da campanha
        await prisma.campaign.update({
            where: { id: response.campaignId },
            data: { totalAnswered: { increment: 1 } }
        });

        // Broadcast para dashboard
        await broadcastDashboardUpdate(response.campaign.tenantId);

        console.log(`✅ [VOTO EMAIL] Token: ${token} | Score: ${score} | Cliente: ${response.customer?.name}`);

        // Redireciona para página de comentário opcional
        res.redirect(`/vote-thanks?t=${token}&s=${score}`);

    } catch (e) {
        console.error("Erro GET /api/vote-quick:", e);
        res.status(500).send(renderQuickVoteResult('error', 'Erro ao processar voto'));
    }
});

// GET /vote-thanks - Página de agradecimento com opção de comentário
app.get('/vote-thanks', async (req, res) => {
    try {
        const { t: token, s: scoreStr } = req.query;
        const score = parseInt(scoreStr) || 0;

        const response = await prisma.nPSResponse.findUnique({
            where: { token },
            include: { campaign: { include: { tenant: { include: { settings: true } } } }, customer: true }
        });

        if (!response) {
            return res.status(404).send("Pesquisa não encontrada");
        }

        const branding = response.campaign.tenant.settings || { brandColor: '#4F46E5' };
        const tenant = response.campaign.tenant;
        const customer = response.customer;

        // Determina emoji e mensagem baseado na nota
        let emoji = '🎉';
        let message = 'Ficamos muito felizes com seu feedback!';
        if (score <= 6) {
            emoji = '🙏';
            message = 'Agradecemos seu feedback. Vamos analisar com carinho.';
        } else if (score <= 8) {
            emoji = '👍';
            message = 'Obrigado! Vamos continuar melhorando.';
        }

        res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Obrigado! | ${tenant.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="min-h-screen bg-gray-900 flex items-center justify-center p-4">
    <div class="w-full max-w-lg">
        <div class="bg-gray-800/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-gray-700/50 overflow-hidden">
            <div class="p-8 text-center" style="background: linear-gradient(135deg, ${branding.brandColor}22 0%, transparent 100%);">
                <div class="text-6xl mb-4">${emoji}</div>
                <h1 class="text-2xl font-bold text-white mb-2">Obrigado, ${customer.name.split(' ')[0]}!</h1>
                <p class="text-gray-400">${message}</p>
                <div class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-full">
                    <span class="text-gray-400 text-sm">Sua nota:</span>
                    <span class="text-2xl font-bold ${score >= 9 ? 'text-green-400' : score >= 7 ? 'text-yellow-400' : 'text-red-400'}">${score}</span>
                </div>
            </div>
            
            <div class="p-8">
                <div id="comment-section">
                    <p class="text-gray-400 text-center mb-4">Gostaria de deixar um comentário? (opcional)</p>
                    <textarea id="comment" rows="4" 
                        class="w-full bg-gray-700/50 border border-gray-600 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 outline-none transition resize-none mb-4"
                        placeholder="O que motivou sua nota? Como podemos melhorar?"></textarea>
                    <button onclick="submitComment()" id="submit-btn"
                        class="w-full py-3 px-6 rounded-xl text-white font-bold transition-all hover:opacity-90"
                        style="background: ${branding.brandColor};">
                        Enviar Comentário
                    </button>
                    <button onclick="skipComment()" class="w-full mt-3 py-2 text-gray-500 hover:text-gray-300 transition text-sm">
                        Pular
                    </button>
                </div>
                
                <div id="done-section" class="hidden text-center">
                    <p class="text-green-400 font-semibold">✅ Resposta registrada!</p>
                    <p class="text-gray-500 text-sm mt-2">Você pode fechar esta janela.</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        const token = "${token}";
        
        async function submitComment() {
            const comment = document.getElementById('comment').value.trim();
            if (!comment) {
                skipComment();
                return;
            }
            
            const btn = document.getElementById('submit-btn');
            btn.disabled = true;
            btn.innerHTML = 'Enviando...';
            
            try {
                await fetch('/api/vote-comment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, comment })
                });
            } catch (e) {}
            
            document.getElementById('comment-section').classList.add('hidden');
            document.getElementById('done-section').classList.remove('hidden');
        }
        
        function skipComment() {
            document.getElementById('comment-section').classList.add('hidden');
            document.getElementById('done-section').classList.remove('hidden');
        }
    </script>
</body>
</html>
        `);
    } catch (e) {
        console.error("Erro GET /vote-thanks:", e);
        res.status(500).send("Erro interno");
    }
});

// POST /api/vote-comment - Adiciona comentário a um voto existente
app.post('/api/vote-comment', async (req, res) => {
    try {
        const { token, comment } = req.body;
        
        if (!token || !comment) {
            return res.status(400).json({ error: "Token e comentário obrigatórios" });
        }

        const response = await prisma.nPSResponse.findUnique({
            where: { token },
            include: { campaign: true }
        });

        if (!response) {
            return res.status(404).json({ error: "Pesquisa não encontrada" });
        }

        // Analisa sentimento
        const analysis = analyzeSentiment(comment);

        await prisma.nPSResponse.update({
            where: { token },
            data: {
                comment,
                tags: analysis.tags,
                sentiment: analysis.sentiment
            }
        });

        // Broadcast para dashboard
        await broadcastDashboardUpdate(response.campaign.tenantId);

        console.log(`💬 [COMENTÁRIO] Token: ${token} | Comentário: ${comment.substring(0, 50)}...`);

        res.json({ success: true });
    } catch (e) {
        console.error("Erro POST /api/vote-comment:", e);
        res.status(500).json({ error: "Erro ao salvar comentário" });
    }
});

// Função auxiliar para renderizar resultado do voto rápido
function renderQuickVoteResult(type, message, tenant = null) {
    const brandColor = tenant?.settings?.brandColor || '#4F46E5';
    const emoji = type === 'error' ? '❌' : type === 'already' ? 'ℹ️' : '✅';
    const bgColor = type === 'error' ? '#7f1d1d' : type === 'already' ? '#1e3a8a' : '#14532d';
    
    return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pesquisa NPS</title>
    <style>
        body { 
            font-family: 'Segoe UI', Arial, sans-serif; 
            background: #111827; 
            display: flex; 
            justify-content: center; 
            align-items: center; 
            min-height: 100vh; 
            margin: 0;
        }
        .card {
            background: #1f2937;
            border-radius: 16px;
            padding: 40px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }
        .emoji { font-size: 48px; margin-bottom: 16px; }
        .message { color: #e5e7eb; font-size: 18px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="emoji">${emoji}</div>
        <p class="message">${message}</p>
    </div>
</body>
</html>
    `;
}

// ============================================
// ROTAS - API (AUTH)
// ============================================

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "Campos obrigatórios" });

        const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Credenciais inválidas" });
        }

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, tenantId: user.tenantId }, JWT_SECRET, { expiresIn: '24h' });

        res.json({ token, user: { id: user.id, name: user.name || user.email, email: user.email, role: user.role, company: user.tenant.name } });
    } catch (e) {
        res.status(500).json({ error: "Erro no servidor" });
    }
});

// ============================================
// ROTAS - API (DASHBOARD)
// ============================================

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
    try {
        const { month, year } = req.query;
        const tenantId = req.user.tenantId;

        // Filtro de Data
        let dateFilter = {};
        const currentYear = year ? parseInt(year) : new Date().getFullYear();
        if (month) {
            const m = parseInt(month) - 1;
            const start = new Date(currentYear, m, 1);
            const end = new Date(currentYear, m + 1, 0, 23, 59, 59);
            dateFilter = { answeredAt: { gte: start, lte: end } };
        }

        const filters = { campaign: { tenantId }, status: 'ANSWERED', ...dateFilter };

        const [total, promoters, detractors, neutrals] = await Promise.all([
            prisma.nPSResponse.count({ where: filters }),
            prisma.nPSResponse.count({ where: { ...filters, score: { gte: 9 } } }),
            prisma.nPSResponse.count({ where: { ...filters, score: { lte: 6 } } }),
            prisma.nPSResponse.count({ where: { ...filters, score: { gte: 7, lte: 8 } } })
        ]);

        const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
        
        // Taxa de Resposta
        const totalSent = await prisma.nPSResponse.count({ 
            where: { 
                campaign: { tenantId }, 
                status: { in: ['SENT', 'DELIVERED', 'ANSWERED'] },
                ...(dateFilter.answeredAt ? { sentAt: dateFilter.answeredAt } : {})
            } 
        });
        const responseRate = totalSent > 0 ? Math.round((total / totalSent) * 100) : 0;

        // Histórico de 12 Meses
        const historyStart = new Date();
        historyStart.setMonth(historyStart.getMonth() - 11);
        historyStart.setDate(1);
        historyStart.setHours(0,0,0,0);
        
        const historyData = await prisma.nPSResponse.findMany({
            where: { campaign: { tenantId }, status: 'ANSWERED', answeredAt: { gte: historyStart } },
            select: { answeredAt: true, score: true },
            orderBy: { answeredAt: 'asc' }
        });

        // Preenche meses vazios com 0
        const monthlyStats = {};
        for (let i = 0; i < 12; i++) {
             const d = new Date(historyStart);
             d.setMonth(d.getMonth() + i);
             const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
             monthlyStats[key] = { p: 0, d: 0, t: 0 };
        }

        historyData.forEach(r => {
            const d = new Date(r.answeredAt);
            const key = `${d.getMonth() + 1}/${d.getFullYear()}`;
            if (monthlyStats[key]) {
                monthlyStats[key].t++;
                if (r.score >= 9) monthlyStats[key].p++;
                else if (r.score <= 6) monthlyStats[key].d++;
            }
        });

        const chart = { 
            labels: Object.keys(monthlyStats), 
            data: Object.values(monthlyStats).map(s => s.t > 0 ? Math.round(((s.p - s.d) / s.t) * 100) : 0) 
        };

        const feedbacks = await prisma.nPSResponse.findMany({
            where: { ...filters, comment: { not: null } },
            take: 10,
            orderBy: { answeredAt: 'desc' },
            include: { customer: { select: { name: true, role: true } } }
        });

        // Contagem de tratativas pendentes (detratores sem tratamento)
        const pendingTreatments = await prisma.nPSResponse.count({
            where: {
                campaign: { tenantId },
                status: 'ANSWERED',
                score: { lte: 6 },
                treatmentStatus: 'PENDING'
            }
        });

        res.json({ success: true, metrics: { nps, total, promoters, detractors, neutrals, responseRate, pendingTreatments }, chart, feedbacks });

    } catch (e) { res.status(500).json({ error: "Erro" }); }
});

// ============================================
// ROTAS - API (CAMPANHAS)
// ============================================

app.post('/api/campaigns/dispatch', authenticateToken, async (req, res) => {
    try {
        const { name, customers, channel, template, message } = req.body;
        if (!name || !customers?.length) return res.status(400).json({ error: "Nome e clientes obrigatórios" });

        const tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId }, include: { settings: true } });
        const branding = { companyName: tenant.name, logoUrl: tenant.settings?.logoUrl, brandColor: tenant.settings?.brandColor };

        const campaign = await prisma.campaign.create({
            data: { name, channel: channel || 'WHATSAPP', template: template || 'PADRAO', status: 'PROCESSING', tenantId: req.user.tenantId }
        });

        processCampaignBackground(campaign.id, req.user.tenantId, customers, { 
            channel: channel || 'WHATSAPP', 
            template: template || 'PADRAO', 
            branding,
            customMessage: message 
        }).catch(console.error);

        res.json({ success: true, message: "Campanha iniciada", campaignId: campaign.id });
    } catch (e) {
        res.status(500).json({ error: "Erro ao iniciar campanha" });
    }
});

app.get('/api/campaigns', authenticateToken, async (req, res) => {
    try {
        const campaigns = await prisma.campaign.findMany({ where: { tenantId: req.user.tenantId }, orderBy: { createdAt: 'desc' }, take: 50 });
        res.json(campaigns);
    } catch (e) {
        res.status(500).json({ error: "Erro" });
    }
});

// ============================================
// ROTAS - API (CLIENTES)
// ============================================

app.post('/api/customers/import', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Arquivo obrigatório" });

    const results = [];
    const tenantId = req.user.tenantId;

    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            let successCount = 0, errorCount = 0;
            fs.unlink(req.file.path, () => {});

            for (const row of results) {
                const normalized = {};
                Object.keys(row).forEach(key => { normalized[key.toLowerCase().trim()] = row[key]?.trim(); });

                const name = normalized.nome || normalized.name;
                const phone = (normalized.telefone || normalized.phone || '').replace(/\D/g, '');
                const email = normalized.email;

                if (name && (phone || email)) {
                    try {
                        await prisma.customer.upsert({
                            where: { tenantId_phone: { tenantId, phone: phone || `temp_${Date.now()}` } },
                            update: { name, email, role: normalized.cargo || normalized.role, regional: normalized.regional },
                            create: { name, phone, email, role: normalized.cargo || normalized.role, regional: normalized.regional, tenantId }
                        });
                        successCount++;
                    } catch (e) { errorCount++; }
                } else errorCount++;
            }
            res.json({ success: true, imported: successCount, failed: errorCount });
        });
});

app.get('/api/customers', authenticateToken, async (req, res) => {
    try {
        const { search, regional, limit = 200 } = req.query;
        const where = { tenantId: req.user.tenantId };
        
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } }
            ];
        }
        if (regional) where.regional = regional;

        const customers = await prisma.customer.findMany({ where, orderBy: { createdAt: 'desc' }, take: parseInt(limit) });
        res.json(customers);
    } catch (e) { res.status(500).json({ error: "Erro" }); }
});

app.post('/api/customers', authenticateToken, async (req, res) => {
    try {
        const { name, phone, email, role, regional, companyName, sector, isActive } = req.body;
        if (!name) return res.status(400).json({ error: "Nome obrigatório" });

        const cleanPhone = phone?.replace(/\D/g, '');
        let customer;
        
        if (cleanPhone) {
            customer = await prisma.customer.upsert({
                where: { tenantId_phone: { tenantId: req.user.tenantId, phone: cleanPhone } },
                update: { name, email, role, regional, companyName, sector, isActive: isActive !== undefined ? isActive : true },
                create: { name, phone: cleanPhone, email, role, regional, companyName, sector, tenantId: req.user.tenantId, isActive: isActive !== undefined ? isActive : true }
            });
        } else {
            customer = await prisma.customer.create({
                data: { name, phone: null, email, role, regional, companyName, sector, tenantId: req.user.tenantId, isActive: isActive !== undefined ? isActive : true }
            });
        }
        res.status(200).json(customer);
    } catch (e) {
        console.error("Erro create customer:", e);
        res.status(500).json({ error: "Erro ao criar cliente" });
    }
});

app.put('/api/customers/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, email, role, regional, companyName, sector, isActive } = req.body;

        const customer = await prisma.customer.update({
            where: { id },
            data: { name, phone: phone?.replace(/\D/g, ''), email, role, regional, companyName, sector, isActive }
        });
        res.json({ success: true, customer });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Erro ao atualizar" });
    }
});

app.delete('/api/customers/:id', authenticateToken, async (req, res) => {
    try {
        await prisma.customer.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Erro ao deletar" });
    }
});

app.get('/api/admin/reports/messages', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [messages, total] = await Promise.all([
            prisma.nPSResponse.findMany({
                where: { campaign: { tenantId: req.user.tenantId } },
                orderBy: { createdAt: 'desc' }, skip, take: parseInt(limit),
                include: { customer: { select: { name: true, phone: true, email: true } }, campaign: { select: { name: true, channel: true } } }
            }),
            prisma.nPSResponse.count({ where: { campaign: { tenantId: req.user.tenantId } } })
        ]);

        res.json({ messages, total, pages: Math.ceil(total / parseInt(limit)), currentPage: parseInt(page) });
    } catch (e) {
        res.status(500).json({ error: "Erro" });
    }
});

// ============================================
// ROTAS - API (MENSAGENS E TRATATIVAS)
// ============================================

// Estatísticas de mensagens
app.get('/api/admin/messages/stats', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;

        const [pending, inProgress, resolved, detractors] = await Promise.all([
            prisma.nPSResponse.count({
                where: { campaign: { tenantId }, status: 'ANSWERED', score: { lte: 6 }, treatmentStatus: 'PENDING' }
            }),
            prisma.nPSResponse.count({
                where: { campaign: { tenantId }, status: 'ANSWERED', score: { lte: 6 }, treatmentStatus: 'IN_PROGRESS' }
            }),
            prisma.nPSResponse.count({
                where: { campaign: { tenantId }, status: 'ANSWERED', score: { lte: 6 }, treatmentStatus: 'RESOLVED' }
            }),
            prisma.nPSResponse.count({
                where: { campaign: { tenantId }, status: 'ANSWERED', score: { lte: 6 } }
            })
        ]);

        res.json({ pending, inProgress, resolved, detractors });
    } catch (e) {
        console.error('Erro stats:', e);
        res.status(500).json({ error: "Erro ao carregar estatísticas" });
    }
});

// Listagem de mensagens com filtros avançados
app.get('/api/admin/messages', authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, tab = 'all', search, channel, period, treatment } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const tenantId = req.user.tenantId;

        // Construir filtros
        let where = { campaign: { tenantId }, status: 'ANSWERED' };

        // Filtro por tab
        switch (tab) {
            case 'detractors':
                where.score = { lte: 6 };
                break;
            case 'neutrals':
                where.score = { gte: 7, lte: 8 };
                break;
            case 'promoters':
                where.score = { gte: 9 };
                break;
            case 'pending-treatment':
                where.score = { lte: 6 };
                where.treatmentStatus = 'PENDING';
                break;
        }

        // Filtro por canal
        if (channel) {
            where.channel = channel;
        }

        // Filtro por período
        if (period) {
            const days = parseInt(period);
            const dateFrom = new Date();
            dateFrom.setDate(dateFrom.getDate() - days);
            where.answeredAt = { gte: dateFrom };
        }

        // Filtro por status de tratativa
        if (treatment) {
            where.treatmentStatus = treatment;
        }

        // Filtro por busca (nome, email, telefone)
        if (search) {
            where.customer = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } }
                ]
            };
        }

        const [messages, total] = await Promise.all([
            prisma.nPSResponse.findMany({
                where,
                orderBy: [
                    { treatmentStatus: 'asc' }, // PENDING primeiro
                    { score: 'asc' }, // Menor score primeiro
                    { answeredAt: 'desc' }
                ],
                skip,
                take: parseInt(limit),
                include: {
                    customer: {
                        select: { id: true, name: true, email: true, phone: true, companyName: true, sector: true, regional: true, role: true }
                    },
                    campaign: {
                        select: { id: true, name: true, channel: true }
                    }
                }
            }),
            prisma.nPSResponse.count({ where })
        ]);

        res.json({
            messages,
            total,
            pages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page)
        });
    } catch (e) {
        console.error('Erro messages:', e);
        res.status(500).json({ error: "Erro ao carregar mensagens" });
    }
});

// Detalhes de uma mensagem específica
app.get('/api/admin/messages/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        const response = await prisma.nPSResponse.findFirst({
            where: { id, campaign: { tenantId } },
            include: {
                customer: true,
                campaign: { select: { id: true, name: true, channel: true } },
                treatedBy: { select: { name: true, email: true } }
            }
        });

        if (!response) {
            return res.status(404).json({ error: "Resposta não encontrada" });
        }

        // Buscar histórico de tratativas (simulado com metadata)
        let treatmentHistory = [];
        if (response.metadata?.treatmentHistory) {
            treatmentHistory = response.metadata.treatmentHistory;
        }

        res.json({ ...response, treatmentHistory });
    } catch (e) {
        console.error('Erro message detail:', e);
        res.status(500).json({ error: "Erro ao carregar detalhes" });
    }
});

// Salvar tratativa individual
app.post('/api/admin/treatments/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, notes, contactAction } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        // Verificar se a resposta pertence ao tenant
        const response = await prisma.nPSResponse.findFirst({
            where: { id, campaign: { tenantId } }
        });

        if (!response) {
            return res.status(404).json({ error: "Resposta não encontrada" });
        }

        // Preparar histórico de tratativas
        const existingMetadata = response.metadata || {};
        const treatmentHistory = existingMetadata.treatmentHistory || [];

        // Adicionar nova entrada no histórico
        const newEntry = {
            status,
            notes: notes || '',
            contactAction: contactAction || null,
            createdAt: new Date().toISOString(),
            userId,
            userName: req.user.name || req.user.email
        };
        treatmentHistory.push(newEntry);

        // Atualizar resposta
        const updated = await prisma.nPSResponse.update({
            where: { id },
            data: {
                treatmentStatus: status,
                treatmentNotes: notes,
                treatedAt: status === 'RESOLVED' ? new Date() : response.treatedAt,
                treatedById: userId,
                metadata: {
                    ...existingMetadata,
                    treatmentHistory,
                    lastContactAction: contactAction
                }
            }
        });

        // Emitir atualização via WebSocket
        io.to(`tenant:${tenantId}`).emit('dashboard:update', { type: 'treatment' });

        res.json({ success: true, response: updated });
    } catch (e) {
        console.error('Erro treatment:', e);
        res.status(500).json({ error: "Erro ao salvar tratativa" });
    }
});

// Tratativa em lote
app.post('/api/admin/treatments/bulk', authenticateToken, async (req, res) => {
    try {
        const { ids, status } = req.body;
        const tenantId = req.user.tenantId;
        const userId = req.user.id;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "IDs não fornecidos" });
        }

        // Verificar se todas as respostas pertencem ao tenant
        const responses = await prisma.nPSResponse.findMany({
            where: { id: { in: ids }, campaign: { tenantId } },
            select: { id: true, metadata: true }
        });

        if (responses.length !== ids.length) {
            return res.status(403).json({ error: "Algumas respostas não foram encontradas" });
        }

        // Atualizar todas as respostas
        const updatePromises = responses.map(async (response) => {
            const existingMetadata = response.metadata || {};
            const treatmentHistory = existingMetadata.treatmentHistory || [];

            treatmentHistory.push({
                status,
                notes: 'Atualização em lote',
                createdAt: new Date().toISOString(),
                userId,
                userName: req.user.name || req.user.email
            });

            return prisma.nPSResponse.update({
                where: { id: response.id },
                data: {
                    treatmentStatus: status,
                    treatedAt: status === 'RESOLVED' ? new Date() : undefined,
                    treatedById: userId,
                    metadata: { ...existingMetadata, treatmentHistory }
                }
            });
        });

        await Promise.all(updatePromises);

        // Emitir atualização via WebSocket
        io.to(`tenant:${tenantId}`).emit('dashboard:update', { type: 'bulk-treatment' });

        res.json({ success: true, updated: ids.length });
    } catch (e) {
        console.error('Erro bulk treatment:', e);
        res.status(500).json({ error: "Erro ao atualizar em lote" });
    }
});

// Enviar mensagem de recuperação
app.post('/api/admin/treatments/:id/recovery', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user.tenantId;

        // Buscar resposta e dados do cliente
        const response = await prisma.nPSResponse.findFirst({
            where: { id, campaign: { tenantId } },
            include: {
                customer: true,
                campaign: { include: { tenant: { include: { settings: true } } } }
            }
        });

        if (!response) {
            return res.status(404).json({ error: "Resposta não encontrada" });
        }

        if (!response.customer?.phone) {
            return res.status(400).json({ error: "Cliente não possui telefone cadastrado" });
        }

        // Verificar se WhatsApp está conectado
        const waStatus = whatsappService.getStatus(tenantId);
        if (waStatus.status !== 'CONNECTED') {
            return res.status(400).json({ error: "WhatsApp não está conectado" });
        }

        // Gerar mensagem de recuperação personalizada
        const companyName = response.campaign.tenant.name || 'Nossa empresa';
        const customerName = response.customer.name.split(' ')[0]; // Primeiro nome
        
        const recoveryMessage = `Olá ${customerName}! 👋

Aqui é da equipe de relacionamento da *${companyName}*.

Notamos que sua última experiência conosco não foi das melhores, e isso nos preocupa muito. 😔

Gostaríamos muito de entender melhor o que aconteceu e como podemos melhorar.

Podemos conversar? Estamos à disposição para ouvir você e resolver qualquer pendência.

Sua satisfação é nossa prioridade! 💙`;

        // Enviar mensagem
        const sent = await whatsappService.sendMessage(tenantId, response.customer.phone, recoveryMessage);

        if (!sent.success) {
            return res.status(500).json({ error: "Erro ao enviar mensagem: " + sent.error });
        }

        // Atualizar metadata com registro da mensagem de recuperação
        const existingMetadata = response.metadata || {};
        const treatmentHistory = existingMetadata.treatmentHistory || [];

        treatmentHistory.push({
            status: 'RECOVERY_SENT',
            notes: 'Mensagem de recuperação enviada via WhatsApp',
            createdAt: new Date().toISOString(),
            userId: req.user.id,
            userName: req.user.name || req.user.email
        });

        await prisma.nPSResponse.update({
            where: { id },
            data: {
                treatmentStatus: 'IN_PROGRESS',
                metadata: {
                    ...existingMetadata,
                    treatmentHistory,
                    lastRecoveryMessageAt: new Date().toISOString()
                }
            }
        });

        res.json({ success: true, message: "Mensagem de recuperação enviada" });
    } catch (e) {
        console.error('Erro recovery:', e);
        res.status(500).json({ error: "Erro ao enviar mensagem de recuperação" });
    }
});

app.get('/api/admin/settings', authenticateToken, async (req, res) => {
    try {
        let settings = await prisma.tenantSettings.findUnique({ where: { tenantId: req.user.tenantId } });
        if (!settings) settings = await prisma.tenantSettings.create({ 
            data: { 
                tenantId: req.user.tenantId,
                regionsConfig: JSON.stringify(DEFAULT_SETTINGS.regions),
                sectorsConfig: JSON.stringify(DEFAULT_SETTINGS.sectors),
                rolesConfig: JSON.stringify(DEFAULT_SETTINGS.roles)
            } 
        });
        
        // Parse JSON strings
        const response = {
            ...settings,
            regions: JSON.parse(settings.regionsConfig || '[]'),
            sectors: JSON.parse(settings.sectorsConfig || '[]'),
            roles: JSON.parse(settings.rolesConfig || '[]')
        };
        res.json(response);
    } catch (e) { res.status(500).json({ error: "Erro" }); }
});

app.post('/api/admin/settings', authenticateToken, async (req, res) => {
    try {
        const { brandColor, logoUrl, webhookUrl, regions, sectors, roles } = req.body;
        
        const updateData = { brandColor, logoUrl, webhookUrl };
        if (regions) updateData.regionsConfig = JSON.stringify(regions);
        if (sectors) updateData.sectorsConfig = JSON.stringify(sectors);
        if (roles) updateData.rolesConfig = JSON.stringify(roles);

        const settings = await prisma.tenantSettings.upsert({
            where: { tenantId: req.user.tenantId },
            update: updateData,
            create: { 
                tenantId: req.user.tenantId, 
                ...updateData,
                regionsConfig: JSON.stringify(DEFAULT_SETTINGS.regions),
                sectorsConfig: JSON.stringify(DEFAULT_SETTINGS.sectors),
                rolesConfig: JSON.stringify(DEFAULT_SETTINGS.roles)
            }
        });
        res.json({ success: true, settings });
    } catch (e) { res.status(500).json({ error: "Erro" }); }
});

app.post('/api/admin/test-email', authenticateToken, async (req, res) => {
    try {
        const { to } = req.body;
        const result = await emailService.sendEmail({ to, subject: 'Teste - NPS Manager', html: `<h2>✅ Email de Teste</h2>` });
        res.json(result);
    } catch (e) { res.status(500).json({ error: "Erro" }); }
});

app.get('/api/whatsapp/status', authenticateToken, (req, res) => {
    whatsappService.connectToWhatsApp(req.user.tenantId, eventBus);
    res.json(whatsappService.getStatus(req.user.tenantId));
});

app.post('/api/whatsapp/logout', authenticateToken, async (req, res) => {
    res.json(await whatsappService.logout(req.user.tenantId));
});

// ============================================
// ROTAS - CHAT EM TEMPO REAL
// ============================================

// Página do Chat
app.get('/chat', (req, res) => {
    res.render('chat', { user: { email: 'Admin' }, settings: { brandColor: '#4F46E5' } });
});

// Obter todas as conversas
app.get('/api/chat/conversations', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        
        // Mapa de conversas por customerId (chave única e estável)
        const conversationsMap = new Map();
        
        // 1. Busca todos os clientes com interações recentes
        const customersWithNps = await prisma.customer.findMany({
            where: {
                tenantId,
                responses: {
                    some: {
                        campaign: { tenantId },
                        sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 dias
                    }
                }
            },
            include: {
                responses: {
                    where: {
                        campaign: { tenantId }
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: 1,
                    select: {
                        score: true,
                        comment: true,
                        status: true,
                        sentAt: true,
                        answeredAt: true,
                        updatedAt: true
                    }
                },
                chatMessages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        content: true,
                        direction: true,
                        createdAt: true,
                        readAt: true
                    }
                }
            }
        });
        
        for (const customer of customersWithNps) {
            const lastNps = customer.responses[0];
            const lastChat = customer.chatMessages[0];
            
            // Determina a última mensagem e data
            let lastMessage = 'Sem mensagens';
            let lastMessageAt = lastNps?.sentAt || new Date(0);
            
            if (lastChat && new Date(lastChat.createdAt) > new Date(lastMessageAt)) {
                lastMessage = lastChat.content;
                lastMessageAt = lastChat.createdAt;
            } else if (lastNps) {
                if (lastNps.comment) {
                    lastMessage = lastNps.comment;
                    lastMessageAt = lastNps.answeredAt || lastNps.updatedAt;
                } else if (lastNps.score !== null) {
                    lastMessage = `NPS: ${lastNps.score}`;
                    lastMessageAt = lastNps.answeredAt || lastNps.updatedAt;
                } else {
                    lastMessage = 'Pesquisa enviada';
                    lastMessageAt = lastNps.sentAt;
                }
            }
            
            conversationsMap.set(customer.id, {
                id: customer.id,
                customerId: customer.id,
                customerName: customer.name,
                phone: customer.phone, // Telefone real do cliente
                lastMessage: lastMessage?.substring(0, 100),
                lastMessageAt,
                unreadCount: 0,
                lastNpsScore: lastNps?.score ?? null,
                messageCount: customer.chatMessages.length + customer.responses.length
            });
        }
        
        // 2. Conta mensagens não lidas por cliente
        const unreadCounts = await prisma.chatMessage.groupBy({
            by: ['customerId'],
            where: {
                tenantId,
                direction: 'incoming',
                readAt: null,
                customerId: { not: null }
            },
            _count: true
        });
        
        for (const count of unreadCounts) {
            if (count.customerId && conversationsMap.has(count.customerId)) {
                conversationsMap.get(count.customerId).unreadCount = count._count;
            }
        }
        
        // 3. Adiciona conversas de chat que não têm NPS
        const chatOnlyCustomers = await prisma.chatMessage.findMany({
            where: {
                tenantId,
                customerId: { notIn: Array.from(conversationsMap.keys()) }
            },
            distinct: ['customerId'],
            orderBy: { createdAt: 'desc' },
            include: {
                customer: {
                    select: { id: true, name: true, phone: true }
                }
            }
        });
        
        for (const msg of chatOnlyCustomers) {
            if (!msg.customerId || conversationsMap.has(msg.customerId)) continue;
            
            conversationsMap.set(msg.customerId, {
                id: msg.customerId,
                customerId: msg.customerId,
                customerName: msg.customer?.name || msg.customerName || 'Cliente',
                phone: msg.customer?.phone || msg.phone,
                lastMessage: msg.content?.substring(0, 100),
                lastMessageAt: msg.createdAt,
                unreadCount: msg.direction === 'incoming' && !msg.readAt ? 1 : 0,
                lastNpsScore: null,
                messageCount: 1
            });
        }
        
        // Converte para array e ordena por data da última mensagem
        const conversations = Array.from(conversationsMap.values())
            .filter(c => c.phone) // Apenas conversas com telefone válido
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        
        res.json(conversations);
        
    } catch (e) {
        console.error('Erro ao listar conversas:', e);
        res.status(500).json({ error: "Erro ao listar conversas" });
    }
});

// Criar nova conversa
app.post('/api/chat/conversations', authenticateToken, async (req, res) => {
    try {
        const { name, phone } = req.body;
        const tenantId = req.user.tenantId;
        
        if (!phone) {
            return res.status(400).json({ error: "Telefone é obrigatório" });
        }
        
        const cleanPhone = phone.replace(/\D/g, '');
        
        // Busca ou cria cliente
        let customer = await prisma.customer.findFirst({
            where: {
                tenantId,
                phone: cleanPhone
            }
        });
        
        if (!customer) {
            customer = await prisma.customer.create({
                data: {
                    name: name || 'Cliente',
                    phone: cleanPhone,
                    tenantId,
                    isActive: true
                }
            });
        }
        
        res.json({
            id: customer.id,
            customerId: customer.id,
            customerName: customer.name,
            phone: customer.phone,
            lastMessage: null,
            lastMessageAt: new Date(),
            unreadCount: 0,
            lastNpsScore: null
        });
        
    } catch (e) {
        console.error('Erro ao criar conversa:', e);
        res.status(500).json({ error: "Erro ao criar conversa" });
    }
});

// Obter mensagens de uma conversa - HISTÓRICO COMPLETO
app.get('/api/chat/conversations/:id/messages', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const conversationId = req.params.id;
        
        // Busca o cliente primeiro
        let customer = await prisma.customer.findFirst({
            where: {
                id: conversationId,
                tenantId
            }
        });
        
        // Se não encontrou por ID, tenta por telefone
        if (!customer) {
            customer = await prisma.customer.findFirst({
                where: {
                    phone: conversationId,
                    tenantId
                }
            });
        }
        
        if (!customer) {
            return res.json([]);
        }
        
        // Array para armazenar todas as mensagens
        const allMessages = [];
        
        // 1. Busca mensagens do chat
        const chatMessages = await prisma.chatMessage.findMany({
            where: {
                tenantId,
                OR: [
                    { customerId: customer.id },
                    { phone: customer.phone }
                ]
            },
            orderBy: { createdAt: 'asc' }
        });
        
        chatMessages.forEach(msg => {
            allMessages.push({
                id: msg.id,
                content: msg.content,
                direction: msg.direction,
                status: msg.status,
                createdAt: msg.createdAt,
                type: 'chat'
            });
        });
        
        // 2. Busca histórico de NPS (pesquisas enviadas e respostas)
        const npsResponses = await prisma.nPSResponse.findMany({
            where: {
                customerId: customer.id,
                campaign: { tenantId }
            },
            orderBy: { createdAt: 'asc' },
            include: {
                campaign: { select: { name: true } }
            }
        });
        
        npsResponses.forEach(nps => {
            // Mensagem de envio da pesquisa
            if (nps.sentAt) {
                allMessages.push({
                    id: `nps-sent-${nps.id}`,
                    content: `📊 Pesquisa NPS enviada (${nps.campaign?.name || 'Campanha'})`,
                    direction: 'outgoing',
                    status: 'sent',
                    createdAt: nps.sentAt,
                    type: 'system',
                    isSystem: true
                });
            }
            
            // Resposta do cliente (score)
            if (nps.answeredAt && nps.score !== null) {
                const emoji = nps.score >= 9 ? '🎉' : nps.score >= 7 ? '😐' : '😞';
                allMessages.push({
                    id: `nps-score-${nps.id}`,
                    content: `${emoji} Nota NPS: ${nps.score}`,
                    direction: 'incoming',
                    status: 'delivered',
                    createdAt: nps.answeredAt,
                    type: 'nps-score'
                });
            }
            
            // Comentário do cliente
            if (nps.comment) {
                allMessages.push({
                    id: `nps-comment-${nps.id}`,
                    content: nps.comment,
                    direction: 'incoming',
                    status: 'delivered',
                    createdAt: nps.answeredAt || nps.updatedAt,
                    type: 'nps-comment'
                });
            }
            
            // Tratativa realizada
            if (nps.treatmentStatus === 'COMPLETED' && nps.treatmentNotes) {
                allMessages.push({
                    id: `nps-treatment-${nps.id}`,
                    content: `📋 Tratativa: ${nps.treatmentNotes}`,
                    direction: 'outgoing',
                    status: 'sent',
                    createdAt: nps.treatedAt || nps.updatedAt,
                    type: 'system',
                    isSystem: true
                });
            }
        });
        
        // Ordena todas as mensagens por data
        allMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        res.json(allMessages);
        
    } catch (e) {
        console.error('Erro ao carregar mensagens:', e);
        res.status(500).json({ error: "Erro ao carregar mensagens" });
    }
});

// Enviar mensagem
app.post('/api/chat/conversations/:id/messages', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const conversationId = req.params.id;
        const { content } = req.body;
        
        if (!content?.trim()) {
            return res.status(400).json({ error: "Mensagem é obrigatória" });
        }
        
        // Busca o cliente
        let customer = await prisma.customer.findFirst({
            where: {
                id: conversationId,
                tenantId
            }
        });
        
        // Se não encontrou por ID, tenta por telefone
        if (!customer) {
            customer = await prisma.customer.findFirst({
                where: {
                    phone: conversationId,
                    tenantId
                }
            });
        }
        
        if (!customer?.phone) {
            return res.status(404).json({ error: "Cliente não encontrado ou sem telefone" });
        }
        
        // Envia via WhatsApp
        const waResult = await whatsappService.sendMessage(tenantId, customer.phone, content);
        
        if (!waResult.success) {
            return res.status(500).json({ error: `Erro WhatsApp: ${waResult.error}` });
        }
        
        // Salva no banco
        const message = await prisma.chatMessage.create({
            data: {
                tenantId,
                customerId: customer.id,
                customerName: customer.name,
                phone: customer.phone,
                content,
                direction: 'outgoing',
                status: 'sent',
                messageId: waResult.messageId
            }
        });
        
        // Emite via socket
        eventBus.emit('chat:message', {
            tenantId,
            conversationId: customer.id,
            message
        });
        
        res.json(message);
        
    } catch (e) {
        console.error('Erro ao enviar mensagem:', e);
        res.status(500).json({ error: "Erro ao enviar mensagem" });
    }
});

// Marcar conversa como lida
app.post('/api/chat/conversations/:id/read', authenticateToken, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        const conversationId = req.params.id;
        
        await prisma.chatMessage.updateMany({
            where: {
                tenantId,
                OR: [
                    { customerId: conversationId },
                    { phone: conversationId }
                ],
                direction: 'incoming',
                readAt: null
            },
            data: {
                readAt: new Date()
            }
        });
        
        res.json({ success: true });
        
    } catch (e) {
        res.status(500).json({ error: "Erro" });
    }
});

// 404 & Error Handler
app.use((req, res) => res.status(404).json({ error: "Rota não encontrada" }));
app.use((err, req, res, next) => {
    console.error('❌', err);
    if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: "Erro interno" });
});

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================

const initSystem = async () => {
    console.log('\n🔧 Inicializando...');
    try {
        await prisma.$connect();
        console.log('✅ Banco conectado');

        let tenant = await prisma.tenant.findFirst({ where: { slug: 'admin-corp' } });
        if (!tenant) {
            tenant = await prisma.tenant.create({ 
                data: { 
                    name: "Empresa Demo", 
                    slug: "admin-corp",
                    settings: {
                        create: {
                            regionsConfig: JSON.stringify(DEFAULT_SETTINGS.regions),
                            sectorsConfig: JSON.stringify(DEFAULT_SETTINGS.sectors),
                            rolesConfig: JSON.stringify(DEFAULT_SETTINGS.roles)
                        }
                    }
                } 
            });
        }

        const adminEmail = "admin@nps.com";
        const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
        if (!existingUser) {
            await prisma.user.create({
                data: { email: adminEmail, password: await bcrypt.hash("admin123", 10), name: "Admin", role: "ADMIN", tenantId: tenant.id }
            });
        }

        if (process.env.SMTP_HOST) {
            const test = await emailService.testConnection();
            console.log(test.success ? '📧 SMTP OK' : '⚠️ SMTP erro: ' + test.error);
        }
        
        const allTenants = await prisma.tenant.findMany({ select: { id: true } });
        await whatsappService.restoreSessions(allTenants.map(t => t.id), eventBus);

    } catch (e) {
        console.error('❌ Init error:', e.message);
        process.exit(1);
    }
};

const shutdown = async () => {
    console.log('\n🛑 Encerrando...');
    await prisma.$disconnect();
    server.close(() => process.exit(0));
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, async () => {
    console.log(`\n🚀 NPS MANAGER V5 | http://localhost:${PORT}\n`);
    await initSystem();
    console.log('\n✅ Sistema pronto!\n');
});

module.exports = { app, server, prisma };