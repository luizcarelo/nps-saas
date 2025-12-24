#!/usr/bin/env node
// ============================================
// NPS MANAGER V5 - DADOS DE TESTE COMPLETOS
// ============================================
// Uso: node scripts/seed-full-demo.js
//
// Cria um ambiente completo de demonstração com:
// - SuperAdmin
// - Planos
// - Tenant com usuários
// - 50 clientes segmentados
// - 5 campanhas (3 finalizadas, 1 ativa, 1 rascunho)
// - 150+ respostas NPS com distribuição realista
// - Mensagens de chat
// - Tratativas de detratores

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// ============================================
// CONFIGURAÇÕES
// ============================================

const TENANT_NAME = 'Segurança Total Ltda';
const TENANT_SLUG = 'seguranca-total';

// ============================================
// DADOS
// ============================================

const PLANS = [
    {
        name: 'FREE',
        displayName: 'Gratuito',
        description: 'Para começar',
        priceMonthly: 0,
        priceYearly: 0,
        maxUsers: 1,
        maxCustomers: 50,
        maxCampaigns: 2,
        maxEmailsMonth: 100,
        maxWhatsappMonth: 0,
        hasWhatsapp: false,
        hasEmail: true,
        hasApi: false,
        hasReports: false,
        hasAiAnalysis: false,
        features: ['50 clientes', '2 campanhas', 'Email básico'],
        sortOrder: 1
    },
    {
        name: 'STARTER',
        displayName: 'Starter',
        description: 'Pequenas empresas',
        priceMonthly: 97,
        priceYearly: 970,
        maxUsers: 3,
        maxCustomers: 500,
        maxCampaigns: 10,
        maxEmailsMonth: 1000,
        maxWhatsappMonth: 200,
        hasWhatsapp: true,
        hasEmail: true,
        hasApi: false,
        hasReports: true,
        hasAiAnalysis: false,
        features: ['500 clientes', 'WhatsApp', 'Relatórios'],
        sortOrder: 2
    },
    {
        name: 'PRO',
        displayName: 'Profissional',
        description: 'Empresas em crescimento',
        priceMonthly: 197,
        priceYearly: 1970,
        maxUsers: 10,
        maxCustomers: 2000,
        maxCampaigns: 50,
        maxEmailsMonth: 5000,
        maxWhatsappMonth: 1000,
        hasWhatsapp: true,
        hasEmail: true,
        hasApi: true,
        hasReports: true,
        hasAiAnalysis: true,
        features: ['2.000 clientes', 'API', 'IA', 'Marca própria'],
        sortOrder: 3
    },
    {
        name: 'ENTERPRISE',
        displayName: 'Enterprise',
        description: 'Grandes empresas',
        priceMonthly: 497,
        priceYearly: 4970,
        maxUsers: 999,
        maxCustomers: 999999,
        maxCampaigns: 999,
        maxEmailsMonth: 50000,
        maxWhatsappMonth: 10000,
        hasWhatsapp: true,
        hasEmail: true,
        hasApi: true,
        hasReports: true,
        hasAiAnalysis: true,
        hasPrioritySupport: true,
        features: ['Ilimitado', 'Suporte VIP', 'SLA'],
        sortOrder: 4
    }
];

