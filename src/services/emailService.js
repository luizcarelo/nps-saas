// ============================================
// NPS MANAGER V5 - EMAIL SERVICE PROFISSIONAL
// ============================================

const nodemailer = require('nodemailer');

let defaultTransporter = null;

function createTransporter(config = {}) {
    const transportConfig = {
        host: config.host || process.env.SMTP_HOST,
        port: parseInt(config.port || process.env.SMTP_PORT) || 587,
        secure: (config.secure || process.env.SMTP_SECURE) === 'true',
        auth: { user: config.user || process.env.SMTP_USER, pass: config.pass || process.env.SMTP_PASS },
        pool: true, maxConnections: 5, maxMessages: 100, rateDelta: 1000, rateLimit: 5,
        connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 30000,
    };
    if (!transportConfig.auth.user || !transportConfig.auth.pass) delete transportConfig.auth;
    return nodemailer.createTransport(transportConfig);
}

function getDefaultTransporter() {
    if (!defaultTransporter) defaultTransporter = createTransporter();
    return defaultTransporter;
}

function adjustColor(color, amount) {
    const clamp = (val) => Math.min(255, Math.max(0, val));
    let hex = color.replace('#', '');
    let r = clamp(parseInt(hex.substring(0, 2), 16) + amount);
    let g = clamp(parseInt(hex.substring(2, 4), 16) + amount);
    let b = clamp(parseInt(hex.substring(4, 6), 16) + amount);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function generateNPSEmail(data) {
    const { customerName, companyName, token, frontendUrl, brandColor = '#4F46E5', logoUrl, companyEmail, companyPhone, companyWebsite, customMessage } = data;
    const darkerColor = adjustColor(brandColor, -30);
    const year = new Date().getFullYear();
    
    let scoreButtons = '';
    for (let i = 0; i <= 10; i++) {
        const color = i <= 6 ? '#EF4444' : (i <= 8 ? '#F59E0B' : '#10B981');
        const url = `${frontendUrl}/api/vote-quick?t=${token}&s=${i}`;
        scoreButtons += `<a href="${url}" target="_blank" style="display:inline-block;width:38px;height:38px;line-height:38px;text-align:center;background:linear-gradient(135deg,#fff 0%,#f8fafc 100%);color:${color};border:2px solid ${color};border-radius:50%;font-weight:700;font-size:14px;margin:3px;box-shadow:0 2px 4px rgba(0,0,0,0.08);text-decoration:none;">${i}</a>`;
    }
    
    const message = customMessage || `Sua opinião é muito importante para nós!<br>De <strong style="color:#1e293b;">0 a 10</strong>, quanto você recomendaria a <strong style="color:${brandColor};">${companyName}</strong>?`;

    return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Pesquisa NPS</title><style>body{margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;}@media(max-width:600px){.container{width:100%!important;padding:20px 15px!important;}.content{padding:30px 20px!important;}}</style></head><body>
<div style="display:none;max-height:0;overflow:hidden;">${customerName}, queremos sua opinião! Leva 30 segundos.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:40px 20px;" class="container">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.12);">
<tr><td style="background:linear-gradient(135deg,${brandColor} 0%,${darkerColor} 100%);padding:45px 40px;text-align:center;">
${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:55px;max-width:180px;margin-bottom:12px;"><p style="color:rgba(255,255,255,0.9);margin:0;font-size:14px;">${companyName}</p>` : `<h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">${companyName}</h1>`}
</td></tr>
<tr><td style="padding:50px 45px;" class="content">
<div style="text-align:center;margin-bottom:30px;"><div style="font-size:52px;margin-bottom:20px;">👋</div><h2 style="color:#1e293b;margin:0 0 12px;font-size:26px;font-weight:700;">Olá, ${customerName}!</h2></div>
<p style="color:#64748b;font-size:16px;line-height:1.7;margin:0 0 35px;text-align:center;max-width:420px;margin-left:auto;margin-right:auto;">${message}</p>
<div style="background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);border-radius:20px;padding:30px 25px;text-align:center;">
<p style="color:#94a3b8;font-size:11px;margin:0 0 18px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">Clique em uma nota</p>
<div style="line-height:2.8;">${scoreButtons}</div>
<table width="100%" style="margin-top:18px;"><tr><td style="text-align:left;color:#ef4444;font-size:11px;font-weight:600;">😞 Não recomendo</td><td style="text-align:right;color:#10b981;font-size:11px;font-weight:600;">😍 Recomendo muito!</td></tr></table>
</div>
<div style="margin-top:30px;background:${brandColor}10;border:1px solid ${brandColor}25;border-radius:12px;padding:18px 20px;text-align:center;">
<p style="color:${brandColor};font-size:14px;margin:0;font-weight:500;">⏱️ Leva menos de 30 segundos • Sua resposta é 100% confidencial</p>
</div>
</td></tr>
<tr><td style="padding:0 45px;"><div style="height:1px;background:linear-gradient(to right,transparent,#e2e8f0,transparent);"></div></td></tr>
<tr><td style="background:#f8fafc;padding:35px 45px;text-align:center;">
${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:35px;opacity:0.7;margin-bottom:15px;">` : ''}
<p style="color:#64748b;font-size:13px;margin:0 0 12px;font-weight:500;">${companyName}</p>
<p style="color:#94a3b8;font-size:12px;margin:0;line-height:1.8;">
${companyEmail ? `📧 ${companyEmail}<br>` : ''}${companyPhone ? `📞 ${companyPhone}<br>` : ''}${companyWebsite ? `🌐 <a href="${companyWebsite}" style="color:${brandColor};">${companyWebsite.replace(/https?:\/\//, '')}</a>` : ''}
</p>
</td></tr>
</table>
<table role="presentation" width="600" style="margin-top:25px;"><tr><td style="text-align:center;padding:0 20px;">
<p style="color:#94a3b8;font-size:11px;margin:0 0 8px;">© ${year} ${companyName}. Todos os direitos reservados.</p>
<p style="color:#cbd5e1;font-size:10px;margin:0;">Você recebeu este email porque é cliente. <a href="${frontendUrl}/unsubscribe?t=${token}" style="color:#94a3b8;text-decoration:underline;">Cancelar inscrição</a></p>
</td></tr></table>
</td></tr></table></body></html>`;
}

function generateThankYouEmail(data) {
    const { customerName, companyName, brandColor = '#4F46E5', logoUrl } = data;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
<table width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:40px 20px;"><tr>
<td style="background:#fff;border-radius:24px;padding:50px 40px;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.1);">
${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:50px;margin-bottom:25px;">` : ''}
<div style="font-size:64px;margin-bottom:25px;">🎉</div>
<h2 style="color:#1e293b;margin:0 0 15px;font-size:26px;font-weight:700;">Muito obrigado, ${customerName}!</h2>
<p style="color:#64748b;font-size:16px;line-height:1.7;margin:0 0 30px;">Ficamos muito felizes com sua avaliação!<br>Seu feedback nos motiva a continuar melhorando.</p>
<div style="background:linear-gradient(135deg,#dcfce7 0%,#d1fae5 100%);border-radius:16px;padding:25px;border:1px solid #86efac;">
<p style="color:#166534;font-size:15px;margin:0;font-weight:500;">💚 Que tal compartilhar sua experiência com amigos e colegas?</p>
</div>
</td></tr></table></body></html>`;
}

function generateFollowUpEmail(data) {
    const { customerName, companyName, companyPhone, logoUrl } = data;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
<table width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:40px 20px;"><tr>
<td style="background:#fff;border-radius:24px;padding:50px 40px;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.1);">
${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:50px;margin-bottom:25px;">` : ''}
<div style="font-size:48px;margin-bottom:20px;">🤝</div>
<h2 style="color:#1e293b;margin:0 0 15px;font-size:24px;font-weight:700;">Olá, ${customerName}</h2>
<p style="color:#64748b;font-size:16px;line-height:1.7;margin:0 0 25px;">Recebemos seu feedback e gostaríamos de entender melhor.<br>Nossa equipe entrará em contato em breve.</p>
<div style="background:linear-gradient(135deg,#fef3c7 0%,#fde68a 100%);border-radius:12px;padding:20px;display:inline-block;">
<p style="color:#92400e;font-size:14px;margin:0;font-weight:500;">${companyPhone ? `📞 Ou ligue: ${companyPhone}` : '🤝 Estamos comprometidos em resolver qualquer questão.'}</p>
</div>
</td></tr></table></body></html>`;
}

function generateReminderEmail(data) {
    const { customerName, companyName, token, frontendUrl, brandColor = '#4F46E5', logoUrl } = data;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background:#f1f5f9;">
<table width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;padding:40px 20px;"><tr>
<td style="background:#fff;border-radius:24px;padding:50px 40px;text-align:center;box-shadow:0 25px 50px -12px rgba(0,0,0,0.1);">
${logoUrl ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:50px;margin-bottom:25px;">` : ''}
<div style="font-size:52px;margin-bottom:20px;">⏰</div>
<h2 style="color:#1e293b;margin:0 0 15px;font-size:24px;font-weight:700;">${customerName}, ainda aguardamos sua opinião!</h2>
<p style="color:#64748b;font-size:16px;line-height:1.7;margin:0 0 30px;">Sua avaliação sobre a ${companyName} é muito importante.<br>Leva menos de 30 segundos!</p>
<a href="${frontendUrl}/vote?t=${token}" style="display:inline-block;background:linear-gradient(135deg,${brandColor} 0%,${brandColor}dd 100%);color:#fff;padding:16px 40px;border-radius:12px;font-weight:600;font-size:16px;text-decoration:none;box-shadow:0 10px 25px -5px ${brandColor}50;">Responder Agora →</a>
</td></tr></table></body></html>`;
}

const EMAIL_TEMPLATES = {
    NPS_SURVEY: (data) => ({ subject: `${data.customerName}, queremos sua opinião! | ${data.companyName}`, html: generateNPSEmail(data) }),
    THANK_YOU_PROMOTER: (data) => ({ subject: `Obrigado pelo seu feedback, ${data.customerName}! 💚`, html: generateThankYouEmail(data) }),
    FOLLOW_UP_DETRACTOR: (data) => ({ subject: `${data.companyName} quer ouvir você`, html: generateFollowUpEmail(data) }),
    REMINDER: (data) => ({ subject: `⏰ Lembrete: Sua opinião é importante!`, html: generateReminderEmail(data) })
};

async function sendEmail(options, customTransporter = null) {
    const transporter = customTransporter || getDefaultTransporter();
    const mailOptions = {
        from: options.from || `"${process.env.SMTP_FROM_NAME || 'NPS Manager'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: options.to, subject: options.subject, html: options.html, text: options.text, replyTo: options.replyTo, headers: options.headers || {}
    };
    try {
        if (!process.env.SMTP_HOST) {
            console.log(`📧 [EMAIL MOCK] Para: ${options.to} | Assunto: ${options.subject}`);
            return { success: true, mock: true, messageId: `mock-${Date.now()}` };
        }
        const result = await transporter.sendMail(mailOptions);
        console.log(`✅ [EMAIL] Enviado para: ${options.to} | ID: ${result.messageId}`);
        return { success: true, messageId: result.messageId, response: result.response };
    } catch (error) {
        console.error(`❌ [EMAIL] Erro: ${options.to}:`, error.message);
        return { success: false, error: error.message, code: error.code };
    }
}

async function sendTemplateEmail(templateName, data, to, customTransporter = null) {
    const template = EMAIL_TEMPLATES[templateName];
    if (!template) return { success: false, error: `Template '${templateName}' não encontrado` };
    const { subject, html } = template(data);
    return sendEmail({ to, subject, html }, customTransporter);
}

async function sendBulkEmails(emails, onProgress = null) {
    const results = [];
    const transporter = getDefaultTransporter();
    for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        const result = await sendEmail(email, transporter);
        results.push({ to: email.to, ...result });
        if (onProgress) onProgress({ current: i + 1, total: emails.length, success: result.success, to: email.to });
        if (result.success) await new Promise(r => setTimeout(r, 200));
    }
    return results;
}

async function testConnection(config = {}) {
    try {
        const transporter = config.host ? createTransporter(config) : getDefaultTransporter();
        await transporter.verify();
        return { success: true, message: 'Conexão SMTP válida' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

module.exports = { sendEmail, sendTemplateEmail, sendBulkEmails, testConnection, createTransporter, EMAIL_TEMPLATES, generateNPSEmail, generateThankYouEmail, generateFollowUpEmail, generateReminderEmail };