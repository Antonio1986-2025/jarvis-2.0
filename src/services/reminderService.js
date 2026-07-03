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
 * Lista todos os lembretes, opcionalmente filtrados por status
 * @param {string} status - 'active', 'inactive', ou 'all'
 */
async function listReminders(status = 'all') {
  let query = supabase.from('reminders').select('*').order('created_at', { ascending: false });

  if (status === 'active') {
    query = query.eq('active', true);
  } else if (status === 'inactive') {
    query = query.eq('active', false);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Reminder] Erro ao listar lembretes:', error);
    return [];
  }
  return data || [];
}

/**
 * Retorna estatísticas dos lembretes
 */
async function getReminderStats() {
  try {
    const { count: total } = await supabase
      .from('reminders')
      .select('*', { count: 'exact', head: true });

    const { count: active } = await supabase
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    const { count: todayCount } = await supabase
      .from('reminders')
      .select('*', { count: 'exact', head: true })
      .gte('next_fire_at', todayStart)
      .lt('next_fire_at', todayEnd);

    const { data: pending } = await supabase
      .from('reminders')
      .select('id')
      .eq('active', true)
      .lte('next_fire_at', now.toISOString());

    return {
      total: total || 0,
      active: active || 0,
      today_count: todayCount || 0,
      pending: (pending || []).length,
    };
  } catch (err) {
    console.error('[Reminder] Erro ao buscar estatísticas:', err.message);
    return { total: 0, active: 0, today_count: 0, pending: 0 };
  }
}

/**
 * Atualiza um lembrete
 * @param {string} id - UUID do lembrete
 * @param {Object} updates - Campos a atualizar
 */
async function updateReminder(id, updates) {
  const allowedFields = ['label', 'next_fire_at', 'interval_minutes', 'end_at', 'advance_minutes', 'active'];
  const sanitized = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) {
      sanitized[key] = updates[key];
    }
  }

  const { data, error } = await supabase
    .from('reminders')
    .update(sanitized)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Reminder] Erro ao atualizar lembrete:', error);
    throw error;
  }
  return data;
}

/**
 * Remove (deleta) um lembrete
 * @param {string} id - UUID do lembrete
 */
async function deleteReminder(id) {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Reminder] Erro ao deletar lembrete:', error);
    throw error;
  }
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

module.exports = { createReminder, getDueReminders, scheduleNextOrDeactivate, listReminders, getReminderStats, updateReminder, deleteReminder };
