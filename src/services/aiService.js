const openai = require('../config/openai');
const { toFile } = require('openai/uploads');
require('dotenv').config();

const TIMEZONE = process.env.TIMEZONE || 'America/Campo_Grande';

/**
 * Retorna a data atual em ISO 8601 com offset do timezone configurado
 * Ex: "2026-06-22T20:17:00-04:00"
 */
function nowInTimezone() {
  const date = new Date();
  // Pega offset em minutos do timezone
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    timeZoneName: 'shortOffset',
  });
  const parts = fmt.formatToParts(date);
  const offsetPart = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT-3';
  // Converte "GMT-4" em "-04:00"
  const match = offsetPart.match(/GMT([+-]?\d+)/);
  const offsetHours = match ? parseInt(match[1], 10) : -3;
  const sign = offsetHours >= 0 ? '+' : '-';
  const abs = Math.abs(offsetHours).toString().padStart(2, '0');
  const offsetStr = `${sign}${abs}:00`;

  // Formata data no timezone alvo
  const local = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const yyyy = local.getFullYear();
  const mm   = String(local.getMonth() + 1).padStart(2, '0');
  const dd   = String(local.getDate()).padStart(2, '0');
  const hh   = String(local.getHours()).padStart(2, '0');
  const mi   = String(local.getMinutes()).padStart(2, '0');
  const ss   = String(local.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${offsetStr}`;
}

/**
 * Usa GPT-4o para interpretar uma mensagem em linguagem natural
 * e extrair os dados do lembrete.
 */
async function parseReminderIntent(userMessage) {
  const now = nowInTimezone();

  const systemPrompt = `
Você é o JARVIS, assistente pessoal via WhatsApp. Agora é ${now} (fuso ${TIMEZONE}).

Quando o usuário pedir um lembrete, extraia as informações e responda SOMENTE com JSON válido neste formato:
{
  "is_reminder": true,
  "label": "descrição do lembrete",
  "first_fire_at": "ISO 8601 com offset (ex: 2026-06-22T20:19:00-04:00)",
  "interval_minutes": null ou número inteiro,
  "end_at": null ou "ISO 8601 com offset",
  "advance_minutes": 0
}

⚠️ REGRAS DE HORÁRIO (MUITO IMPORTANTE):
- TODOS os horários DEVEM estar em ISO 8601 com offset do fuso ${TIMEZONE}.
- Use o MESMO offset que aparece no "agora" acima.
- Exemplos válidos: "2026-06-22T20:19:00-04:00", "2026-06-23T15:00:00-04:00"
- Calcule horários relativos partindo SEMPRE de "agora" (${now}).
- "daqui 2 minutos" = agora + 2 minutos. NUNCA invente outro horário.

Outras regras:
- "interval_minutes" é o intervalo de repetição em minutos (null se for único).
- "end_at" é quando o lembrete para de repetir (null se for único).
- "advance_minutes" é quantos minutos ANTES do horário avisar (padrão 0).
- Se NÃO for pedido de lembrete, retorne: { "is_reminder": false }
- NUNCA adicione texto fora do JSON.

Exemplo: usuário diz "me lembre de tomar dipirona a cada 2 minutos por 6 minutos" e agora é "2026-06-22T20:17:00-04:00":
{
  "is_reminder": true,
  "label": "Tomar DIPIRONA 💊",
  "first_fire_at": "2026-06-22T20:19:00-04:00",
  "interval_minutes": 2,
  "end_at": "2026-06-22T20:23:00-04:00",
  "advance_minutes": 0
}
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    console.error('[AI] Resposta inválida do GPT:', raw);
    return { is_reminder: false };
  }
}

/**
 * Gera uma resposta de confirmação amigável para o usuário
 */
async function generateConfirmationMessage(label, firstFireAt, intervalMinutes, endAt, advanceMinutes) {
  const fmt = (iso) =>
    new Date(iso).toLocaleString('pt-BR', {
      timeZone: TIMEZONE,
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const prompt = `
Você é o JARVIS. Confirme o lembrete de forma simpática e direta, em no máximo 3 linhas.
Dados:
- Lembrete: ${label}
- Primeiro disparo: ${fmt(firstFireAt)}
- Repetição: ${intervalMinutes ? `a cada ${intervalMinutes} minutos` : 'único'}
- Fim: ${endAt ? fmt(endAt) : 'não se repete'}
- Antecedência: ${advanceMinutes} minutos antes

Use emoji. Fale como o JARVIS do Homem de Ferro.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

/**
 * Transcreve um áudio (Buffer) para texto usando Whisper
 */
async function transcribeAudio(buffer, mimeType = 'audio/ogg') {
  const ext = mimeType.includes('mp3') ? 'mp3'
            : mimeType.includes('mp4') ? 'mp4'
            : mimeType.includes('wav') ? 'wav'
            : 'ogg';

  const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'pt',
  });

  return transcription.text;
}

/**
 * Analisa uma imagem (base64) e retorna a intenção de lembrete (se houver),
 * combinando opcionalmente com a legenda da imagem.
 */
async function analyzeImageWithCaption(base64, mimeType = 'image/jpeg', caption = '') {
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // Primeiro, descreve o conteúdo da imagem
  const visionResp = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Descreva o conteúdo desta imagem de forma curta e objetiva, focando em informações que possam ser úteis para um lembrete (ex: data, hora, nome de evento, medicamento, compromisso). Se houver texto na imagem, transcreva-o.`,
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0,
  });

  const description = visionResp.choices[0].message.content;
  console.log('[AI] Descrição da imagem:', description);

  // Combina com a legenda do usuário (se tiver) e processa como lembrete
  const combined = caption
    ? `${caption}\n\n[Conteúdo da imagem: ${description}]`
    : `[Conteúdo da imagem: ${description}]`;

  return combined;
}

module.exports = {
  parseReminderIntent,
  generateConfirmationMessage,
  transcribeAudio,
  analyzeImageWithCaption,
};
