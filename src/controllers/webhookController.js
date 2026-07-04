const {
  parseIntent,
  generateConfirmationMessage,
  generateFinanceConfirmation,
  transcribeAudio,
  analyzeImageWithCaption,
} = require('../services/aiService');
const { createReminder } = require('../services/reminderService');
const { createTransaction } = require('../services/financeService');
const { sendMessage, downloadMedia } = require('../services/whatsappService');
require('dotenv').config();

async function handleBaileysMessage(sock, msg) {
  const jid = msg.key?.remoteJid || '';
  if (!jid) return;

  const message = msg.message || {};
  let userText = '';

  if (message.conversation) {
    userText = message.conversation;
    console.log(`[WhatsApp] Texto de ${jid}: "${userText}"`);
  } else if (message.extendedTextMessage?.text) {
    userText = message.extendedTextMessage.text;
    console.log(`[WhatsApp] Texto de ${jid}: "${userText}"`);
  } else if (message.audioMessage || message.pttMessage) {
    console.log(`[WhatsApp] Áudio recebido de ${jid}, baixando...`);
    const buffer = await downloadMedia(msg);
    const mimeType = message.audioMessage?.mimetype || 'audio/ogg';
    console.log('[WhatsApp] Transcrevendo com Whisper...');
    userText = await transcribeAudio(buffer, mimeType);
    console.log(`[WhatsApp] Transcrição: "${userText}"`);
    await sendMessage(jid, `_Entendi: "${userText}"_`);
  } else if (message.imageMessage) {
    console.log(`[WhatsApp] Imagem recebida de ${jid}, baixando...`);
    const buffer = await downloadMedia(msg);
    const base64 = buffer.toString('base64');
    const mimeType = message.imageMessage.mimetype || 'image/jpeg';
    const caption = message.imageMessage.caption || '';
    console.log('[WhatsApp] Analisando imagem com DeepSeek...');
    userText = await analyzeImageWithCaption(base64, mimeType, caption);
    console.log(`[WhatsApp] Conteúdo extraído: "${userText.slice(0, 200)}..."`);
  } else {
    console.log('[WhatsApp] Tipo de mensagem não suportado, ignorando');
    return;
  }

  if (!userText.trim()) return;

  let intent;
  try {
    intent = await parseIntent(userText);
  } catch (err) {
    console.error('[Webhook] Erro ao interpretar mensagem:', err.message);
    await sendMessage(jid, '😬 Não entendi o que você quis dizer. Pode repetir?');
    return;
  }

  if (intent.type === 'reminder') {
    try {
      await createReminder({
        phone: jid,
        label: intent.label,
        first_fire_at: intent.first_fire_at,
        interval_minutes: intent.interval_minutes,
        end_at: intent.end_at,
        advance_minutes: intent.advance_minutes || 0,
      });

      const confirmation = await generateConfirmationMessage(
        intent.label,
        intent.first_fire_at,
        intent.interval_minutes,
        intent.end_at,
        intent.advance_minutes || 0
      );

      await sendMessage(jid, confirmation);
    } catch (err) {
      console.error('[Webhook] Erro ao criar lembrete:', err.message);
      await sendMessage(jid, '😬 Não consegui criar o lembrete. Deu algum erro interno.');
    }
    return;
  }

  if (intent.type === 'finance') {
    try {
      await createTransaction({
        phone: jid,
        description: intent.description,
        amount: intent.amount,
        type: intent.transaction_type,
        category: intent.category,
      });

      const confirmation = await generateFinanceConfirmation(intent);
      await sendMessage(jid, confirmation);
    } catch (err) {
      console.error('[Webhook] Erro ao registrar transação:', err.message);
      await sendMessage(
        jid,
        '😬 Não consegui registrar. A tabela de finanças ainda não existe no banco. Peça pro Tony acessar o Supabase SQL Editor e rodar: CREATE TABLE transactions...'
      );
    }
    return;
  }

  await sendMessage(
    jid,
    '😅 Relaxa chefia, sou só o JARVIS. Entendo lembretes e finanças. Exemplos:\n📋 "me lembre de ..."\n💰 "gastei 45 no almoço" ou "recebi 5 mil de salário"'
  );
}

module.exports = { handleBaileysMessage };
