
# 🚀 NPS Manager V5 — Enterprise Edition

Sistema completo de gestão de **NPS (Net Promoter Score)** com envio via **WhatsApp** e **Email**, dashboard em tempo real e arquitetura **multi-tenant**.

![Version](https://img.shields.io/badge/version-5.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%E2%89%A520.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Principais Funcionalidades

### 📊 Dashboard em Tempo Real
- NPS Score com atualização via WebSocket
- Gráficos de tendência
- Lista de feedbacks recentes
- Alertas de detratores pendentes
- Métricas financeiras (receita em risco)

### 📱 Integração WhatsApp
- Conexão via QR Code no painel
- Templates de mensagem personalizáveis
- Recebimento de respostas automático
- Respostas automáticas baseadas na nota
- Controle anti-ban (delays e pausas)

### 📧 Email Marketing
- Suporte a múltiplos providers (Gmail, SendGrid, Amazon SES, Mailgun)
- Templates HTML responsivos
- Tracking de envios
- SMTP customizado por **tenant**

### 👥 Gestão de Clientes
- Importação via CSV
- Segmentação por regional/setor/cargo
- Histórico de respostas
- Tags automáticas

### 🎯 Campanhas
- Disparo em massa (WhatsApp/Email)
- Agendamento (em breve)
- Templates pré-definidos

### 💜 Wall of Love
- Página pública de depoimentos
- White-label (cores e logo personalizáveis)
- Compartilhamento social

---

## 🛠️ Tecnologias
- **Backend:** Node.js, Express, Prisma ORM
- **Frontend:** EJS, TailwindCSS, Chart.js
- **Database:** PostgreSQL
- **Real-time:** Socket.io
- **WhatsApp:** Baileys (WhiskeySockets)
- **Email:** Nodemailer

---

## 📦 Requisitos e Compatibilidade

> **Node.js:** recomenda-se Node **20+** (algumas dependências exigem Node >=20).
> **PostgreSQL:** 14+.

- Engines e libs relevantes:
  - `@whiskeysockets/baileys` ^7.0.0-rc.9 (Node >=20)
  - `p-queue` 9.x (Node >=20)
  - `file-type` 21.x (Node >=20)
  - `lru-cache` 11.x (Node 20+)
  - `@prisma/client`/`prisma` 5.14+

---

## 🚀 Instalação

### 1) Clone e instale dependências
```bash
# Clone o repositório
git clone <seu-repo>
cd nps-manager-v5

# Instale as dependências
npm install
```

### 2) Configure o ambiente
Copie o arquivo de exemplo e edite suas variáveis:
```bash
cp .env.example .env
nano .env
```

**Configurações mínimas:**
```env
# Banco de Dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nps_saas_db?schema=public"

# Segurança
JWT_SECRET="chave_super_secreta_muito_longa"

# URL do Sistema
FRONTEND_URL="http://localhost:3000"
```

**Email (SMTP) — escolha um provider:**
```env
# Gmail (teste)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu.email@gmail.com
SMTP_PASS=senha_de_app_google
SMTP_FROM=noreply@suaempresa.com
SMTP_FROM_NAME="NPS Manager"

# SendGrid
# SMTP_HOST=smtp.sendgrid.net
# SMTP_PORT=587
# SMTP_USER=apikey
# SMTP_PASS=SUA_API_KEY

# Amazon SES
# SMTP_HOST=email-smtp.us-east-1.amazonaws.com
# SMTP_PORT=587
# SMTP_USER=SUA_ACCESS_KEY
# SMTP_PASS=SUA_SECRET_KEY

# Mailgun
# SMTP_HOST=smtp.mailgun.org
# SMTP_PORT=587
# SMTP_USER=postmaster@seu_dominio.mailgun.org
# SMTP_PASS=SUA_API_KEY
```

**WhatsApp (anti-ban):**
```env
WA_MIN_DELAY=3000      # Delay mínimo entre mensagens (ms)
WA_MAX_DELAY=8000      # Delay máximo entre mensagens (ms)
WA_BATCH_SIZE=15       # Mensagens antes de pausa
WA_BATCH_COOLDOWN=45000# Tempo de pausa (ms)
```

**Opcionais:**
```env
# Webhook externo (Zapier, n8n etc.)
WEBHOOK_SECRET="sua_chave_webhook"
# Redis (filas/cache)
REDIS_URL="redis://localhost:6379"
# Sentry (monitoramento de erros)
SENTRY_DSN="sua_dsn"
```

### 3) Banco de dados (Prisma)
```bash
# Gera o cliente Prisma
npm run prisma:generate

# Cria/atualiza as tabelas
npm run prisma:push
# ou: npm run prisma:migrate

# (Opcional) Popular com dados de demo
npm run seed:demo
```

### 4) Inicie o servidor
```bash
# Desenvolvimento (hot-reload)
npm run dev

# Produção
npm start
```

### 5) Acesse o sistema
- **URL:** http://localhost:3000
- **Login (demo):** admin@nps.com
- **Senha:** admin123

> **Importante:** troque/disable o usuário demo em produção.

---

## 🔌 API — Endpoints principais

### Autenticação
- `POST /api/auth/login` — Login
- `POST /api/auth/register` — Registro (self-service)

### Votação (público)
- `GET /api/vote-quick?t={token}&s={score}` — Voto rápido via link
- `POST /api/vote` — Voto completo com comentário

### Dashboard/Analytics (autenticado)
- `GET /api/admin/dashboard` — Estatísticas em tempo real
- `GET /api/admin/analytics` — Analytics detalhado

### Campanhas (autenticado)
- `GET /api/campaigns` — Lista campanhas
- `POST /api/campaigns/dispatch` — Inicia disparo (WhatsApp/Email)

### Clientes (autenticado)
- `GET /api/customers` — Lista clientes
- `POST /api/customers` — Cria cliente
- `POST /api/customers/import` — Importa CSV
- `DELETE /api/customers/:id` — Remove cliente

### Configurações (autenticado)
- `GET /api/admin/settings` — Busca configurações
- `POST /api/admin/settings` — Salva configurações
- `POST /api/admin/test-email` — Testa envio de email

### WhatsApp (autenticado)
- `GET /api/whatsapp/status` — Status da conexão
- `POST /api/whatsapp/logout` — Desconecta sessão

### Chat (tempo real)
- `GET /api/chat/conversations` — Lista conversas
- `GET /api/chat/conversations/:id/messages` — Histórico
- `POST /api/chat/conversations/:id/messages` — Envia mensagem

---

## 🗃️ Banco — Modelos (Prisma)
Principais modelos: **SuperAdmin**, **Plan**, **Subscription**, **Tenant**, **TenantSettings**, **AuditLog**, **User**, **Customer**, **Campaign**, **NPSResponse**, **MessageTemplate**, **EmailLog**, **ChatMessage**.

- Suporte **multi-tenant** com `tenantId` em todas as entidades de dados
- Logs de auditoria e de e-mail
- Tratativas de detratores (`NPSResponse.treatmentStatus`, `treatedBy`)
- Branding por tenant, SMTP por tenant, limites por plano

---

## 🧪 Scripts úteis
```bash
# Limpar banco (use com cuidado)
node scripts/clean-database.js --force

# Criar SuperAdmin (interativo)
node scripts/create-superadmin.js

# Testar Email
npm run test:email seu@email.com

# Testar WhatsApp
npm run test:whatsapp
```

---

## 🔒 Segurança
- **NUNCA** commitar `.env` com segredos (JWT, SMTP, DB). Use variáveis de ambiente.
- Troque imediatamente qualquer credencial de exemplo.
- Rate limiting em rotas sensíveis; `helmet` para headers; `bcrypt` para senha.
- JWT com expiração (24h) e rotação recomendada.
- Use uma **conta WhatsApp exclusiva** e respeite limites para evitar banimento.

> **Nota:** `multer@1.x` possui vulnerabilidades conhecidas; considere atualizar para `multer@2.x`.

---

## ☸️ Deploy (produção)

### Docker (exemplo)
```dockerfile
FROM node:20-alpine
WORKDIR /app

# Instala apenas prod deps
COPY package*.json ./
RUN npm ci --omit=dev

# Copia código e gera o client do Prisma
COPY . .
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "start"]
```

### PM2
```bash
npm install -g pm2
pm2 start src/server.js --name nps-manager
pm2 save
pm2 startup
```

### Variáveis de produção
```env
NODE_ENV=production
JWT_SECRET="chave_muito_segura_e_longa"
```

---

## 🧭 Roadmap
- Agendamento de campanhas
- IA de análise de sentimento avançada
- Exportações (CSV/Excel) e relatórios customizados
- Suporte a templates de WhatsApp homologados (Cloud API)

---

## 📝 Licença
MIT © NPS Manager Team

## 🤝 Suporte
- 📧 Email: suporte@npsmanager.com
- 🐛 Issues: https://github.com/seu-repo/issues
