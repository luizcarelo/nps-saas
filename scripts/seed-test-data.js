#!/usr/bin/env node
// ============================================
// NPS MANAGER V5 - DADOS DE TESTE
// ============================================
// Uso: node scripts/seed-test-data.js [--with-responses] [--tenant-slug]
//
// Cria um tenant completo com clientes, campanhas e respostas de exemplo

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

// Parse argumentos
const args = process.argv.slice(2);
const withResponses = args.includes('--with-responses') || args.includes('-r');
const tenantSlugArg = args.find(a => !a.startsWith('-'));

// ============================================
// DADOS DE EXEMPLO
// ============================================

const PLANS_DATA = [
    {
        name: 'FREE',
        displayName: 'Gratuito',
        description: 'Ideal para começar',
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
        hasCustomBranding: false,
        hasPrioritySupport: false,
        features: ['50 clientes', '2 campanhas/mês', 'Email básico'],
        sortOrder: 1
    },
    {
        name: 'STARTER',
        displayName: 'Starter',
        description: 'Para pequenos negócios',
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
        hasCustomBranding: false,
        hasPrioritySupport: false,
        features: ['500 clientes', '10 campanhas/mês', 'WhatsApp', 'Relatórios básicos'],
        sortOrder: 2
    },
    {
        name: 'PRO',
        displayName: 'Profissional',
        description: 'Para empresas em crescimento',
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
        hasCustomBranding: true,
        hasPrioritySupport: false,
        features: ['2.000 clientes', '50 campanhas/mês', 'API', 'IA', 'Marca própria'],
        sortOrder: 3
    },
    {
        name: 'ENTERPRISE',
        displayName: 'Enterprise',
        description: 'Solução completa para grandes empresas',
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
        hasCustomBranding: true,
        hasPrioritySupport: true,
        features: ['Ilimitado', 'Suporte prioritário', 'API dedicada', 'SLA'],
        sortOrder: 4
    }
];

