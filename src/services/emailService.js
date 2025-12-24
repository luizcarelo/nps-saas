// ============================================
// NPS MANAGER V5 - EMAIL SERVICE
// ============================================

const nodemailer = require('nodemailer');

// ============================================
// CONFIGURAÇÃO DO TRANSPORTER
// ============================================

let defaultTransporter = null;

function createTransporter(config = {}) {
    const transportConfig = {
        host: config.host || process.env.SMTP_HOST,
        port: parseInt(config.port || process.env.SMTP_PORT) || 587,
        secure: (config.secure || process.env.SMTP_SECURE) === 'true',
        auth: {
            user: config.user || process.env.SMTP_USER,
            pass: config.pass || process.env.SMTP_PASS
        },
        // Configurações adicionais de robustez
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateDelta: 1000,
        rateLimit: 5, // 5 emails por segundo máximo
        // Timeout configurations
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 30000,
    };

    // Remove auth se não tiver credenciais (para teste)
    if (!transportConfig.auth.user || !transportConfig.auth.pass) {
        delete transportConfig.auth;
    }

    return nodemailer.createTransport(transportConfig);
}

function getDefaultTransporter() {
    if (!defaultTransporter) {
        defaultTransporter = createTransporter();
    }
    return defaultTransporter;
}

// ============================================
// TEMPLATES DE EMAIL
// ============================================

const EMAIL_TEMPLATES = {
    // Template padrão de NPS
    NPS_SURVEY: (data) => ({
        subject: `Como foi sua experiência com ${data.companyName}?`,
        html: generateNPSSurveyEmail(data)
    }),

    // Template de agradecimento (promotor)
    THANK_YOU_PROMOTER: (data) => ({
        subject: `Obrigado pelo seu feedback, ${data.customerName}!`,
        html: generateThankYouEmail(data, 'promoter')
    }),

    // Template de follow-up (detrator)
    FOLLOW_UP_DETRACTOR: (data) => ({
        subject: `${data.companyName} quer ouvir você`,
        html: generateFollowUpEmail(data)
    }),

    // Template de lembrete
    REMINDER: (data) => ({
        subject: `Lembrete: Sua opinião é muito importante para nós`,
        html: generateReminderEmail(data)
    })
};

// ============================================
// GERAÇÃO DE HTML DOS EMAILS
// ============================================