const CUSTOMERS = [
    // Sudeste - Tecnologia
    { name: 'TechCorp Solutions', email: 'contato@techcorp.com.br', phone: '5511999001001', sector: 'Tecnologia', regional: 'Sudeste', role: 'Gerente de TI', companyName: 'TechCorp Solutions' },
    { name: 'DataSoft Sistemas', email: 'comercial@datasoft.com.br', phone: '5511999001002', sector: 'Tecnologia', regional: 'Sudeste', role: 'Diretor', companyName: 'DataSoft Sistemas' },
    { name: 'CloudMaster', email: 'suporte@cloudmaster.io', phone: '5521999001003', sector: 'Tecnologia', regional: 'Sudeste', role: 'CEO', companyName: 'CloudMaster' },
    { name: 'AppDev Labs', email: 'contato@appdevlabs.com', phone: '5511999001004', sector: 'Tecnologia', regional: 'Sudeste', role: 'CTO', companyName: 'AppDev Labs' },
    { name: 'NetSecurity Pro', email: 'vendas@netsecpro.com.br', phone: '5521999001005', sector: 'Tecnologia', regional: 'Sudeste', role: 'Gerente', companyName: 'NetSecurity Pro' },
    
    // Sudeste - Varejo
    { name: 'MegaStore Central', email: 'sac@megastore.com.br', phone: '5511999002001', sector: 'Varejo', regional: 'Sudeste', role: 'Gerente de Loja', companyName: 'MegaStore Central' },
    { name: 'Fashion Plus', email: 'contato@fashionplus.com.br', phone: '5511999002002', sector: 'Varejo', regional: 'Sudeste', role: 'Proprietário', companyName: 'Fashion Plus' },
    { name: 'Eletro Center', email: 'vendas@eletrocenter.com', phone: '5521999002003', sector: 'Varejo', regional: 'Sudeste', role: 'Diretor Comercial', companyName: 'Eletro Center' },
    { name: 'SuperMercado Economia', email: 'gerencia@supeconomia.com.br', phone: '5531999002004', sector: 'Varejo', regional: 'Sudeste', role: 'Gerente', companyName: 'SuperMercado Economia' },
    { name: 'Móveis & Decoração', email: 'atendimento@moveisdeco.com.br', phone: '5511999002005', sector: 'Varejo', regional: 'Sudeste', role: 'Sócio', companyName: 'Móveis & Decoração' },
    
    // Sudeste - Saúde
    { name: 'Clínica Vida Saudável', email: 'recepcao@clinicavida.med.br', phone: '5511999003001', sector: 'Saúde', regional: 'Sudeste', role: 'Administrador', companyName: 'Clínica Vida Saudável' },
    { name: 'Hospital São Lucas', email: 'diretoria@hsaolucas.org.br', phone: '5521999003002', sector: 'Saúde', regional: 'Sudeste', role: 'Diretor Geral', companyName: 'Hospital São Lucas' },
    { name: 'Lab Diagnóstico Total', email: 'contato@labdiagnostico.com.br', phone: '5511999003003', sector: 'Saúde', regional: 'Sudeste', role: 'Gerente', companyName: 'Lab Diagnóstico Total' },
    { name: 'Farmácia Saúde & Bem', email: 'sac@farmsaudebem.com.br', phone: '5531999003004', sector: 'Saúde', regional: 'Sudeste', role: 'Farmacêutico Resp.', companyName: 'Farmácia Saúde & Bem' },
    { name: 'Odonto Smile', email: 'agendamento@odontosmile.com.br', phone: '5521999003005', sector: 'Saúde', regional: 'Sudeste', role: 'Dentista', companyName: 'Odonto Smile' },
    
    // Sul - Diversos
    { name: 'Construtora Sul', email: 'obras@construtorasul.com.br', phone: '5541999004001', sector: 'Construção', regional: 'Sul', role: 'Engenheiro Chefe', companyName: 'Construtora Sul' },
    { name: 'Agro Sul Máquinas', email: 'vendas@agrosulmaq.com.br', phone: '5551999004002', sector: 'Agronegócio', regional: 'Sul', role: 'Diretor', companyName: 'Agro Sul Máquinas' },
    { name: 'Transportadora Rápido Sul', email: 'logistica@rapidosul.com.br', phone: '5541999004003', sector: 'Logística', regional: 'Sul', role: 'Gerente de Operações', companyName: 'Transportadora Rápido Sul' },
    { name: 'Hotel Bela Vista', email: 'reservas@belavista.com.br', phone: '5548999004004', sector: 'Hotelaria', regional: 'Sul', role: 'Gerente Geral', companyName: 'Hotel Bela Vista' },
    { name: 'Restaurante Sabor do Sul', email: 'contato@sabordosul.com.br', phone: '5551999004005', sector: 'Alimentação', regional: 'Sul', role: 'Chef', companyName: 'Restaurante Sabor do Sul' },
    { name: 'Vinícola Serra Gaúcha', email: 'vendas@vinicolaserra.com.br', phone: '5554999004006', sector: 'Bebidas', regional: 'Sul', role: 'Enólogo', companyName: 'Vinícola Serra Gaúcha' },
    { name: 'TI Solutions Porto', email: 'suporte@tisolutions.com.br', phone: '5551999004007', sector: 'Tecnologia', regional: 'Sul', role: 'Analista', companyName: 'TI Solutions Porto' },
    { name: 'Escola Futuro Brilhante', email: 'secretaria@futurobrilhante.edu.br', phone: '5541999004008', sector: 'Educação', regional: 'Sul', role: 'Diretor', companyName: 'Escola Futuro Brilhante' },
    
    // Nordeste
    { name: 'Nordeste Telecom', email: 'comercial@netelecom.com.br', phone: '5571999005001', sector: 'Telecomunicações', regional: 'Nordeste', role: 'Gerente Comercial', companyName: 'Nordeste Telecom' },
    { name: 'Construtora Recife', email: 'projetos@construtorarecife.com.br', phone: '5581999005002', sector: 'Construção', regional: 'Nordeste', role: 'Arquiteto', companyName: 'Construtora Recife' },
    { name: 'Resort Praia Dourada', email: 'reservas@praiadourada.com.br', phone: '5583999005003', sector: 'Hotelaria', regional: 'Nordeste', role: 'Gerente', companyName: 'Resort Praia Dourada' },
    { name: 'Distribuidora Nordeste', email: 'pedidos@distnordeste.com.br', phone: '5585999005004', sector: 'Distribuição', regional: 'Nordeste', role: 'Diretor', companyName: 'Distribuidora Nordeste' },
    { name: 'Clínica Salvador Saúde', email: 'atendimento@salvasaude.com.br', phone: '5571999005005', sector: 'Saúde', regional: 'Nordeste', role: 'Médico', companyName: 'Clínica Salvador Saúde' },
    { name: 'Auto Peças Fortaleza', email: 'vendas@autopecasfort.com.br', phone: '5585999005006', sector: 'Automotivo', regional: 'Nordeste', role: 'Proprietário', companyName: 'Auto Peças Fortaleza' },
    
    // Centro-Oeste
    { name: 'Agropecuária Goiás', email: 'comercial@agrogoias.com.br', phone: '5562999006001', sector: 'Agronegócio', regional: 'Centro-Oeste', role: 'Produtor', companyName: 'Agropecuária Goiás' },
    { name: 'Construtora Capital', email: 'projetos@construtoracapital.com.br', phone: '5561999006002', sector: 'Construção', regional: 'Centro-Oeste', role: 'Engenheiro', companyName: 'Construtora Capital' },
    { name: 'Indústria Alimentícia MT', email: 'comercial@indalimt.com.br', phone: '5565999006003', sector: 'Alimentação', regional: 'Centro-Oeste', role: 'Diretor Industrial', companyName: 'Indústria Alimentícia MT' },
    { name: 'Logística Centro Brasil', email: 'operacoes@logcentro.com.br', phone: '5562999006004', sector: 'Logística', regional: 'Centro-Oeste', role: 'Coordenador', companyName: 'Logística Centro Brasil' },
    { name: 'Concessionária Brasília', email: 'vendas@concessbrasilia.com.br', phone: '5561999006005', sector: 'Automotivo', regional: 'Centro-Oeste', role: 'Gerente de Vendas', companyName: 'Concessionária Brasília' },
    
    // Norte
    { name: 'Mineradora Amazônia', email: 'operacoes@mineraamazonia.com.br', phone: '5591999007001', sector: 'Mineração', regional: 'Norte', role: 'Diretor de Operações', companyName: 'Mineradora Amazônia' },
    { name: 'Madeireira Norte', email: 'comercial@madeireiranorte.com.br', phone: '5592999007002', sector: 'Madeireiro', regional: 'Norte', role: 'Gerente', companyName: 'Madeireira Norte' },
    { name: 'Frigorífico Rondônia', email: 'vendas@frigoro.com.br', phone: '5569999007003', sector: 'Alimentação', regional: 'Norte', role: 'Diretor', companyName: 'Frigorífico Rondônia' },
    { name: 'Transportes Amazonas', email: 'logistica@transpamazonas.com.br', phone: '5592999007004', sector: 'Logística', regional: 'Norte', role: 'Coordenador', companyName: 'Transportes Amazonas' },
    { name: 'Hotel Tropical Manaus', email: 'reservas@tropicalmanaus.com.br', phone: '5592999007005', sector: 'Hotelaria', regional: 'Norte', role: 'Gerente Geral', companyName: 'Hotel Tropical Manaus' },
    
    // Mais clientes Sudeste (para ter volume)
    { name: 'Escritório Advocacia Silva', email: 'contato@silvaadvogados.com.br', phone: '5511999008001', sector: 'Serviços', regional: 'Sudeste', role: 'Advogado Sócio', companyName: 'Silva Advogados' },
    { name: 'Contabilidade Exata', email: 'fiscal@contabilexata.com.br', phone: '5511999008002', sector: 'Serviços', regional: 'Sudeste', role: 'Contador', companyName: 'Contabilidade Exata' },
    { name: 'Imobiliária Central', email: 'vendas@imobcentral.com.br', phone: '5521999008003', sector: 'Imobiliário', regional: 'Sudeste', role: 'Corretor Chefe', companyName: 'Imobiliária Central' },
    { name: 'Academia Fitness Plus', email: 'contato@fitnessplus.com.br', phone: '5511999008004', sector: 'Saúde', regional: 'Sudeste', role: 'Proprietário', companyName: 'Academia Fitness Plus' },
    { name: 'Pet Shop Animal Love', email: 'atendimento@animallove.com.br', phone: '5511999008005', sector: 'Pet', regional: 'Sudeste', role: 'Gerente', companyName: 'Pet Shop Animal Love' },
    { name: 'Gráfica Express Print', email: 'orcamentos@expressprint.com.br', phone: '5521999008006', sector: 'Gráfica', regional: 'Sudeste', role: 'Diretor', companyName: 'Gráfica Express Print' },
    { name: 'Seguradora Confiança', email: 'seguros@segconfianca.com.br', phone: '5511999008007', sector: 'Financeiro', regional: 'Sudeste', role: 'Corretor', companyName: 'Seguradora Confiança' },
    { name: 'Banco Digital Plus', email: 'suporte@bancodigitalplus.com.br', phone: '5511999008008', sector: 'Financeiro', regional: 'Sudeste', role: 'Gerente de Contas', companyName: 'Banco Digital Plus' },
    { name: 'Fintech Invest', email: 'contato@fintechinvest.com.br', phone: '5521999008009', sector: 'Financeiro', regional: 'Sudeste', role: 'Analista', companyName: 'Fintech Invest' },
    { name: 'Corretora Capital', email: 'investimentos@corretoracapital.com.br', phone: '5511999008010', sector: 'Financeiro', regional: 'Sudeste', role: 'Assessor', companyName: 'Corretora Capital' },
];

