const { parseReminderIntent, generateConfirmationMessage } = require('../services/aiService');
const { createReminder } = require('../services/reminderService');
const { sendMessage } = require('../services/evolutionService');
require('dotenv').config();

// Lista de números autorizados (separados por vírgula no .env)
// Formato: 5567996543700 (com DDI + DDD + número)
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

    // ── Filtra apenas mensagens recebidas (não as enviadas pelo bot) ──
    const event = body?.event;
    if (event !== 'messages.upsert') return;

    const message = body?.data?.messages?.[0];
    if (!message) return;

    // Ignora mensagens enviadas pelo próprio bot
    if (message.key?.fromMe) return;

    // Extrai número e texto
    const phone = message.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const text  = message.message?.conversation
               || message.message?.extendedTextMessage?.text
               || '';

    if (!phone || !text.trim()) return;

    console.log(`[Webhook] Mensagem de ${phone}: "${text}"`);

    // ── Whitelist de números autorizados ──
    if (ALLOWED_PHONES.length > 0 && !ALLOWED_PHONES.includes(phone)) {
      console.log(`[Webhook] 🚫 Número ${phone} não autorizado. Ignorando.`);
      return;
    }

    // ── Interpreta com IA ──
    const intent = await parseReminderIntent(text);

    if (!intent.is_reminder) {
      // Por enquanto, só processa lembretes
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

    // ── Confirma para o usuário ──
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
  }
}

module.exports = { handleWebhook };
