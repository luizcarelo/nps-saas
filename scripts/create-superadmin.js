#!/usr/bin/env node
// ============================================
// NPS MANAGER V5 - CRIAR SUPER ADMIN
// ============================================
// Uso: node scripts/create-superadmin.js [email] [senha] [nome]
//
// Se não passar parâmetros, usa valores padrão ou pede interativamente

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const readline = require('readline');

const prisma = new PrismaClient();

// Valores padrão
const DEFAULT_EMAIL = 'superadmin@npsmanager.com';
const DEFAULT_PASSWORD = 'Super@123';
const DEFAULT_NAME = 'Super Administrador';

async function prompt(question, defaultValue = '') {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        const q = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
        rl.question(q, answer => {
            rl.close();
            resolve(answer.trim() || defaultValue);
        });
    });
}

async function createSuperAdmin() {
    console.log(`
╔══════════════════════════════════════════════════════════════════╗
║              NPS MANAGER V5 - CRIAR SUPER ADMIN                  ║
╚══════════════════════════════════════════════════════════════════╝
`);

    try {
        // Pega parâmetros da linha de comando ou pergunta
        let email, password, name;

        if (process.argv.length >= 4) {
            email = process.argv[2];
            password = process.argv[3];
            name = process.argv[4] || DEFAULT_NAME;
        } else {
            console.log('📝 Preencha os dados do Super Administrador:\n');
            email = await prompt('   Email', DEFAULT_EMAIL);
            password = await prompt('   Senha', DEFAULT_PASSWORD);
            name = await prompt('   Nome', DEFAULT_NAME);
        }

        // Valida email
        if (!email || !email.includes('@')) {
            console.log('\n❌ Email inválido!\n');
            process.exit(1);
        }

        // Valida senha
        if (!password || password.length < 6) {
            console.log('\n❌ Senha deve ter no mínimo 6 caracteres!\n');
            process.exit(1);
        }

        console.log('\n🔄 Criando Super Admin...\n');

        // Verifica se já existe
        const existing = await prisma.superAdmin.findUnique({
            where: { email }
        });

        if (existing) {
            console.log(`⚠️  Super Admin com email "${email}" já existe.`);
            console.log('   Atualizando senha...\n');

            await prisma.superAdmin.update({
                where: { email },
                data: {
                    password: await bcrypt.hash(password, 10),
                    name,
                    isActive: true
                }
            });

            console.log('✅ Senha atualizada com sucesso!\n');
        } else {
            // Cria novo
            await prisma.superAdmin.create({
                data: {
                    email,
                    password: await bcrypt.hash(password, 10),
                    name,
                    role: 'SUPER_ADMIN',
                    isActive: true
                }
            });

            console.log('✅ Super Admin criado com sucesso!\n');
        }

        // Mostra resumo
        console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    CREDENCIAIS DO SUPER ADMIN                    ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  Email: ${email.padEnd(52)}║
║  Senha: ${password.padEnd(52)}║
║  Nome:  ${name.padEnd(52)}║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Acesse: http://localhost:3000/superadmin                        ║
╚══════════════════════════════════════════════════════════════════╝
`);

    } catch (error) {
        if (error.code === 'P2002') {
            console.error('\n❌ Já existe um Super Admin com este email.\n');
        } else if (error.code === 'P2021') {
            console.error('\n❌ Tabela super_admins não existe. Execute a migração primeiro:\n');
            console.error('   npx prisma migrate dev --name add_superadmin\n');
        } else {
            console.error('\n❌ Erro:', error.message, '\n');
        }
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

createSuperAdmin();