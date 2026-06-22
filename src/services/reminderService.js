const supabase = require('../config/supabase');

/**
 * Salva um ou mais lembretes no Supabase
 * @param {Object} data
 * @param {string} data.phone          - Número do remetente
 * @param {string} data.label          - Texto do lembrete (ex: "Tomar DIPIRONA")
 * @param {string} data.first_fire_at  - ISO string do primeiro disparo
 * @param {number|null} data.interval_minutes - Intervalo em minutos (null = único)
 * @param {string|null} data.end_at    - ISO string do último disparo (null = único)
 * @param {number} data.advance_minutes - Minutos de antecedência (0 = no horário)
 */
async function createReminder(data) {
  const { phone, label, first_fire_at, interval_minutes, end_at, advance_minutes } = data;

  // Calcula o próximo disparo levando em conta antecedência
  const fireDate   = new Date(first_fire_at);
  const adjustedAt = new Date(fireDate.getTime() - (advance_minutes || 0) * 60 * 1000);

  const { data: inserted, error } = await supabase
    .from('reminders')
    .insert([
      {
        phone,
        label,
        next_fire_at: adjustedAt.toISOString(),
        interval_minutes: interval_minutes || null,
        end_at: end_at || null,
        advance_minutes: advance_minutes || 0,
        active: true,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('[Reminder] Erro ao salvar lembrete:', error);
    throw error;
  }

  console.log('[Reminder] Lembrete criado:', inserted.id);
  return inserted;
}

/**
 * Busca todos os lembretes que precisam disparar agora (± 1 minuto)
 */
async function getDueReminders() {
  const now = new Date();
  const from = new Date(now.getTime() - 60 * 1000).toISOString(); // 1 min atrás
  const to   = new Date(now.getTime() + 60 * 1000).toISOString(); // 1 min à frente

  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('active', true)
    .gte('next_fire_at', from)
    .lte('next_fire_at', to);

  if (error) {
    console.error('[Reminder] Erro ao buscar lembretes:', error);
    return [];
  }

  return data || [];
}

/**
 * Após disparar, agenda o próximo disparo ou desativa o lembrete
 * @param {Object} reminder - Registro do banco
 */
async function scheduleNextOrDeactivate(reminder) {
  // Se não tem intervalo, é lembrete único → desativa
  if (!reminder.interval_minutes) {
    await supabase.from('reminders').update({ active: false }).eq('id', reminder.id);
    return;
  }

  const next = new Date(
    new Date(reminder.next_fire_at).getTime() + reminder.interval_minutes * 60 * 1000
  );

  // Se passou da data final, desativa
  if (reminder.end_at && next > new Date(reminder.end_at)) {
    await supabase.from('reminders').update({ active: false }).eq('id', reminder.id);
    return;
  }

  // Atualiza o próximo disparo
  await supabase
    .from('reminders')
    .update({ next_fire_at: next.toISOString() })
    .eq('id', reminder.id);
}

module.exports = { createReminder, getDueReminders, scheduleNextOrDeactivate };
