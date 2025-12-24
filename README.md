# 🚀 NPS Manager V5 - Enterprise Edition

Sistema completo de gestão de NPS (Net Promoter Score) com envio via **WhatsApp** e **Email**, dashboard em tempo real e multi-tenant.

![Version](https://img.shields.io/badge/version-5.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Funcionalidades

### 📊 Dashboard em Tempo Real
- NPS Score com atualização via WebSocket
- Gráficos de tendência
- Lista de feedbacks recentes
- Alertas de detratores pendentes
- Métricas financeiras (receita em risco)

### 📱 WhatsApp Integration
- Conexão via QR Code no painel
- Templates de mensagem personalizáveis
- Recebimento de respostas automático
- Respostas automáticas baseadas na nota
- Controle anti-ban (delays e pausas)

### 📧 Email Marketing
- Suporte a múltiplos providers (Gmail, SendGrid, SES, Mailgun)
- Templates HTML responsivos
- Tracking de envios
- SMTP customizado por tenant

### 👥 Gestão de Clientes
- Importação via CSV
- Segmentação por regional/setor
- Histórico de respostas
- Tags automáticas

### 🎯 Campanhas
- Disparo em massa
- Agendamento (em breve)
- Múltiplos canais (WhatsApp/Email)
- Templates pré-definidos

### 💜 Wall of Love
- Página pública de depoimentos
- White-label (cores e logo personalizáveis)
- Compartilhamento social

## 🛠️ Tecnologias

- **Backend:** Node.js, Express, Prisma ORM
- **Frontend:** EJS, TailwindCSS, Chart.js
- **Database:** PostgreSQL
- **Real-time:** Socket.io
- **WhatsApp:** Baileys (WhiskeySockets)
- **Email:** Nodemailer

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- PostgreSQL 14+
- NPM ou Yarn

### 1. Clone e instale dependências

```bash
# Clone o repositório
git clone <seu-repo>
cd nps-manager-v5

# Instale as dependências
npm install
```

### 2. Configure o ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas configurações
nano .env
```

**Configurações mínimas necessárias:**

```env
# Banco de Dados
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nps_db"

# Segurança
JWT_SECRET="sua_chave_secreta_aqui"

# URL do Sistema
FRONTEND_URL="http://localhost:3000"
```

### 3. Configure o banco de dados

```bash
# Gera o cliente Prisma
npm run prisma:generate

# Cria as tabelas no banco
npm run prisma:push

# (Opcional) Popula com dados de exemplo
npm run seed:demo
```

### 4. Inicie o servidor

```bash
# Desenvolvimento (com hot-reload)
npm run dev

# Produção
npm start
```

### 5. Acesse o sistema

- **URL:** http://localhost:3000
- **Login:** admin@nps.com
- **Senha:** admin123

## 📧 Configuração de Email

### Gmail (recomendado para testes)

1. Ative a verificação em 2 etapas na sua conta Google
2. Gere uma "Senha de App" em: https://myaccount.google.com/apppasswords
3. Configure no `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu.email@gmail.com
SMTP_PASS=sua_senha_de_app
SMTP_FROM=noreply@suaempresa.com
```

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=sua_api_key_sendgrid
```

### Testar configuração

```bash
npm run test:email seu@email.com
```

## 📱 Configuração do WhatsApp

1. Acesse o Dashboard
2. Clique em "Conectar WhatsApp"
3. Escaneie o QR Code com seu celular
4. Pronto! O sistema receberá e enviará mensagens

### Testar WhatsApp

```bash
npm run test:whatsapp
```

### ⚠️ Importante

- Use uma conta exclusiva para o sistema
- Evite envios em massa para números desconhecidos
- Respeite os limites do WhatsApp para evitar banimento
- Configurações de segurança no `.env`:

```env
WA_MIN_DELAY=3000      # Delay mínimo entre mensagens (ms)
WA_MAX_DELAY=8000      # Delay máximo entre mensagens (ms)
WA_BATCH_SIZE=15       # Mensagens antes de pausa
WA_BATCH_COOLDOWN=45000 # Tempo de pausa (ms)
```

## 📁 Estrutura do Projeto

```
nps-manager-v5/
├── prisma/
│   └── schema.prisma      # Schema do banco de dados
├── public/
│   └── login.html         # Página de login
├── scripts/
│   ├── seed.js            # Seed básico
│   ├── seed_demo.js       # Seed com dados de demo
│   ├── test_email.js      # Teste de email
│   └── test_whatsapp.js   # Teste de WhatsApp
├── src/
│   ├── server.js          # Servidor principal
│   └── services/
│       ├── emailService.js    # Serviço de email
│       └── whatsappService.js # Serviço de WhatsApp
├── views/
│   ├── partials/
│   │   ├── head.ejs       # Cabeçalho HTML
│   │   └── navbar.ejs     # Barra de navegação
│   ├── dashboard.ejs      # Dashboard principal
│   ├── clients.ejs        # Gestão de clientes
│   ├── messages.ejs       # Relatórios
│   ├── create-campaign.ejs # Criação de campanha
│   ├── settings.ejs       # Configurações
│   ├── vote.ejs           # Página de votação
│   └── wall.ejs           # Wall of Love
├── .env.example           # Exemplo de configuração
├── package.json           # Dependências
└── README.md              # Este arquivo
```

## 🔌 API Endpoints

### Autenticação
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro (self-service)

### Votação (Público)
- `GET /api/vote-quick?t={token}&s={score}` - Voto rápido via email
- `POST /api/vote` - Voto completo com comentário

### Dashboard (Autenticado)
- `GET /api/admin/dashboard` - Força atualização via Socket
- `GET /api/admin/analytics` - Estatísticas detalhadas

### Campanhas (Autenticado)
- `GET /api/campaigns` - Lista campanhas
- `POST /api/campaigns/dispatch` - Inicia disparo

### Clientes (Autenticado)
- `GET /api/customers` - Lista clientes
- `POST /api/customers` - Cria cliente
- `POST /api/customers/import` - Importa CSV
- `DELETE /api/customers/:id` - Remove cliente

### Configurações (Autenticado)
- `GET /api/admin/settings` - Busca configurações
- `POST /api/admin/settings` - Salva configurações
- `POST /api/admin/test-email` - Testa envio de email

### WhatsApp (Autenticado)
- `GET /api/whatsapp/status` - Status da conexão
- `POST /api/whatsapp/logout` - Desconecta sessão

## 🚀 Deploy em Produção

### Docker (Recomendado)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
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

### Variáveis de Produção

```env
NODE_ENV=production
JWT_SECRET=chave_muito_segura_e_longa
```

## 🔒 Segurança

- Tokens JWT com expiração de 24h
- Rate limiting em todas as rotas API
- Helmet.js para headers de segurança
- Bcrypt para hash de senhas
- Validação de inputs
- CORS configurável

## 📝 Licença

MIT © NPS Manager Team

## 🤝 Suporte

- 📧 Email: suporte@npsmanager.com
- 📖 Docs: https://docs.npsmanager.com
- 🐛 Issues: https://github.com/seu-repo/issues
