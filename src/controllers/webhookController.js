const {
  parseReminderIntent,
  generateConfirmationMessage,
  transcribeAudio,
  analyzeImageWithCaption,
} = require('../services/aiService');
const { createReminder } = require('../services/reminderService');
const { sendMessage, getMediaBase64 } = require('../services/evolutionService');
require('dotenv').config();

// Whitelist de números autorizados (separados por vírgula no .env)
const ALLOWED_PHONES = (process.env.ALLOWED_PHONES || '')
  .split(',')
  .map(n => n.trim())
  .filter(Boolean);

/**
 * Recebe o webhook da Evolution API e processa a mensagem
 */
async function handleWebhook(req, res) {
  // Responde imediatamente para a Evolution API não reenviar
  res.status(200).json({ ok: true });

  try {
    const body = req.body;
    console.log('[Webhook] >>> Evento recebido:', body?.event);

    // Filtra apenas mensagens recebidas
    const event = (body?.event || '').toLowerCase().replace('_', '.');
    if (event !== 'messages.upsert') return;

    const data = body?.data;
    if (!data) return;

    // Ignora mensagens enviadas pelo próprio bot
    if (data.key?.fromMe) return;

    // Ignora mensagens de grupos (qualquer @g.us)
    const remoteJid = data.key?.remoteJid || '';
    if (remoteJid.endsWith('@g.us')) {
      console.log('[Webhook] Mensagem de grupo, ignorando');
      return;
    }

    const phone = remoteJid.replace('@s.whatsapp.net', '');
    if (!phone) return;

    // ── Whitelist (antes de qualquer processamento custoso) ──
    if (ALLOWED_PHONES.length > 0 && !ALLOWED_PHONES.includes(phone)) {
      console.log(`[Webhook] 🚫 Número ${phone} não autorizado. Ignorando.`);
      return;
    }

    // ── Detecta o tipo de mensagem e extrai o texto ──
    const msg = data.message || {};
    let userText = '';

    if (msg.conversation) {
      // Texto puro
      userText = msg.conversation;
      console.log(`[Webhook] 📝 Texto de ${phone}: "${userText}"`);
    } else if (msg.extendedTextMessage?.text) {
      // Texto com formatação ou resposta
      userText = msg.extendedTextMessage.text;
      console.log(`[Webhook] 📝 Texto de ${phone}: "${userText}"`);
    } else if (msg.audioMessage || msg.pttMessage) {
      // ── Áudio ──
      console.log(`[Webhook] 🎙️  Áudio recebido de ${phone}, baixando...`);
      const { base64, mimetype } = await getMediaBase64(data);
      const buffer = Buffer.from(base64, 'base64');
      console.log('[Webhook] Transcrevendo com Whisper...');
      userText = await transcribeAudio(buffer, mimetype);
      console.log(`[Webhook] 🎙️  Transcrição: "${userText}"`);
      // Confirma a transcrição para o usuário
      await sendMessage(phone, `🎙️ _Entendi: "${userText}"_`);
    } else if (msg.imageMessage) {
      // ── Imagem ──
      console.log(`[Webhook] 🖼️  Imagem recebida de ${phone}, baixando...`);
      const { base64, mimetype } = await getMediaBase64(data);
      const caption = msg.imageMessage.caption || '';
      console.log('[Webhook] Analisando imagem com GPT-4o Vision...');
      userText = await analyzeImageWithCaption(base64, mimetype, caption);
      console.log(`[Webhook] 🖼️  Conteúdo extraído: "${userText.slice(0, 200)}..."`);
    } else {
      console.log('[Webhook] Tipo de mensagem não suportado, ignorando');
      return;
    }

    if (!userText.trim()) return;

    // ── Interpreta com IA ──
    const intent = await parseReminderIntent(userText);

    if (!intent.is_reminder) {
      await sendMessage(
        phone,
        '🤖 *JARVIS aqui.*\nNo momento só processo lembretes. Diga algo como:\n"Jarvis me lembre de tomar DIPIRONA em 6 em 6 horas por 7 dias"'
      );
      return;
    }

    // ── Salva lembrete ──
    await createReminder({
      phone,
      label:            intent.label,
      first_fire_at:    intent.first_fire_at,
      interval_minutes: intent.interval_minutes,
      end_at:           intent.end_at,
      advance_minutes:  intent.advance_minutes || 0,
    });

    // ── Confirma ──
    const confirmation = await generateConfirmationMessage(
      intent.label,
      intent.first_fire_at,
      intent.interval_minutes,
      intent.end_at,
      intent.advance_minutes || 0
    );

    await sendMessage(phone, confirmation);
  } catch (err) {
    console.error('[Webhook] Erro ao processar mensagem:', err.message);
    console.error(err.stack);
  }
}

module.exports = { handleWebhook };
