/**
 * Configura o webhook na Evolution API para apontar para o JARVIS
 * Execute: node scripts/setup-webhook.js
 */
require('dotenv').config();
const https = require('https');

const EVOLUTION_URL = 'robert-app-evolution-api.5jysmf.easypanel.host';
const API_KEY       = '429683C4C977415CAAFCCE10F7D57E11';
const INSTANCE      = 'jarvis';
const WEBHOOK_URL   = 'https://robert-app-jarvis.5jysmf.easypanel.host/webhook';

const payload = JSON.stringify({
  webhook: {
    enabled: true,
    url: WEBHOOK_URL,
    webhookByEvents: false,
    webhookBase64: false,
    events: ['MESSAGES_UPSERT'],
  },
});

const options = {
  hostname: EVOLUTION_URL,
  path: `/webhook/set/${INSTANCE}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: API_KEY,
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log('Configurando webhook...');
console.log(`  Instance: ${INSTANCE}`);
console.log(`  Webhook : ${WEBHOOK_URL}\n`);

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => (data += chunk));
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    console.log('Resposta:', data);
  });
});

req.on('error', (e) => console.error('Erro:', e.message));
req.write(payload);
req.end();