const CAMPAIGNS = [
    {
        name: 'Pesquisa de Satisfação Q3 2024',
        description: 'Avaliação trimestral de satisfação dos clientes',
        channel: 'WHATSAPP',
        template: 'PADRAO',
        status: 'COMPLETED',
        daysAgo: 90,
        completedDaysAgo: 75,
        targetPercentage: 0.8 // 80% dos clientes
    },
    {
        name: 'NPS Pós-Implementação',
        description: 'Feedback após instalação de novos sistemas',
        channel: 'EMAIL',
        template: 'FORMAL',
        status: 'COMPLETED',
        daysAgo: 60,
        completedDaysAgo: 45,
        targetPercentage: 0.5
    },
    {
        name: 'Pesquisa Mensal Novembro',
        description: 'Acompanhamento mensal de satisfação',
        channel: 'WHATSAPP',
        template: 'AMIGAVEL',
        status: 'COMPLETED',
        daysAgo: 30,
        completedDaysAgo: 20,
        targetPercentage: 0.6
    },
    {
        name: 'Avaliação Suporte Técnico',
        description: 'Pesquisa de qualidade do atendimento',
        channel: 'WHATSAPP',
        template: 'PADRAO',
        status: 'ACTIVE',
        daysAgo: 5,
        completedDaysAgo: null,
        targetPercentage: 0.4
    },
    {
        name: 'Campanha Dezembro 2024',
        description: 'Pesquisa de fim de ano',
        channel: 'EMAIL',
        template: 'FORMAL',
        status: 'DRAFT',
        daysAgo: 1,
        completedDaysAgo: null,
        targetPercentage: 0
    }
];

