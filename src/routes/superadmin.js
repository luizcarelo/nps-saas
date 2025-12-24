// ============================================
// NPS MANAGER V5 - SUPERADMIN ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'nps-manager-secret-key-v5';

// ============================================
// MIDDLEWARE DE AUTENTICAÇÃO SUPERADMIN
// ============================================

const authenticateSuperAdmin = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.role !== 'SUPER_ADMIN' && decoded.role !== 'SUPPORT') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const superAdmin = await prisma.superAdmin.findUnique({
            where: { id: decoded.id }
        });

        if (!superAdmin || !superAdmin.isActive) {
            return res.status(401).json({ error: 'SuperAdmin inválido' });
        }

        req.superAdmin = superAdmin;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

// ============================================
// AUTENTICAÇÃO
// ============================================

router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const superAdmin = await prisma.superAdmin.findUnique({
            where: { email }
        });

        if (!superAdmin || !superAdmin.isActive) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        const validPassword = await bcrypt.compare(password, superAdmin.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Atualiza último login
        await prisma.superAdmin.update({
            where: { id: superAdmin.id },
            data: { lastLoginAt: new Date() }
        });

        const token = jwt.sign(
            { id: superAdmin.id, email: superAdmin.email, role: superAdmin.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: superAdmin.id,
                email: superAdmin.email,
                name: superAdmin.name,
                role: superAdmin.role
            }
        });

    } catch (e) {
        console.error('Erro login SuperAdmin:', e);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// ============================================
// DASHBOARD
// ============================================

router.get('/dashboard', authenticateSuperAdmin, async (req, res) => {
    try {
        // Total de tenants
        const totalTenants = await prisma.tenant.count();
        const activeTenants = await prisma.tenant.count({ where: { isActive: true } });

        // Total de usuários
        const totalUsers = await prisma.user.count({ where: { isActive: true } });

        // Total de pesquisas
        const totalSurveys = await prisma.nPSResponse.count();
        
        // Pesquisas este mês
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const surveysThisMonth = await prisma.nPSResponse.count({
            where: { createdAt: { gte: startOfMonth } }
        });

        // MRR estimado (soma dos preços mensais dos planos ativos)
        const tenantsWithPlans = await prisma.tenant.findMany({
            where: { isActive: true, planId: { not: null } },
            include: { plan: { select: { priceMonthly: true } } }
        });
        const mrr = tenantsWithPlans.reduce((sum, t) => sum + parseFloat(t.plan?.priceMonthly || 0), 0);

        // Tenants recentes
        const recentTenants = await prisma.tenant.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { plan: { select: { displayName: true } } }
        });

        // Distribuição por plano
        const planDistribution = await prisma.plan.findMany({
            where: { isActive: true },
            select: {
                displayName: true,
                _count: { select: { tenants: true } }
            },
            orderBy: { sortOrder: 'asc' }
        });

        res.json({
            totalTenants,
            activeTenants,
            totalUsers,
            totalSurveys,
            surveysThisMonth,
            mrr,
            recentTenants,
            planDistribution: planDistribution.map(p => ({
                name: p.displayName,
                count: p._count.tenants
            }))
        });

    } catch (e) {
        console.error('Erro dashboard:', e);
        res.status(500).json({ error: 'Erro ao carregar dashboard' });
    }
});

// ============================================
// TENANTS (CLIENTES)
// ============================================

// Listar todos os tenants
router.get('/tenants', authenticateSuperAdmin, async (req, res) => {
    try {
        const tenants = await prisma.tenant.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                plan: { select: { id: true, displayName: true } },
                _count: {
                    select: { users: true, customers: true, campaigns: true }
                }
            }
        });

        res.json(tenants);
    } catch (e) {
        console.error('Erro listar tenants:', e);
        res.status(500).json({ error: 'Erro ao listar clientes' });
    }
});