const CUSTOMERS_DATA = [
    { name: 'João Silva', email: 'joao.silva@email.com', phone: '5511999001001', sector: 'Tecnologia', regional: 'Sudeste', role: 'Gerente', companyName: 'TechCorp' },
    { name: 'Maria Santos', email: 'maria.santos@email.com', phone: '5511999001002', sector: 'Varejo', regional: 'Sul', role: 'Diretor', companyName: 'Loja Central' },
    { name: 'Pedro Oliveira', email: 'pedro.oliveira@email.com', phone: '5521999001003', sector: 'Saúde', regional: 'Sudeste', role: 'Coordenador', companyName: 'Clínica Vida' },
    { name: 'Ana Costa', email: 'ana.costa@email.com', phone: '5531999001004', sector: 'Financeiro', regional: 'Sudeste', role: 'Analista', companyName: 'Banco Futuro' },
    { name: 'Carlos Souza', email: 'carlos.souza@email.com', phone: '5541999001005', sector: 'Serviços', regional: 'Sul', role: 'CEO', companyName: 'CS Consultoria' },
    { name: 'Fernanda Lima', email: 'fernanda.lima@email.com', phone: '5551999001006', sector: 'Tecnologia', regional: 'Sul', role: 'Gerente', companyName: 'DevSoft' },
    { name: 'Ricardo Alves', email: 'ricardo.alves@email.com', phone: '5561999001007', sector: 'Varejo', regional: 'Centro-Oeste', role: 'Diretor', companyName: 'MegaStore' },
    { name: 'Patrícia Rocha', email: 'patricia.rocha@email.com', phone: '5571999001008', sector: 'Saúde', regional: 'Nordeste', role: 'Coordenador', companyName: 'Hospital Norte' },
    { name: 'Bruno Martins', email: 'bruno.martins@email.com', phone: '5581999001009', sector: 'Financeiro', regional: 'Nordeste', role: 'Analista', companyName: 'Invest+' },
    { name: 'Camila Ferreira', email: 'camila.ferreira@email.com', phone: '5591999001010', sector: 'Serviços', regional: 'Norte', role: 'Gerente', companyName: 'Norte Serviços' },
    { name: 'Diego Barbosa', email: 'diego.barbosa@email.com', phone: '5511999001011', sector: 'Tecnologia', regional: 'Sudeste', role: 'CEO', companyName: 'AppMaster' },
    { name: 'Juliana Mendes', email: 'juliana.mendes@email.com', phone: '5521999001012', sector: 'Varejo', regional: 'Sudeste', role: 'Diretor', companyName: 'Fashion Store' },
    { name: 'Marcos Paulo', email: 'marcos.paulo@email.com', phone: '5531999001013', sector: 'Saúde', regional: 'Sudeste', role: 'Gerente', companyName: 'Farmácia Saúde' },
    { name: 'Larissa Gomes', email: 'larissa.gomes@email.com', phone: '5541999001014', sector: 'Financeiro', regional: 'Sul', role: 'Analista', companyName: 'Corretora Sul' },
    { name: 'Thiago Nunes', email: 'thiago.nunes@email.com', phone: '5551999001015', sector: 'Serviços', regional: 'Sul', role: 'Coordenador', companyName: 'Tech Support' },
    { name: 'Beatriz Castro', email: 'beatriz.castro@email.com', phone: '5561999001016', sector: 'Tecnologia', regional: 'Centro-Oeste', role: 'Gerente', companyName: 'CloudTech' },
    { name: 'Rafael Torres', email: 'rafael.torres@email.com', phone: '5571999001017', sector: 'Varejo', regional: 'Nordeste', role: 'Diretor', companyName: 'Mercado Mais' },
    { name: 'Isabela Dias', email: 'isabela.dias@email.com', phone: '5581999001018', sector: 'Saúde', regional: 'Nordeste', role: 'CEO', companyName: 'Lab Diagnóstico' },
    { name: 'Lucas Cardoso', email: 'lucas.cardoso@email.com', phone: '5591999001019', sector: 'Financeiro', regional: 'Norte', role: 'Gerente', companyName: 'Crédito Norte' },
    { name: 'Amanda Ribeiro', email: 'amanda.ribeiro@email.com', phone: '5511999001020', sector: 'Serviços', regional: 'Sudeste', role: 'Analista', companyName: 'RH Plus' },
    { name: 'Felipe Moreira', email: 'felipe.moreira@email.com', phone: '5521999001021', sector: 'Tecnologia', regional: 'Sudeste', role: 'Coordenador', companyName: 'DataSys' },
    { name: 'Gabriela Vieira', email: 'gabriela.vieira@email.com', phone: '5531999001022', sector: 'Varejo', regional: 'Sudeste', role: 'Diretor', companyName: 'E-Commerce Pro' },
    { name: 'Henrique Lopes', email: 'henrique.lopes@email.com', phone: '5541999001023', sector: 'Saúde', regional: 'Sul', role: 'Gerente', companyName: 'Odonto Smile' },
    { name: 'Letícia Campos', email: 'leticia.campos@email.com', phone: '5551999001024', sector: 'Financeiro', regional: 'Sul', role: 'CEO', companyName: 'Fintech Sul' },
    { name: 'Gustavo Pereira', email: 'gustavo.pereira@email.com', phone: '5561999001025', sector: 'Serviços', regional: 'Centro-Oeste', role: 'Analista', companyName: 'Log Express' },
    { name: 'Natália Azevedo', email: 'natalia.azevedo@email.com', phone: '5571999001026', sector: 'Tecnologia', regional: 'Nordeste', role: 'Gerente', companyName: 'Mobile Apps' },
    { name: 'Eduardo Franco', email: 'eduardo.franco@email.com', phone: '5581999001027', sector: 'Varejo', regional: 'Nordeste', role: 'Diretor', companyName: 'Auto Peças' },
    { name: 'Vanessa Cunha', email: 'vanessa.cunha@email.com', phone: '5591999001028', sector: 'Saúde', regional: 'Norte', role: 'Coordenador', companyName: 'Fisio Center' },
    { name: 'Rodrigo Melo', email: 'rodrigo.melo@email.com', phone: '5511999001029', sector: 'Financeiro', regional: 'Sudeste', role: 'Gerente', companyName: 'Seguros SP' },
    { name: 'Mariana Teixeira', email: 'mariana.teixeira@email.com', phone: '5521999001030', sector: 'Serviços', regional: 'Sudeste', role: 'Analista', companyName: 'Marketing Pro' }
];