const COMMENTS_BY_SCORE = {
    10: [
        'Excelente! Melhor empresa de segurança que já contratamos.',
        'Serviço impecável, equipe muito profissional!',
        'Superou todas as expectativas. Parabéns!',
        'Atendimento nota 10! Recomendo para todos.',
        'Empresa séria e comprometida. Muito satisfeito!',
        'Monitoramento 24h funcionando perfeitamente.',
        'Técnicos muito competentes e educados.'
    ],
    9: [
        'Muito bom! Pequenos ajustes e fica perfeito.',
        'Ótimo serviço, apenas o app poderia melhorar.',
        'Satisfeito com a segurança, atendimento excelente.',
        'Recomendo! Só achei o preço um pouco alto.',
        'Equipe técnica muito boa, resposta rápida.',
        'Empresa confiável, sistema funciona bem.'
    ],
    8: [
        'Bom serviço, mas o suporte demora às vezes.',
        'Satisfeito, mas poderia ter mais opções de câmeras.',
        'Funciona bem, preço compatível com o mercado.',
        'Atendimento ok, sistema estável.',
        'Sem grandes problemas, mas nada extraordinário.'
    ],
    7: [
        'Razoável. Esperava um pouco mais pelo preço pago.',
        'Sistema funciona, mas o app trava às vezes.',
        'Atendimento poderia ser mais ágil.',
        'Cumpre o básico, nada além disso.',
        'Serviço mediano, já vi melhores e piores.'
    ],
    6: [
        'Abaixo do esperado. Muitas falhas no sistema.',
        'Suporte técnico muito demorado.',
        'Preço não condiz com a qualidade.',
        'Tive problemas com a instalação.',
        'Falta comunicação da equipe.'
    ],
    5: [
        'Decepcionado. Muitos problemas sem solução.',
        'Atendimento péssimo, demora muito para resolver.',
        'Sistema cai frequentemente.',
        'Não recomendo, experiência ruim.'
    ],
    4: [
        'Muito ruim. Estou pensando em cancelar.',
        'Falhas constantes, suporte não resolve.',
        'Arrependido de ter contratado.'
    ],
    3: [
        'Péssimo! Nenhum problema foi resolvido.',
        'Empresa não cumpre o que promete.',
        'Vou cancelar e pedir reembolso.'
    ],
    2: [
        'Horrível! Pior empresa que já contratei.',
        'Golpe! Não entregam o que prometem.'
    ],
    1: [
        'Absurdo! Vou processar essa empresa.',
        'Fraude total, não contratem!'
    ],
    0: [
        'Zero estrelas se pudesse. Empresa criminosa!'
    ]
};