function generateNPSSurveyEmail(data) {
    const { customerName, companyName, token, frontendUrl, branding = {} } = data;
    const brandColor = branding.brandColor || '#4F46E5';
    const logoUrl = branding.logoUrl;

    // Gera os botões de 0-10
    let buttons = '';
    for (let i = 0; i <= 10; i++) {
        const color = i <= 6 ? '#EF4444' : (i <= 8 ? '#F59E0B' : '#10B981');
        const url = `${frontendUrl}/api/vote-quick?t=${token}&s=${i}`;
        buttons += `
            <a href="${url}" style="
                display: inline-block;
                width: 40px;
                height: 40px;
                line-height: 40px;
                text-align: center;
                background: #f3f4f6;
                color: ${color};
                text-decoration: none;
                border: 2px solid ${color};
                border-radius: 50%;
                font-weight: bold;
                margin: 3px;
                font-size: 14px;
            ">${i}</a>
        `;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <tr>
            <td style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <table width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="background: ${brandColor}; padding: 30px; text-align: center;">
                            ${logoUrl 
                                ? `<img src="${logoUrl}" alt="${companyName}" style="max-height: 50px; max-width: 200px;">`
                                : `<h1 style="color: white; margin: 0; font-size: 24px;">${companyName}</h1>`
                            }
                        </td>
                    </tr>
                </table>

                <!-- Content -->
                <table width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="padding: 40px 30px; text-align: center;">
                            <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 22px; font-weight: 600;">
                                Olá, ${customerName}! 👋
                            </h2>
                            <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                Sua opinião é muito importante para nós!<br>
                                De <strong>0 a 10</strong>, quanto você recomendaria a <strong>${companyName}</strong>?
                            </p>
                            
                            <!-- Score Buttons -->
                            <div style="margin: 30px 0;">
                                ${buttons}
                            </div>
                            
                            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">
                                0 = Não recomendaria &nbsp;|&nbsp; 10 = Com certeza recomendaria
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Footer -->
                <table width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                        <td style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                                Esta pesquisa leva menos de 30 segundos.<br>
                                Sua resposta é confidencial e nos ajuda a melhorar.
                            </p>
                        </td>
                    </tr>
                </table>

            </td>
        </tr>
        
        <!-- Unsubscribe -->
        <tr>
            <td style="text-align: center; padding: 20px;">
                <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                    © ${new Date().getFullYear()} ${companyName}. Todos os direitos reservados.<br>
                    <a href="${frontendUrl}/unsubscribe?t=${token}" style="color: #9ca3af;">Cancelar inscrição</a>
                </p>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

function generateThankYouEmail(data, type) {
    const { customerName, companyName, branding = {} } = data;
    const brandColor = branding.brandColor || '#4F46E5';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <tr>
            <td style="background: white; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
                <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 24px;">
                    Muito obrigado, ${customerName}!
                </h2>
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0;">
                    Ficamos muito felizes com seu feedback positivo!<br>
                    Sua avaliação nos motiva a continuar melhorando.
                </p>
                <div style="margin-top: 30px; padding: 20px; background: #f0fdf4; border-radius: 12px; border: 1px solid #86efac;">
                    <p style="color: #166534; font-size: 14px; margin: 0;">
                        💚 Que tal compartilhar sua experiência com amigos e colegas?
                    </p>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

function generateFollowUpEmail(data) {
    const { customerName, companyName, branding = {} } = data;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <tr>
            <td style="background: white; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 22px;">
                    Olá, ${customerName}
                </h2>
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                    Recebemos seu feedback e gostaríamos de entender melhor sua experiência.<br>
                    Sua opinião é fundamental para melhorarmos nossos serviços.
                </p>
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0;">
                    Nossa equipe entrará em contato em breve para ouvi-lo(a) melhor.
                </p>
                <div style="margin-top: 30px; padding: 15px 25px; background: #fef3c7; border-radius: 8px; display: inline-block;">
                    <p style="color: #92400e; font-size: 14px; margin: 0;">
                        🤝 Estamos comprometidos em resolver qualquer questão.
                    </p>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

function generateReminderEmail(data) {
    const { customerName, companyName, token, frontendUrl, branding = {} } = data;
    const brandColor = branding.brandColor || '#4F46E5';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <tr>
            <td style="background: white; border-radius: 16px; padding: 40px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="font-size: 48px; margin-bottom: 20px;">⏰</div>
                <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 22px;">
                    ${customerName}, ainda aguardamos sua opinião!
                </h2>
                <p style="color: #6b7280; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
                    Sua avaliação sobre a ${companyName} é muito importante para nós.<br>
                    Leva menos de 30 segundos!
                </p>
                <a href="${frontendUrl}/vote?t=${token}" style="
                    display: inline-block;
                    background: ${brandColor};
                    color: white;
                    text-decoration: none;
                    padding: 14px 35px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 16px;
                ">Responder Agora</a>
            </td>
        </tr>
    </table>
</body>
</html>
    `;
}

// ============================================
// FUNÇÕES DE ENVIO
// ============================================

async function sendEmail(options, customTransporter = null) {
    const transporter = customTransporter || getDefaultTransporter();
    
    const mailOptions = {
        from: options.from || `"${process.env.SMTP_FROM_NAME || 'NPS Manager'}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text, // Versão texto plano (opcional)
        replyTo: options.replyTo,
        headers: options.headers || {}
    };

    try {
        // Verifica se tem configuração SMTP
        if (!process.env.SMTP_HOST) {
            console.log(`📧 [EMAIL MOCK] Para: ${options.to} | Assunto: ${options.subject}`);
            return { 
                success: true, 
                mock: true, 
                messageId: `mock-${Date.now()}` 
            };
        }

        const result = await transporter.sendMail(mailOptions);
        
        console.log(`✅ [EMAIL] Enviado para: ${options.to} | ID: ${result.messageId}`);
        
        return {
            success: true,
            messageId: result.messageId,
            response: result.response
        };

    } catch (error) {
        console.error(`❌ [EMAIL] Erro ao enviar para ${options.to}:`, error.message);
        
        return {
            success: false,
            error: error.message,
            code: error.code
        };
    }
}

// Envio usando template
async function sendTemplateEmail(templateName, data, to, customTransporter = null) {
    const template = EMAIL_TEMPLATES[templateName];
    
    if (!template) {
        return { success: false, error: `Template '${templateName}' não encontrado` };
    }

    const { subject, html } = template(data);
    
    return sendEmail({
        to,
        subject,
        html
    }, customTransporter);
}

// Envio em lote
async function sendBulkEmails(emails, onProgress = null) {
    const results = [];
    const transporter = getDefaultTransporter();

    for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        
        const result = await sendEmail(email, transporter);
        results.push({ to: email.to, ...result });

        if (onProgress) {
            onProgress({
                current: i + 1,
                total: emails.length,
                success: result.success,
                to: email.to
            });
        }

        // Pequeno delay para não sobrecarregar
        if (result.success) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return results;
}

// Testa a conexão SMTP
async function testConnection(config = {}) {
    try {
        const transporter = config.host ? createTransporter(config) : getDefaultTransporter();
        await transporter.verify();
        return { success: true, message: 'Conexão SMTP válida' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    sendEmail,
    sendTemplateEmail,
    sendBulkEmails,
    testConnection,
    createTransporter,
    EMAIL_TEMPLATES,
    // Re-exporta geradores para uso customizado
    generateNPSSurveyEmail,
    generateThankYouEmail,
    generateFollowUpEmail,
    generateReminderEmail
};