// Criar novo tenant
router.post('/tenants', authenticateSuperAdmin, async (req, res) => {
    try {
        const {
            name, slug, ownerName, ownerEmail, ownerPhone,
            planId, isActive, isTrial, trialEndsAt,
            document, city, state,
            adminEmail, adminPassword
        } = req.body;

        // Verifica slug único
        const existingSlug = await prisma.tenant.findUnique({ where: { slug } });
        if (existingSlug) {
            return res.status(400).json({ error: 'Slug já existe' });
        }

        // Verifica email do admin
        if (adminEmail) {
            const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
            if (existingUser) {
                return res.status(400).json({ error: 'Email do admin já está em uso' });
            }
        }

        // Gera senha se não fornecida
        const password = adminPassword || Math.random().toString(36).slice(-8) + 'A1!';

        // Cria tenant
        const tenant = await prisma.tenant.create({
            data: {
                name,
                slug,
                ownerName,
                ownerEmail,
                ownerPhone,
                planId: planId || null,
                isActive: isActive !== false,
                isTrial: isTrial || false,
                trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
                document,
                city,
                state,
                settings: {
                    create: {}
                }
            }
        });

        // Cria usuário admin
        let adminUser = null;
        if (adminEmail) {
            adminUser = await prisma.user.create({
                data: {
                    email: adminEmail,
                    password: await bcrypt.hash(password, 10),
                    name: ownerName || 'Administrador',
                    role: 'ADMIN',
                    tenantId: tenant.id
                }
            });
        }

        res.json({
            ...tenant,
            adminEmail: adminUser?.email,
            adminPassword: adminUser ? password : null
        });

    } catch (e) {
        console.error('Erro criar tenant:', e);
        res.status(500).json({ error: 'Erro ao criar cliente' });
    }
});

// Atualizar tenant
router.put('/tenants/:id', authenticateSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, slug, ownerName, ownerEmail, ownerPhone,
            planId, isActive, isTrial, trialEndsAt,
            document, city, state
        } = req.body;

        // Verifica slug único (se mudou)
        if (slug) {
            const existingSlug = await prisma.tenant.findFirst({
                where: { slug, id: { not: id } }
            });
            if (existingSlug) {
                return res.status(400).json({ error: 'Slug já existe' });
            }
        }

        const tenant = await prisma.tenant.update({
            where: { id },
            data: {
                name,
                slug,
                ownerName,
                ownerEmail,
                ownerPhone,
                planId: planId || null,
                isActive,
                isTrial,
                trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
                document,
                city,
                state
            }
        });

        res.json(tenant);

    } catch (e) {
        console.error('Erro atualizar tenant:', e);
        res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
});

// Estatísticas do tenant
router.get('/tenants/:id/stats', authenticateSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const users = await prisma.user.count({ where: { tenantId: id } });
        const customers = await prisma.customer.count({ where: { tenantId: id } });
        const campaigns = await prisma.campaign.count({ where: { tenantId: id } });
        const responses = await prisma.nPSResponse.count({
            where: { campaign: { tenantId: id } }
        });

        // Calcula NPS
        const scores = await prisma.nPSResponse.findMany({
            where: { campaign: { tenantId: id }, score: { not: null } },
            select: { score: true }
        });

        let nps = null;
        if (scores.length > 0) {
            const promoters = scores.filter(s => s.score >= 9).length;
            const detractors = scores.filter(s => s.score <= 6).length;
            nps = Math.round(((promoters - detractors) / scores.length) * 100);
        }

        res.json({ users, customers, campaigns, responses, nps });

    } catch (e) {
        console.error('Erro stats tenant:', e);
        res.status(500).json({ error: 'Erro ao carregar estatísticas' });
    }
});

// Impersonar tenant (acessar como admin)
router.post('/tenants/:id/impersonate', authenticateSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Busca primeiro usuário admin do tenant
        const adminUser = await prisma.user.findFirst({
            where: { tenantId: id, role: 'ADMIN', isActive: true }
        });

        if (!adminUser) {
            return res.status(404).json({ error: 'Nenhum admin encontrado para este tenant' });
        }

        // Gera token para o usuário
        const token = jwt.sign(
            { 
                id: adminUser.id, 
                email: adminUser.email, 
                tenantId: id,
                role: adminUser.role,
                impersonatedBy: req.superAdmin.id
            },
            JWT_SECRET,
            { expiresIn: '2h' }
        );

        res.json({
            token,
            user: {
                id: adminUser.id,
                email: adminUser.email,
                name: adminUser.name,
                role: adminUser.role
            }
        });

    } catch (e) {
        console.error('Erro impersonate:', e);
        res.status(500).json({ error: 'Erro ao acessar tenant' });
    }
});

