require('dotenv').config();
const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const { startReminderJob } = require('./jobs/reminderJob');
const { startWhatsApp, getLastQR } = require('./services/whatsappService');
const { handleBaileysMessage } = require('./controllers/webhookController');
const dashboardRoutes = require('./routes/dashboard');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (_req, res) => res.json({ app: 'JARVIS 2.0', status: 'online', webhook: '/webhook', health: '/health', qr: '/qr', dashboard: '/dashboard' }));
app.get('/health', (_req, res) => res.json({ status: 'JARVIS online' }));

app.get('/qr', async (_req, res) => {
  const qr = getLastQR();
  if (!qr) {
    return res.send(`
      <html>
      <head><meta http-equiv="refresh" content="5"></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;">
        <h2>JARVIS 2.0</h2>
        <p>Aguardando QR Code...</p>
        <p>Se nenhum QR aparecer em 30 segundos, acesse /reset-auth e tente novamente.</p>
        <p>Recarregando automaticamente em 5 segundos...</p>
      </body>
      </html>
    `);
  }

  const qrImage = await QRCode.toDataURL(qr, { scale: 4 });
  res.send(`
    <html>
    <head><meta http-equiv="refresh" content="30"></head>
    <body style="font-family:sans-serif;text-align:center;padding:40px;">
      <h2>Escaneie o QR Code com o WhatsApp</h2>
      <p>Abra o WhatsApp no celular > Menu > Dispositivos conectados > Conectar</p>
      <img src="${qrImage}" style="width:150px;height:150px;image-rendering:pixelated;" />
      <p style="color:gray;font-size:14px;">QR valido por tempo limitado. A pagina recarrega a cada 30s.</p>
    </body>
    </html>
  `);
});

app.use('/dashboard', dashboardRoutes);

app.listen(PORT, () => {
  console.log(`JARVIS 2.0 iniciado na porta ${PORT}`);
  console.log(`   Health:   http://localhost:${PORT}/health`);
  console.log(`   QR:       http://localhost:${PORT}/qr`);
  console.log(`   Dashboard: http://localhost:${PORT}/dashboard`);

  startReminderJob();
  startWhatsApp(handleBaileysMessage);
});