const TREATMENT_NOTES = [
    'Cliente contatado por telefone. Situação resolvida após visita técnica.',
    'Enviado técnico para ajuste no sistema. Cliente satisfeito com a solução.',
    'Oferecido desconto de 20% na próxima mensalidade. Cliente aceitou continuar.',
    'Realizada visita gerencial. Implementadas melhorias solicitadas.',
    'Problema identificado e corrigido. Cliente receberá acompanhamento mensal.',
    'Agendada reunião presencial para entender melhor as necessidades.',
    'Substituído equipamento defeituoso. Cliente voltou a avaliar positivamente.',
    'Realizado treinamento adicional para equipe do cliente.',
    'Ativado canal VIP de atendimento para este cliente.',
    'Upgrade gratuito do plano por 3 meses como compensação.'
];

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function randomDate(daysAgo, variance = 5) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo + Math.floor(Math.random() * variance * 2) - variance);
    date.setHours(Math.floor(Math.random() * 14) + 8); // 8h às 22h
    date.setMinutes(Math.floor(Math.random() * 60));
    return date;
}

function generateScore() {
    // Distribuição realista: ~55% promotores, ~25% neutros, ~20% detratores
    const rand = Math.random();
    if (rand < 0.30) return 10;
    if (rand < 0.55) return 9;
    if (rand < 0.70) return 8;
    if (rand < 0.80) return 7;
    if (rand < 0.85) return 6;
    if (rand < 0.90) return 5;
    if (rand < 0.94) return 4;
    if (rand < 0.97) return 3;
    if (rand < 0.99) return 2;
    return Math.floor(Math.random() * 2); // 0 ou 1
}