// Deletar tenant
router.delete('/tenants/:id', authenticateSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Deleta em cascata (configurado no schema)
        await prisma.tenant.delete({ where: { id } });

        res.json({ success: true });

    } catch (e) {
        console.error('Erro deletar tenant:', e);
        res.status(500).json({ error: 'Erro ao deletar cliente' });
    }
});

// ============================================
// PLANOS
// ============================================

// Listar planos
router.get('/plans', authenticateSuperAdmin, async (req, res) => {
    try {
        const plans = await prisma.plan.findMany({
            orderBy: { sortOrder: 'asc' },
            include: {
                _count: { select: { tenants: true } }
            }
        });

        res.json(plans);
    } catch (e) {
        console.error('Erro listar planos:', e);
        res.status(500).json({ error: 'Erro ao listar planos' });
    }
});

// Criar plano
router.post('/plans', authenticateSuperAdmin, async (req, res) => {
    try {
        const plan = await prisma.plan.create({
            data: req.body
        });

        res.json(plan);
    } catch (e) {
        console.error('Erro criar plano:', e);
        if (e.code === 'P2002') {
            return res.status(400).json({ error: 'Nome do plano já existe' });
        }
        res.status(500).json({ error: 'Erro ao criar plano' });
    }
});

// Atualizar plano
router.put('/plans/:id', authenticateSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const plan = await prisma.plan.update({
            where: { id },
            data: req.body
        });

        res.json(plan);
    } catch (e) {
        console.error('Erro atualizar plano:', e);
        res.status(500).json({ error: 'Erro ao atualizar plano' });
    }
});

// Deletar plano
router.delete('/plans/:id', authenticateSuperAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Verifica se há tenants usando o plano
        const tenantsUsing = await prisma.tenant.count({ where: { planId: id } });
        if (tenantsUsing > 0) {
            return res.status(400).json({ 
                error: `Não é possível excluir. ${tenantsUsing} cliente(s) usando este plano.` 
            });
        }

        await prisma.plan.delete({ where: { id } });

        res.json({ success: true });
    } catch (e) {
        console.error('Erro deletar plano:', e);
        res.status(500).json({ error: 'Erro ao deletar plano' });
    }
});

// ============================================
// RELATÓRIOS
// ============================================

router.get('/reports/overview', authenticateSuperAdmin, async (req, res) => {
    try {
        const now = new Date();
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Novos tenants
        const newTenants30d = await prisma.tenant.count({
            where: { createdAt: { gte: last30Days } }
        });
        const newTenants7d = await prisma.tenant.count({
            where: { createdAt: { gte: last7Days } }
        });

        // Novos usuários
        const newUsers30d = await prisma.user.count({
            where: { createdAt: { gte: last30Days } }
        });

        // Pesquisas enviadas
        const surveys30d = await prisma.nPSResponse.count({
            where: { sentAt: { gte: last30Days } }
        });
        const surveys7d = await prisma.nPSResponse.count({
            where: { sentAt: { gte: last7Days } }
        });

        // Pesquisas respondidas
        const answered30d = await prisma.nPSResponse.count({
            where: { 
                answeredAt: { gte: last30Days },
                score: { not: null }
            }
        });

        // Top tenants por uso
        const topTenants = await prisma.tenant.findMany({
            take: 10,
            orderBy: {
                campaigns: { _count: 'desc' }
            },
            include: {
                plan: { select: { displayName: true } },
                _count: { select: { campaigns: true, customers: true } }
            }
        });

        res.json({
            newTenants: { last30Days: newTenants30d, last7Days: newTenants7d },
            newUsers: { last30Days: newUsers30d },
            surveys: { 
                sent30d: surveys30d, 
                sent7d: surveys7d,
                answered30d 
            },
            topTenants
        });

    } catch (e) {
        console.error('Erro relatórios:', e);
        res.status(500).json({ error: 'Erro ao carregar relatórios' });
    }
});

module.exports = router;