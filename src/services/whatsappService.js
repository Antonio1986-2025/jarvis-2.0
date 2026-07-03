const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcodeTerminal = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const AUTH_DIR = path.join(__dirname, '../../auth_info');

let sock = null;
let lastQR = null;
let connectionStatus = 'disconnected';

function getLastQR() {
  return lastQR;
}

function getConnectionStatus() {
  return { status: connectionStatus, hasQR: !!lastQR };
}

async function startWhatsApp(onMessageCallback) {
  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      lastQR = qr;
      connectionStatus = 'qr';
      console.log('\n========================================');
      console.log('  ESCANEIE O QR CODE COM O WHATSAPP');
      console.log('  Acesse /qr no navegador ou veja abaixo:');
      console.log('========================================\n');
      qrcodeTerminal.generate(qr, { small: true });
      console.log('\n========================================\n');
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error instanceof Boom
          ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
          : true;

      if (shouldReconnect) {
        connectionStatus = 'reconnecting';
        console.log('[WhatsApp] Reconectando em 5 segundos...');
        setTimeout(() => startWhatsApp(onMessageCallback), 5000);
      } else {
        connectionStatus = 'logged_out';
        console.log('[WhatsApp] Desconectado permanentemente (logout).');
      }
    }

    if (connection === 'open') {
      lastQR = null;
      connectionStatus = 'connected';
      console.log('[WhatsApp] Conectado ao WhatsApp!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (msg.key?.fromMe) continue;
      const jid = msg.key?.remoteJid || '';
      if (jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue;

      try {
        await onMessageCallback(sock, msg);
      } catch (err) {
        console.error('[WhatsApp] Erro ao processar mensagem:', err.message);
      }
    }
  });

  return sock;
}

async function sendMessage(phone, text) {
  const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

async function downloadMedia(msg) {
  return await downloadMediaMessage(msg, 'buffer', {});
}

async function resetAuth() {
  lastQR = null;
  if (fs.existsSync(AUTH_DIR)) {
    const files = fs.readdirSync(AUTH_DIR);
    for (const file of files) {
      fs.rmSync(path.join(AUTH_DIR, file), { recursive: true, force: true });
    }
    console.log('[WhatsApp] Auth limpo. Reiniciando...');
  }
  process.exit(0);
}

module.exports = { startWhatsApp, sendMessage, downloadMedia, getLastQR, getConnectionStatus, resetAuth };
