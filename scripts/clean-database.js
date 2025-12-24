#!/usr/bin/env node
// ============================================
// NPS MANAGER V5 - SCRIPT DE LIMPEZA DO BANCO
// ============================================
// Uso: node scripts/clean-database.js [--keep-superadmin] [--keep-plans]
// 
// Opções:
//   --keep-superadmin  Mantém os super admins
//   --keep-plans       Mantém os planos
//   --keep-tenants     Mantém a estrutura dos tenants (sem dados)
//   --force            Não pede confirmação
//   --help             Mostra ajuda

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

// Parse argumentos
const args = process.argv.slice(2);
const keepSuperAdmin = args.includes('--keep-superadmin');
const keepPlans = args.includes('--keep-plans');
const keepTenants = args.includes('--keep-tenants');
const force = args.includes('--force');
const help = args.includes('--help');

if (help) {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           NPS MANAGER V5 - LIMPEZA DO BANCO DE DADOS             ║
╚══════════════════════════════════════════════════════════════════╝

Uso: node scripts/clean-database.js [opções]

Opções:
  --keep-superadmin  Mantém os super administradores
  --keep-plans       Mantém os planos de assinatura
  --keep-tenants     Mantém a estrutura dos tenants (remove apenas dados)
  --force            Executa sem pedir confirmação
  --help             Mostra esta ajuda

Exemplos:
  node scripts/clean-database.js --force
  node scripts/clean-database.js --keep-superadmin --keep-plans
  node scripts/clean-database.js --keep-tenants
`);
    process.exit(0);
}

async function askConfirmation(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'sim' || answer.toLowerCase() === 's' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
        });
    });
}

async function cleanDatabase() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           NPS MANAGER V5 - LIMPEZA DO BANCO DE DADOS             ║
╚══════════════════════════════════════════════════════════════════╝
`);

    console.log('📋 Configurações:');
    console.log(`   • Manter SuperAdmins: ${keepSuperAdmin ? '✅ Sim' : '❌ Não'}`);
    console.log(`   • Manter Planos: ${keepPlans ? '✅ Sim' : '❌ Não'}`);
    console.log(`   • Manter Tenants: ${keepTenants ? '✅ Sim' : '❌ Não'}`);
    console.log('');

    if (!force) {
        const confirmed = await askConfirmation('⚠️  ATENÇÃO: Esta ação irá APAGAR dados permanentemente!\n   Digite "sim" para continuar: ');
        if (!confirmed) {
            console.log('\n❌ Operação cancelada pelo usuário.\n');
            process.exit(0);
        }
    }

    console.log('\n🔄 Iniciando limpeza...\n');

    try {
        // Desabilita verificações de FK temporariamente (PostgreSQL)
        await prisma.$executeRaw`SET session_replication_role = replica;`;

        // 1. Limpa mensagens de chat
        const chatDeleted = await prisma.chatMessage.deleteMany({});
        console.log(`   ✅ Chat Messages: ${chatDeleted.count} removidas`);

        // 2. Limpa respostas NPS
        const responsesDeleted = await prisma.nPSResponse.deleteMany({});
        console.log(`   ✅ NPS Responses: ${responsesDeleted.count} removidas`);

        // 3. Limpa campanhas
        const campaignsDeleted = await prisma.campaign.deleteMany({});
        console.log(`   ✅ Campaigns: ${campaignsDeleted.count} removidas`);

        // 4. Limpa clientes
        const customersDeleted = await prisma.customer.deleteMany({});
        console.log(`   ✅ Customers: ${customersDeleted.count} removidos`);

        // 5. Limpa templates
        const templatesDeleted = await prisma.messageTemplate.deleteMany({});
        console.log(`   ✅ Message Templates: ${templatesDeleted.count} removidos`);

        // 6. Limpa logs de email
        const emailLogsDeleted = await prisma.emailLog.deleteMany({});
        console.log(`   ✅ Email Logs: ${emailLogsDeleted.count} removidos`);

        // 7. Limpa logs de auditoria
        try {
            const auditDeleted = await prisma.auditLog.deleteMany({});
            console.log(`   ✅ Audit Logs: ${auditDeleted.count} removidos`);
        } catch (e) {
            console.log(`   ⚠️  Audit Logs: tabela não existe`);
        }

        // 8. Limpa usuários
        const usersDeleted = await prisma.user.deleteMany({});
        console.log(`   ✅ Users: ${usersDeleted.count} removidos`);

        // 9. Limpa subscriptions
        try {
            const subsDeleted = await prisma.subscription.deleteMany({});
            console.log(`   ✅ Subscriptions: ${subsDeleted.count} removidas`);
        } catch (e) {
            console.log(`   ⚠️  Subscriptions: tabela não existe`);
        }

        // 10. Limpa tenant settings
        if (!keepTenants) {
            const settingsDeleted = await prisma.tenantSettings.deleteMany({});
            console.log(`   ✅ Tenant Settings: ${settingsDeleted.count} removidos`);

            // 11. Limpa tenants
            const tenantsDeleted = await prisma.tenant.deleteMany({});
            console.log(`   ✅ Tenants: ${tenantsDeleted.count} removidos`);
        } else {
            console.log(`   ⏭️  Tenants: mantidos`);
        }

        // 12. Limpa planos
        if (!keepPlans) {
            try {
                const plansDeleted = await prisma.plan.deleteMany({});
                console.log(`   ✅ Plans: ${plansDeleted.count} removidos`);
            } catch (e) {
                console.log(`   ⚠️  Plans: tabela não existe`);
            }
        } else {
            console.log(`   ⏭️  Plans: mantidos`);
        }

        // 13. Limpa super admins
        if (!keepSuperAdmin) {
            try {
                const superDeleted = await prisma.superAdmin.deleteMany({});
                console.log(`   ✅ Super Admins: ${superDeleted.count} removidos`);
            } catch (e) {
                console.log(`   ⚠️  Super Admins: tabela não existe`);
            }
        } else {
            console.log(`   ⏭️  Super Admins: mantidos`);
        }

        // Reabilita verificações de FK
        await prisma.$executeRaw`SET session_replication_role = DEFAULT;`;

        console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    ✅ LIMPEZA CONCLUÍDA!                         ║
╚══════════════════════════════════════════════════════════════════╝

Para recriar os dados de teste, execute:
   node scripts/seed-test-data.js

Para criar apenas o superadmin:
   node scripts/create-superadmin.js
`);

    } catch (error) {
        console.error('\n❌ Erro durante a limpeza:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

cleanDatabase();