function getRandomComment(score) {
    const comments = COMMENTS_BY_SCORE[score] || COMMENTS_BY_SCORE[5];
    return comments[Math.floor(Math.random() * comments.length)];
}

function generateToken() {
    return uuidv4().replace(/-/g, '').substring(0, 16);
}

function getSentiment(score) {
    if (score >= 9) return 'POSITIVE';
    if (score >= 7) return 'NEUTRAL';
    return 'NEGATIVE';
}

function getTags(score, comment) {
    const tags = [];
    const lower = (comment || '').toLowerCase();
    
    if (lower.includes('atendimento') || lower.includes('suporte')) tags.push('ATENDIMENTO');
    if (lower.includes('preço') || lower.includes('valor') || lower.includes('caro')) tags.push('PRECO');
    if (lower.includes('sistema') || lower.includes('app') || lower.includes('trava')) tags.push('TECNOLOGIA');
    if (lower.includes('técnico') || lower.includes('instalação')) tags.push('TECNICO');
    if (lower.includes('demora') || lower.includes('lento')) tags.push('TEMPO');
    
    if (score >= 9) tags.push('PROMOTOR');
    else if (score <= 6) tags.push('DETRATOR');
    
    return tags;
}

// ============================================
// MAIN
// ============================================

async function seedFullDemo() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║         NPS MANAGER V5 - GERAÇÃO DE DADOS COMPLETOS              ║
╚══════════════════════════════════════════════════════════════════╝
`);

    try {
        // 1. LIMPAR DADOS EXISTENTES
        console.log('🧹 Limpando dados anteriores...');
        
        const existingTenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } });
        if (existingTenant) {
            await prisma.chatMessage.deleteMany({ where: { tenantId: existingTenant.id } });
            await prisma.nPSResponse.deleteMany({ where: { campaign: { tenantId: existingTenant.id } } });
            await prisma.campaign.deleteMany({ where: { tenantId: existingTenant.id } });
            await prisma.customer.deleteMany({ where: { tenantId: existingTenant.id } });
            await prisma.user.deleteMany({ where: { tenantId: existingTenant.id } });
            await prisma.tenantSettings.deleteMany({ where: { tenantId: existingTenant.id } });
            await prisma.tenant.delete({ where: { id: existingTenant.id } });
        }
        
        // 2. SUPER ADMIN
        console.log('🔐 Criando SuperAdmin...');
        await prisma.superAdmin.upsert({
            where: { email: 'superadmin@npsmanager.com' },
            update: { password: await bcrypt.hash('Super@123', 10) },
            create: {
                email: 'superadmin@npsmanager.com',
                password: await bcrypt.hash('Super@123', 10),
                name: 'Super Administrador',
                role: 'SUPER_ADMIN'
            }
        });
        console.log('   ✅ superadmin@npsmanager.com / Super@123');

        // 3. PLANOS
        console.log('\n💰 Criando planos...');
        for (const plan of PLANS) {
            await prisma.plan.upsert({
                where: { name: plan.name },
                update: plan,
                create: plan
            });
            console.log(`   ✅ ${plan.displayName} - R$ ${plan.priceMonthly}/mês`);
        }

        const proPlan = await prisma.plan.findUnique({ where: { name: 'PRO' } });

        // 4. TENANT
        console.log('\n🏢 Criando tenant...');
        const tenant = await prisma.tenant.create({
            data: {
                name: TENANT_NAME,
                slug: TENANT_SLUG,
                planId: proPlan.id,
                isActive: true,
                isTrial: false,
                ownerName: 'Carlos Roberto Silva',
                ownerEmail: 'carlos@segurancatotal.com.br',
                ownerPhone: '5511999999999',
                document: '12.345.678/0001-90',
                city: 'São Paulo',
                state: 'SP',
                settings: {
                    create: {
                        brandColor: '#4F46E5',
                        companyEmail: 'nps@segurancatotal.com.br'
                    }
                }
            }
        });
        console.log(`   ✅ ${TENANT_NAME}`);

        // 5. USUÁRIOS
        console.log('\n👥 Criando usuários...');
        
        // Limpa usuários existentes com esses emails (de outros tenants)
        await prisma.user.deleteMany({
            where: {
                email: { in: ['admin@nps.com', 'gerente@nps.com', 'analista@nps.com'] }
            }
        });
        
        const users = [
            { email: 'admin@nps.com', password: 'admin123', name: 'Administrador', role: 'ADMIN' },
            { email: 'gerente@nps.com', password: 'gerente123', name: 'Maria Gerente', role: 'MANAGER' },
            { email: 'analista@nps.com', password: 'analista123', name: 'João Analista', role: 'VIEWER' }
        ];
        
        const createdUsers = [];
        for (const u of users) {
            const user = await prisma.user.upsert({
                where: { email: u.email },
                update: {
                    password: await bcrypt.hash(u.password, 10),
                    name: u.name,
                    role: u.role,
                    tenantId: tenant.id
                },
                create: {
                    email: u.email,
                    password: await bcrypt.hash(u.password, 10),
                    name: u.name,
                    role: u.role,
                    tenantId: tenant.id
                }
            });
            createdUsers.push(user);
            console.log(`   ✅ ${u.email} / ${u.password}`);
        }

        // 6. CLIENTES
        console.log(`\n👥 Criando ${CUSTOMERS.length} clientes...`);
        const createdCustomers = [];
        for (const c of CUSTOMERS) {
            const customer = await prisma.customer.create({
                data: { ...c, tenantId: tenant.id, isActive: true }
            });
            createdCustomers.push(customer);
        }
        console.log(`   ✅ ${createdCustomers.length} clientes criados`);

        // 7. CAMPANHAS E RESPOSTAS
        console.log('\n📊 Criando campanhas e respostas...');
        
        let totalResponses = 0;
        let totalPromoters = 0;
        let totalNeutrals = 0;
        let totalDetractors = 0;
        
        for (const campaignData of CAMPAIGNS) {
            const targetCount = Math.floor(createdCustomers.length * campaignData.targetPercentage);
            const shuffledCustomers = [...createdCustomers].sort(() => Math.random() - 0.5);
            const targetCustomers = shuffledCustomers.slice(0, targetCount);
            
            const sentAt = randomDate(campaignData.daysAgo);
            const completedAt = campaignData.completedDaysAgo ? randomDate(campaignData.completedDaysAgo) : null;
            
            const campaign = await prisma.campaign.create({
                data: {
                    name: campaignData.name,
                    description: campaignData.description,
                    channel: campaignData.channel,
                    template: campaignData.template,
                    status: campaignData.status,
                    startedAt: campaignData.status !== 'DRAFT' ? sentAt : null,
                    completedAt,
                    totalSent: targetCount,
                    tenantId: tenant.id
                }
            });
            
            let answered = 0;
            let campaignPromoters = 0;
            let campaignDetractors = 0;
            
            for (const customer of targetCustomers) {
                const willAnswer = campaignData.status === 'COMPLETED' ? Math.random() < 0.75 : Math.random() < 0.3;
                const hasComment = Math.random() < 0.7;
                
                const score = willAnswer ? generateScore() : null;
                const comment = willAnswer && hasComment ? getRandomComment(score) : null;
                
                const responseSentAt = new Date(sentAt.getTime() + Math.random() * 2 * 60 * 60 * 1000);
                const answeredAt = willAnswer ? new Date(responseSentAt.getTime() + Math.random() * 48 * 60 * 60 * 1000) : null;
                
                // Tratativa para detratores (70% tratados se campanha finalizada)
                let treatmentStatus = 'NOT_REQUIRED';
                let treatmentNotes = null;
                let treatedAt = null;
                let treatedById = null;
                
                if (score !== null && score <= 6) {
                    if (campaignData.status === 'COMPLETED' && Math.random() < 0.7) {
                        treatmentStatus = 'COMPLETED';
                        treatmentNotes = TREATMENT_NOTES[Math.floor(Math.random() * TREATMENT_NOTES.length)];
                        treatedAt = new Date(answeredAt.getTime() + Math.random() * 72 * 60 * 60 * 1000);
                        treatedById = createdUsers[Math.floor(Math.random() * 2)].id; // Admin ou Gerente
                    } else {
                        treatmentStatus = 'PENDING';
                    }
                    campaignDetractors++;
                    totalDetractors++;
                } else if (score >= 9) {
                    campaignPromoters++;
                    totalPromoters++;
                } else if (score >= 7) {
                    totalNeutrals++;
                }
                
                await prisma.nPSResponse.create({
                    data: {
                        token: generateToken(),
                        score,
                        comment,
                        status: willAnswer ? 'ANSWERED' : (campaignData.status === 'DRAFT' ? 'PENDING' : 'SENT'),
                        channel: campaignData.channel,
                        sentiment: score !== null ? getSentiment(score) : null,
                        tags: score !== null ? getTags(score, comment) : [],
                        treatmentStatus,
                        treatmentNotes,
                        treatedAt,
                        treatedById,
                        sentAt: campaignData.status !== 'DRAFT' ? responseSentAt : null,
                        answeredAt,
                        campaignId: campaign.id,
                        customerId: customer.id,
                        metadata: { stage: willAnswer ? 'DONE' : 'VOTE' }
                    }
                });
                
                if (willAnswer) answered++;
                totalResponses++;
            }
            
            // Atualiza contadores da campanha
            await prisma.campaign.update({
                where: { id: campaign.id },
                data: { totalAnswered: answered }
            });
            
            console.log(`   ✅ ${campaignData.name}: ${targetCount} enviados, ${answered} respondidos`);
        }

        // 8. MENSAGENS DE CHAT (simulando algumas conversas)
        console.log('\n💬 Criando mensagens de chat...');
        
        const chatCustomers = createdCustomers.slice(0, 5);
        for (const customer of chatCustomers) {
            // Mensagem do cliente
            await prisma.chatMessage.create({
                data: {
                    content: 'Olá, gostaria de saber mais sobre o serviço de monitoramento.',
                    direction: 'incoming',
                    status: 'read',
                    phone: customer.phone,
                    customerId: customer.id,
                    customerName: customer.name,
                    tenantId: tenant.id,
                    readAt: new Date(),
                    createdAt: randomDate(2)
                }
            });
            
            // Resposta do atendente
            await prisma.chatMessage.create({
                data: {
                    content: 'Olá! Claro, nosso serviço inclui monitoramento 24h com câmeras de alta definição. Posso enviar mais detalhes?',
                    direction: 'outgoing',
                    status: 'delivered',
                    phone: customer.phone,
                    customerId: customer.id,
                    customerName: customer.name,
                    tenantId: tenant.id,
                    createdAt: randomDate(2)
                }
            });
        }
        console.log(`   ✅ ${chatCustomers.length * 2} mensagens criadas`);

        // 9. RESUMO FINAL
        const npsScore = Math.round(((totalPromoters - totalDetractors) / (totalPromoters + totalNeutrals + totalDetractors)) * 100);
        
        console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    ✅ DADOS CRIADOS COM SUCESSO!                 ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  📊 ESTATÍSTICAS                                                 ║
║                                                                  ║
║     Clientes:        ${String(createdCustomers.length).padEnd(40)}║
║     Campanhas:       ${String(CAMPAIGNS.length).padEnd(40)}║
║     Respostas NPS:   ${String(totalResponses).padEnd(40)}║
║                                                                  ║
║     Promotores:      ${String(totalPromoters).padEnd(40)}║
║     Neutros:         ${String(totalNeutrals).padEnd(40)}║
║     Detratores:      ${String(totalDetractors).padEnd(40)}║
║                                                                  ║
║     🎯 NPS SCORE:    ${String(npsScore).padEnd(40)}║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  🔐 ACESSOS                                                      ║
║                                                                  ║
║  SuperAdmin:                                                     ║
║     URL:   http://localhost:3000/superadmin                      ║
║     Email: superadmin@npsmanager.com                             ║
║     Senha: Super@123                                             ║
║                                                                  ║
║  App NPS:                                                        ║
║     URL:   http://localhost:3000                                 ║
║     Email: admin@nps.com                                         ║
║     Senha: admin123                                              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);

    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

seedFullDemo();