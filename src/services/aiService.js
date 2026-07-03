const deepseek = require('../config/deepseek');
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

const CATEGORIES_LIST = [
  'salario', 'freelance', 'investimentos', 'outras_receitas',
  'alimentacao', 'transporte', 'saude', 'lazer', 'moradia',
  'utilidades', 'educacao', 'assinaturas', 'outros',
];

/**
 * Interpreta a intenção do usuário: lembrete, transação financeira ou nenhum.
 */
async function parseIntent(userMessage) {
  const now = nowInTimezone();
  const categories = CATEGORIES_LIST.join(', ');

  const systemPrompt = `
Você é o JARVIS, assistente pessoal via WhatsApp. Agora é ${now} (fuso ${TIMEZONE}).

Detecte a intenção do usuário e responda SOMENTE com JSON válido. NUNCA adicione texto fora do JSON.

### 1) LEMBRETE
Formato:
{
  "type": "reminder",
  "label": "descrição do lembrete",
  "first_fire_at": "ISO 8601 com offset (ex: 2026-06-22T20:19:00-04:00)",
  "interval_minutes": null ou número inteiro,
  "end_at": null ou "ISO 8601 com offset",
  "advance_minutes": 0
}
Regras de horário:
- TODOS os horários DEVEM estar em ISO 8601 com offset do fuso ${TIMEZONE}.
- Use o MESMO offset do "agora" acima.
- Exemplos: "2026-06-22T20:19:00-04:00"
- Calcule horários relativos partindo de "agora" (${now}).
- "interval_minutes" é repetição em minutos (null se único).
- "end_at" é fim da repetição (null se único).
- "advance_minutes" é antecedência em minutos (padrão 0).

### 2) TRANSAÇÃO FINANCEIRA
Quando o usuário relatar um gasto, receita, pagamento, depósito etc.
Formato:
{
  "type": "finance",
  "action": "create",
  "transaction_type": "income" ou "expense",
  "description": "descrição curta do que foi",
  "amount": número (sempre positivo),
  "category": "uma das categorias válidas"
}
Categorias válidas para "category": ${categories}
Mapeamento semântico:
- "salario", "salário", "pagamento", "holerite" → salario
- "freela", "freelance", "bico", "extra" → freelance
- "investimento", "dividendo", "juros" → investimentos
- "comida", "mercado", "restaurante", "almoço", "jantar", "lanche", "pizza" → alimentacao
- "uber", "taxi", "ônibus", "gasolina", "combustível", "pedágio" → transporte
- "médico", "farmácia", "remédio", "exame", "plano de saúde" → saude
- "cinema", "ifood", "jogo", "festa", "netflix", "streaming" → lazer
- "aluguel", "condomínio", "conta de luz", "água", "iptu" → moradia
- "internet", "telefone", "gás" → utilidades
- "curso", "faculdade", "escola", "material" → educacao
- "spotify", "assinatura", "mensalidade" → assinaturas
- Qualquer outro → outros

### 3) NENHUM
Se não for lembrete nem transação:
{ "type": "none" }

Exemplos:
- "me lembre de tomar dipirona a cada 2 minutos por 6 minutos" + agora "2026-06-22T20:17:00-04:00":
  { "type":"reminder","label":"Tomar DIPIRONA 💊","first_fire_at":"2026-06-22T20:19:00-04:00","interval_minutes":2,"end_at":"2026-06-22T20:23:00-04:00","advance_minutes":0 }

- "gastei 45 conto no almoço":
  { "type":"finance","action":"create","transaction_type":"expense","description":"Almoço","amount":45,"category":"alimentacao" }

- "recebi 5 mil de salário":
  { "type":"finance","action":"create","transaction_type":"income","description":"Salário","amount":5000,"category":"salario" }
`;

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage },
    ],
    temperature: 0,
  });

  const raw = response.choices[0].message.content;
  try {
    return JSON.parse(raw);
  } catch {
    console.error('[AI] Resposta inválida do DeepSeek:', raw);
    return { type: 'none' };
  }
}

/**
 * Wrapper compatível com o código antigo que espera parseReminderIntent
 */
async function parseReminderIntent(userMessage) {
  const intent = await parseIntent(userMessage);
  if (intent.type === 'reminder') {
    return {
      is_reminder: true,
      label: intent.label,
      first_fire_at: intent.first_fire_at,
      interval_minutes: intent.interval_minutes,
      end_at: intent.end_at,
      advance_minutes: intent.advance_minutes || 0,
    };
  }
  return { is_reminder: false };
}

/**
 * Gera uma resposta de confirmação amigável para o usuário (lembrete)
 */
async function generateConfirmationMessage(label, firstFireAt, intervalMinutes, endAt, advanceMinutes) {
  const fmt = (iso) =>
    new Date(iso).toLocaleString('pt-BR', {
      timeZone: TIMEZONE,
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const prompt = `
Você é o JARVIS, assistente pessoal do Tony Stark — mas versão Brazil. Responda de forma descontraída, informal, como se fosse um amigo ajudando. Use gírias, emojis e seja direto. Máximo 3 linhas.
Dados:
- Lembrete: ${label}
- Primeiro disparo: ${fmt(firstFireAt)}
- Repetição: ${intervalMinutes ? `a cada ${intervalMinutes} minutos` : 'único'}
- Fim: ${endAt ? fmt(endAt) : 'não se repete'}
- Antecedência: ${advanceMinutes} minutos antes
`;

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  return response.choices[0].message.content;
}

/**
 * Gera uma confirmação amigável para transação financeira
 */
async function generateFinanceConfirmation(data) {
  const typeLabel = data.transaction_type === 'income' ? 'Receita' : 'Despesa';
  const prompt = `
Você é o JARVIS. Confirme o registro financeiro de forma descontraída, informal, máxima 2 linhas, com 1 emoji.
Dados:
- Tipo: ${typeLabel}
- Descrição: ${data.description}
- Valor: R$ ${data.amount}
- Categoria: ${data.category}
`;

  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
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
  const visionResp = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
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
  parseIntent,
  parseReminderIntent,
  generateConfirmationMessage,
  generateFinanceConfirmation,
  transcribeAudio,
  analyzeImageWithCaption,
};
