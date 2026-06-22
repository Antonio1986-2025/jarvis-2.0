require('dotenv').config();
const express = require('express');
const { startReminderJob } = require('./jobs/reminderJob');
const webhookRouter = require('./routes/webhook');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ──
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rotas ──
app.get('/health', (_req, res) => res.json({ status: 'JARVIS online ✅' }));
app.use('/webhook', webhookRouter);

// ── Inicia servidor ──
app.listen(PORT, () => {
  console.log(`\n🤖 JARVIS 2.0 iniciado na porta ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Webhook: http://localhost:${PORT}/webhook\n`);

  // ── Inicia o cron de lembretes ──
  startReminderJob();
});