const COMMENTS_PROMOTERS = [
    'Excelente atendimento! Sempre resolvo tudo rapidamente.',
    'Equipe muito profissional. Recomendo a todos!',
    'Melhor empresa que já trabalhei. Parabéns!',
    'Serviço impecável do início ao fim.',
    'Superou todas as minhas expectativas!',
    'Atendimento nota 10! Continuem assim.',
    'Muito satisfeito com a parceria.',
    'Qualidade excepcional em todos os aspectos.',
];

const COMMENTS_NEUTRALS = [
    'Bom atendimento, mas poderia ser mais rápido.',
    'Serviço ok, dentro do esperado.',
    'Atendimento satisfatório.',
    'Nada a reclamar, mas também nada de especial.',
    'Cumpre o que promete.',
];

const COMMENTS_DETRACTORS = [
    'Muito demorado para resolver problemas simples.',
    'Atendimento deixou a desejar.',
    'Esperava mais da empresa.',
    'Tive problemas que não foram resolvidos.',
    'Precisam melhorar muito o suporte.',
    'Falta de comunicação constante.',
    'Não recomendaria para amigos.',
];

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function randomScore() {
    // Distribuição: 60% promotores, 20% neutros, 20% detratores
    const rand = Math.random();
    if (rand < 0.6) return Math.floor(Math.random() * 2) + 9; // 9-10
    if (rand < 0.8) return Math.floor(Math.random() * 2) + 7; // 7-8
    return Math.floor(Math.random() * 7); // 0-6
}

function randomComment(score) {
    if (score >= 9) return COMMENTS_PROMOTERS[Math.floor(Math.random() * COMMENTS_PROMOTERS.length)];
    if (score >= 7) return COMMENTS_NEUTRALS[Math.floor(Math.random() * COMMENTS_NEUTRALS.length)];
    return COMMENTS_DETRACTORS[Math.floor(Math.random() * COMMENTS_DETRACTORS.length)];
}

function randomDate(daysBack = 90) {
    const now = new Date();
    const past = new Date(now.getTime() - Math.random() * daysBack * 24 * 60 * 60 * 1000);
    return past;
}

function generateToken() {
    return uuidv4().split('-').slice(0, 2).join('');
}

// ============================================
// MAIN
// ============================================

