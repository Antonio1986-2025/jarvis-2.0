const openai = require('../config/openai');
require('dotenv').config();

const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';

/**
 * Usa GPT-4o para interpretar uma mensagem em linguagem natural
 * e extrair os dados do lembrete.
 *
 * Retorna JSON com:
 * {
 *   label: string,            // descrição do lembrete
 *   first_fire_at: string,    // ISO 8601 do primeiro disparo
 *   interval_minutes: number|null,
 *   end_at: string|null,      // ISO 8601 do último disparo
 *   advance_minutes: number,  // antecedência padrão = 0
 *   is_reminder: boolean      // false se não for pedido de lembrete
 * }
 */
async function parseReminderIntent(userMessage) {
  const now = new Date().toLocaleString('pt-BR', { timeZone: TIMEZONE });

  const systemPrompt = `
Você é o JARVIS, assistente pessoal via WhatsApp. Hoje é ${now} (fuso: ${TIMEZONE}).

Quando o usuário pedir um lembrete, extraia as informações e responda SOMENTE com JSON válido neste formato:
{
  "is_reminder": true,
  "label": "descrição do lembrete",
  "first_fire_at": "YYYY-MM-DDTHH:mm:ss",
  "interval_minutes": null ou número inteiro,
  "end_at": null ou "YYYY-MM-DDTHH:mm:ss",
  "advance_minutes": 0
}

Regras:
- "first_fire_at" é o primeiro momento em que deve disparar.
- "interval_minutes" é o intervalo de repetição em minutos (null se for único).
- "end_at" é quando o lembrete para de repetir (null se for único).
- "advance_minutes" é quantos minutos ANTES do horário o usuário quer ser avisado (padrão 0).
- Se o usuário disser "me lembre 30 minutos antes", coloque advance_minutes: 30.
- Se NÃO for pedido de lembrete, retorne: { "is_reminder": false }
- NUNCA adicione texto fora do JSON.

Exemplos:
Usuário: "Jarvis me lembre de tomar DIPIRONA em 6 em 6 horas por 7 dias"
Resposta:
{
  "is_reminder": true,
  "label": "Tomar DIPIRONA 💊",
  "first_fire_at": "<agora + 6h>",
  "interval_minutes": 360,
  "end_at": "<agora + 7 dias>",
  "advance_minutes": 0
}

Usuário: "Jarvis tenho reunião com CLIENTE no dia 23/06 às 15h, me avisa 30 minutos antes"
Resposta:
{
  "is_reminder": true,
  "label": "Reunião com CLIENTE 📅",
  "first_fire_at": "<data 23/06 15:00:00>",
  "interval_minutes": null,
  "end_at": null,
  "advance_minutes": 30
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
  const prompt = `
Você é o JARVIS. Confirme o lembrete criado de forma simpática e direta.
Dados:
- Lembrete: ${label}
- Primeiro disparo: ${new Date(firstFireAt).toLocaleString('pt-BR', { timeZone: TIMEZONE })}
- Repetição: ${intervalMinutes ? `a cada ${intervalMinutes} minutos` : 'único'}
- Fim: ${endAt ? new Date(endAt).toLocaleString('pt-BR', { timeZone: TIMEZONE }) : 'não se repete'}
- Antecedência: ${advanceMinutes} minutos antes

Responda em no máximo 3 linhas, com emoji. Fale como o JARVIS do Homem de Ferro.
`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

module.exports = { parseReminderIntent, generateConfirmationMessage };
