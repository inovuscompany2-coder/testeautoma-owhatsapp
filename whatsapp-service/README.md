# WhatsApp Service - Deploy na Render

Este serviço usa **whatsapp-web.js** com Puppeteer para automação do WhatsApp Web.

## Deploy na Render (Passo a Passo)

### 1. Preparar o Repositório

Faça push da pasta `whatsapp-service/` para um repositório GitHub separado ou use o mesmo repo.

### 2. Criar Conta na Render

1. Acesse [render.com](https://render.com) e crie uma conta
2. Conecte sua conta GitHub

### 3. Criar Web Service

1. No dashboard, clique em **"New +"** > **"Web Service"**
2. Conecte o repositório que contém o `whatsapp-service`
3. Configure:

| Campo | Valor |
|-------|-------|
| **Name** | `whatsapp-service` |
| **Region** | Escolha o mais próximo (ex: Oregon) |
| **Branch** | `main` |
| **Root Directory** | `whatsapp-service` (se estiver no mesmo repo) |
| **Runtime** | `Docker` |
| **Instance Type** | `Starter` ($7/mês) ou `Standard` |

### 4. Variáveis de Ambiente

Adicione estas variáveis na seção **Environment**:

```
API_TOKEN=seu_token_secreto_aqui
PORT=3001
NODE_ENV=production
```

> **Importante:** Crie um token seguro para `API_TOKEN` (ex: use `openssl rand -hex 32`)

### 5. Deploy

1. Clique em **"Create Web Service"**
2. Aguarde o build (pode levar 5-10 minutos na primeira vez)
3. Quando estiver **"Live"**, copie a URL (ex: `https://whatsapp-service-xxxx.onrender.com`)

### 6. Configurar o Frontend

No v0/Vercel, vá em **Settings** > **Vars** e adicione:

```
WHATSAPP_SERVICE_URL=https://whatsapp-service-xxxx.onrender.com
WHATSAPP_API_TOKEN=seu_token_secreto_aqui
```

Use o mesmo token que configurou na Render.

---

## Testar Localmente

```bash
cd whatsapp-service
npm install
npm run dev
```

O serviço estará em `http://localhost:3001`

### Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/health` | Verifica se o serviço está online |
| POST | `/connect` | Inicia conexão e gera QR Code |
| GET | `/qr` | Retorna o QR Code atual |
| GET | `/status` | Status da conexão |
| POST | `/disconnect` | Desconecta o WhatsApp |
| POST | `/send` | Envia mensagem |
| GET | `/messages` | Lista mensagens recebidas |

---

## Solução de Problemas

### QR Code não aparece
- Verifique se o serviço está rodando: `GET /health`
- Chame `POST /connect` primeiro
- Aguarde alguns segundos e chame `GET /qr`

### Erro de Puppeteer/Chrome
- O Dockerfile já inclui o Chromium necessário
- Se estiver rodando localmente, instale o Chrome/Chromium

### Sessão expira
- O serviço usa `LocalAuth` para persistir a sessão
- Se o container reiniciar, você precisará escanear o QR novamente

---

## Arquitetura

```
┌─────────────────┐         ┌──────────────────┐
│   Frontend      │  HTTP   │ WhatsApp Service │
│   (Vercel)      │────────>│    (Render)      │
│   Next.js       │         │   Express +      │
└─────────────────┘         │   Puppeteer      │
                            └────────┬─────────┘
                                     │
                                     v
                            ┌──────────────────┐
                            │   WhatsApp Web   │
                            │   (Browser)      │
                            └──────────────────┘
```