async function seedTestData() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              NPS MANAGER V5 - DADOS DE TESTE                     ║
╚══════════════════════════════════════════════════════════════════╝
`);

    try {
        // 1. Cria SuperAdmin se não existir
        console.log('🔐 Verificando SuperAdmin...');
        const existingSuperAdmin = await prisma.superAdmin.findFirst();
        if (!existingSuperAdmin) {
            await prisma.superAdmin.create({
                data: {
                    email: 'superadmin@npsmanager.com',
                    password: await bcrypt.hash('Super@123', 10),
                    name: 'Super Administrador',
                    role: 'SUPER_ADMIN'
                }
            });
            console.log('   ✅ SuperAdmin criado: superadmin@npsmanager.com / Super@123');
        } else {
            console.log('   ⏭️  SuperAdmin já existe');
        }

        // 2. Cria Planos se não existirem
        console.log('\n💰 Verificando Planos...');
        for (const planData of PLANS_DATA) {
            const existing = await prisma.plan.findUnique({ where: { name: planData.name } });
            if (!existing) {
                await prisma.plan.create({ data: planData });
                console.log(`   ✅ Plano criado: ${planData.displayName}`);
            } else {
                console.log(`   ⏭️  Plano já existe: ${planData.displayName}`);
            }
        }

        // 3. Busca plano PRO
        const proPlan = await prisma.plan.findUnique({ where: { name: 'PRO' } });

        // 4. Cria Tenant Demo
        const tenantSlug = tenantSlugArg || 'empresa-demo';
        console.log(`\n🏢 Criando Tenant: ${tenantSlug}...`);
        
        let tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
        
        if (tenant) {
            console.log('   ⚠️  Tenant já existe, limpando dados antigos...');
            // Limpa dados antigos
            await prisma.chatMessage.deleteMany({ where: { tenantId: tenant.id } });
            await prisma.nPSResponse.deleteMany({ where: { campaign: { tenantId: tenant.id } } });
            await prisma.campaign.deleteMany({ where: { tenantId: tenant.id } });
            await prisma.customer.deleteMany({ where: { tenantId: tenant.id } });
            await prisma.user.deleteMany({ where: { tenantId: tenant.id } });
        } else {
            tenant = await prisma.tenant.create({
                data: {
                    name: 'Empresa Demonstração',
                    slug: tenantSlug,
                    planId: proPlan?.id,
                    isActive: true,
                    isTrial: false,
                    ownerName: 'Administrador Demo',
                    ownerEmail: 'admin@empresademo.com.br',
                    ownerPhone: '5511999999999',
                    settings: {
                        create: {
                            brandColor: '#4F46E5',
                            regionsConfig: JSON.stringify(['Sul', 'Sudeste', 'Centro-Oeste', 'Norte', 'Nordeste']),
                            sectorsConfig: JSON.stringify(['Tecnologia', 'Varejo', 'Saúde', 'Financeiro', 'Serviços']),
                            rolesConfig: JSON.stringify(['CEO', 'Diretor', 'Gerente', 'Coordenador', 'Analista'])
                        }
                    }
                }
            });
            console.log('   ✅ Tenant criado');
        }

        // 5. Cria usuários (usando upsert para evitar duplicatas)
        console.log('\n👤 Criando usuários...');
        
        await prisma.user.upsert({
            where: { email: 'admin@nps.com' },
            update: {
                password: await bcrypt.hash('admin123', 10),
                name: 'Administrador',
                role: 'ADMIN',
                tenantId: tenant.id,
                isActive: true
            },
            create: {
                email: 'admin@nps.com',
                password: await bcrypt.hash('admin123', 10),
                name: 'Administrador',
                role: 'ADMIN',
                tenantId: tenant.id
            }
        });
        console.log('   ✅ Admin: admin@nps.com / admin123');

        await prisma.user.upsert({
            where: { email: 'gerente@nps.com' },
            update: {
                password: await bcrypt.hash('gerente123', 10),
                name: 'Gerente de Qualidade',
                role: 'MANAGER',
                tenantId: tenant.id,
                isActive: true
            },
            create: {
                email: 'gerente@nps.com',
                password: await bcrypt.hash('gerente123', 10),
                name: 'Gerente de Qualidade',
                role: 'MANAGER',
                tenantId: tenant.id
            }
        });
        console.log('   ✅ Gerente: gerente@nps.com / gerente123');

        // 6. Cria clientes (usando upsert para evitar duplicatas)
        console.log(`\n👥 Criando ${CUSTOMERS_DATA.length} clientes...`);
        const customers = [];
        for (const custData of CUSTOMERS_DATA) {
            const customer = await prisma.customer.upsert({
                where: { 
                    tenantId_email: { tenantId: tenant.id, email: custData.email }
                },
                update: {
                    name: custData.name,
                    phone: custData.phone,
                    sector: custData.sector,
                    regional: custData.regional,
                    role: custData.role,
                    companyName: custData.companyName,
                    isActive: true
                },
                create: {
                    ...custData,
                    tenantId: tenant.id,
                    isActive: true
                }
            });
            customers.push(customer);
        }
        console.log(`   ✅ ${customers.length} clientes criados/atualizados`);

        // 7. Cria campanhas
        console.log('\n📢 Criando campanhas...');
        
        const campaign1 = await prisma.campaign.create({
            data: {
                name: 'Pesquisa Q4 2024',
                description: 'Pesquisa de satisfação do quarto trimestre',
                channel: 'WHATSAPP',
                template: 'PADRAO',
                status: 'COMPLETED',
                totalSent: 30,
                totalAnswered: withResponses ? 25 : 0,
                tenantId: tenant.id,
                startedAt: randomDate(60),
                completedAt: randomDate(45)
            }
        });
        console.log('   ✅ Campanha: Pesquisa Q4 2024 (WhatsApp)');

        const campaign2 = await prisma.campaign.create({
            data: {
                name: 'NPS Mensal - Dezembro',
                description: 'Acompanhamento mensal de satisfação',
                channel: 'EMAIL',
                template: 'PADRAO',
                status: 'COMPLETED',
                totalSent: 20,
                totalAnswered: withResponses ? 15 : 0,
                tenantId: tenant.id,
                startedAt: randomDate(30),
                completedAt: randomDate(15)
            }
        });
        console.log('   ✅ Campanha: NPS Mensal - Dezembro (Email)');

        const campaign3 = await prisma.campaign.create({
            data: {
                name: 'Feedback Pós-Venda',
                description: 'Pesquisa após conclusão de vendas',
                channel: 'WHATSAPP',
                template: 'AMIGAVEL',
                status: 'ACTIVE',
                totalSent: 10,
                totalAnswered: withResponses ? 5 : 0,
                tenantId: tenant.id,
                startedAt: randomDate(7)
            }
        });
        console.log('   ✅ Campanha: Feedback Pós-Venda (WhatsApp - Ativa)');

        // 8. Cria respostas NPS
        if (withResponses) {
            console.log('\n📊 Criando respostas NPS...');
            
            let totalResponses = 0;
            const campaigns = [
                { campaign: campaign1, count: 25 },
                { campaign: campaign2, count: 15 },
                { campaign: campaign3, count: 5 }
            ];

            for (const { campaign, count } of campaigns) {
                const shuffledCustomers = [...customers].sort(() => Math.random() - 0.5).slice(0, count);
                
                for (const customer of shuffledCustomers) {
                    const score = randomScore();
                    const hasComment = Math.random() > 0.3;
                    const sentAt = randomDate(60);
                    const answeredAt = new Date(sentAt.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
                    
                    // Define tratativa para detratores
                    const isDetractor = score <= 6;
                    const treatmentStatus = isDetractor 
                        ? (Math.random() > 0.5 ? 'COMPLETED' : 'PENDING')
                        : 'NOT_REQUIRED';

                    await prisma.nPSResponse.create({
                        data: {
                            token: generateToken(),
                            score,
                            comment: hasComment ? randomComment(score) : null,
                            status: 'ANSWERED',
                            channel: campaign.channel,
                            sentiment: score >= 9 ? 'POSITIVE' : score >= 7 ? 'NEUTRAL' : 'NEGATIVE',
                            treatmentStatus,
                            treatmentNotes: treatmentStatus === 'COMPLETED' 
                                ? 'Cliente contatado e situação resolvida.' 
                                : null,
                            treatedAt: treatmentStatus === 'COMPLETED' ? new Date() : null,
                            sentAt,
                            answeredAt,
                            campaignId: campaign.id,
                            customerId: customer.id,
                            metadata: { stage: 'DONE' }
                        }
                    });
                    totalResponses++;
                }
            }
            console.log(`   ✅ ${totalResponses} respostas NPS criadas`);
            
            // Atualiza métricas das campanhas
            for (const { campaign } of campaigns) {
                const stats = await prisma.nPSResponse.aggregate({
                    where: { campaignId: campaign.id },
                    _count: true
                });
                await prisma.campaign.update({
                    where: { id: campaign.id },
                    data: { totalAnswered: stats._count }
                });
            }
        } else {
            console.log('\n⏭️  Respostas NPS não criadas (use --with-responses para incluir)');
        }

        // 9. Resumo final
        const stats = {
            customers: await prisma.customer.count({ where: { tenantId: tenant.id } }),
            campaigns: await prisma.campaign.count({ where: { tenantId: tenant.id } }),
            responses: await prisma.nPSResponse.count({ where: { campaign: { tenantId: tenant.id } } })
        };

        // Calcula NPS
        let npsScore = '-';
        if (stats.responses > 0) {
            const scores = await prisma.nPSResponse.findMany({
                where: { campaign: { tenantId: tenant.id }, score: { not: null } },
                select: { score: true }
            });
            const promoters = scores.filter(s => s.score >= 9).length;
            const detractors = scores.filter(s => s.score <= 6).length;
            npsScore = Math.round(((promoters - detractors) / scores.length) * 100);
        }

        console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    ✅ DADOS CRIADOS COM SUCESSO!                 ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  📊 ESTATÍSTICAS                                                 ║
║     • Clientes: ${String(stats.customers).padEnd(42)}║
║     • Campanhas: ${String(stats.campaigns).padEnd(41)}║
║     • Respostas NPS: ${String(stats.responses).padEnd(37)}║
║     • NPS Score: ${String(npsScore).padEnd(41)}║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  🔐 CREDENCIAIS                                                  ║
║                                                                  ║
║  SuperAdmin:                                                     ║
║     Email: superadmin@npsmanager.com                             ║
║     Senha: Super@123                                             ║
║                                                                  ║
║  Admin do Tenant:                                                ║
║     Email: admin@nps.com                                         ║
║     Senha: admin123                                              ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  🌐 ACESSO                                                       ║
║     App: http://localhost:3000                                   ║
║     SuperAdmin: http://localhost:3000/superadmin                 ║
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

seedTestData();
