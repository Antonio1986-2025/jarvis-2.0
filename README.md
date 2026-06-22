# 🤖 JARVIS 2.0 — Agente IA para WhatsApp

## Stack
- **Evolution API** — Envio/recebimento WhatsApp
- **Supabase** — Banco de dados dos lembretes
- **OpenAI GPT-4o** — Interpretação de linguagem natural
- **Node.js + Express** — Servidor webhook
- **node-cron** — Disparo dos lembretes

---

## 1. Configurar Banco de Dados (Supabase)

1. Acesse seu projeto em [supabase.com](https://supabase.com)
2. Vá em **SQL Editor**
3. Cole e execute o conteúdo de `supabase/migrations/001_create_reminders.sql`

---

## 2. Instalar dependências

```bash
npm install
```

---

## 3. Configurar variáveis de ambiente

O arquivo `.env` já está configurado com suas credenciais.
Verifique se o `EVOLUTION_INSTANCE` está correto (nome da instância criada na Evolution API).

---

## 4. Rodar o projeto

```bash
# Desenvolvimento (com auto-reload)
npm run dev

# Produção
npm start
```

---

## 5. Configurar Webhook na Evolution API

Após subir o servidor, configure o webhook:

**URL:** `https://SEU_DOMINIO/webhook`  
**Eventos:** `messages.upsert`

Via API:
```bash
curl -X POST https://robert-app-evolution-api.5jysmf.easypanel.host/webhook/set/jarvis \
  -H "apikey: 429683C4C977415CAAFCCE10F7D57E11" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://SEU_DOMINIO/webhook",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": ["MESSAGES_UPSERT"]
  }'
```

---

## 6. Testar

Mande uma mensagem no WhatsApp:
```
Jarvis me lembre de tomar DIPIRONA em 6 em 6 horas por 7 dias
```
```
Jarvis tenho reunião com João no dia 25/06 às 14h, me avisa 30 minutos antes
```

---

## Estrutura do Projeto

```
src/
├── config/
│   ├── supabase.js       — Cliente Supabase
│   └── openai.js         — Cliente OpenAI
├── controllers/
│   └── webhookController.js  — Processa mensagens recebidas
├── jobs/
│   └── reminderJob.js    — Cron que dispara lembretes
├── routes/
│   └── webhook.js        — Rota POST /webhook
└── services/
    ├── aiService.js       — Interpreta intenção com GPT-4o
    ├── evolutionService.js — Envia mensagens WhatsApp
    └── reminderService.js  — CRUD de lembretes no Supabase
```
