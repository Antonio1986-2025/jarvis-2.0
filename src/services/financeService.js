const supabase = require('../config/supabase');

const VALID_TYPES = ['income', 'expense'];
const VALID_CATEGORIES = [
  'salario', 'freelance', 'investimentos', 'outras_receitas',
  'alimentacao', 'transporte', 'saude', 'lazer', 'moradia',
  'utilidades', 'educacao', 'assinaturas', 'outros',
];

async function listTransactions({ type, category, startDate, endDate, limit = 100, offset = 0 } = {}) {
  let query = supabase
    .from('transactions')
    .select('*')
    .order('transaction_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type && VALID_TYPES.includes(type)) {
    query = query.eq('type', type);
  }
  if (category) {
    query = query.eq('category', category);
  }
  if (startDate) {
    query = query.gte('transaction_date', startDate);
  }
  if (endDate) {
    query = query.lte('transaction_date', endDate);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[Finance] Erro ao listar:', error.message);
    return [];
  }
  return data || [];
}

async function createTransaction(data) {
  const { description, amount, type, category, transaction_date, notes, phone } = data;

  if (!description || amount == null || !type) {
    throw new Error('description, amount e type são obrigatórios');
  }
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`type deve ser income ou expense`);
  }

  const { data: inserted, error } = await supabase
    .from('transactions')
    .insert([{
      description,
      amount: Math.abs(parseFloat(amount)),
      type,
      category: category || 'outros',
      transaction_date: transaction_date || new Date().toISOString(),
      notes: notes || '',
      phone: phone || 'dashboard',
    }])
    .select()
    .single();

  if (error) {
    console.error('[Finance] Erro ao criar:', error.message);
    throw error;
  }
  return inserted;
}

async function updateTransaction(id, updates) {
  const allowed = ['description', 'amount', 'type', 'category', 'transaction_date', 'notes'];
  const sanitized = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      if (key === 'amount') sanitized[key] = Math.abs(parseFloat(updates[key]));
      else if (key === 'type' && !VALID_TYPES.includes(updates[key])) {
        throw new Error('type inválido');
      } else sanitized[key] = updates[key];
    }
  }

  const { data, error } = await supabase
    .from('transactions')
    .update(sanitized)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('[Finance] Erro ao atualizar:', error.message);
    throw error;
  }
  return data;
}

async function deleteTransaction(id) {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[Finance] Erro ao deletar:', error.message);
    throw error;
  }
}

async function getFinanceStats({ startDate, endDate } = {}) {
  try {
    let query = supabase.from('transactions').select('type, amount');

    if (startDate) query = query.gte('transaction_date', startDate);
    if (endDate) query = query.lte('transaction_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    const transactions = data || [];
    let totalIncome = 0;
    let totalExpense = 0;

    for (const t of transactions) {
      if (t.type === 'income') totalIncome += parseFloat(t.amount);
      else totalExpense += parseFloat(t.amount);
    }

    const { count: totalCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    return {
      total_income: totalIncome,
      total_expense: totalExpense,
      balance: totalIncome - totalExpense,
      transaction_count: totalCount || 0,
    };
  } catch (err) {
    console.error('[Finance] Erro ao buscar stats:', err.message);
    return { total_income: 0, total_expense: 0, balance: 0, transaction_count: 0 };
  }
}

async function getCategoryBreakdown({ startDate, endDate, type } = {}) {
  try {
    let query = supabase.from('transactions').select('category, amount, type');

    if (type && VALID_TYPES.includes(type)) query = query.eq('type', type);
    if (startDate) query = query.gte('transaction_date', startDate);
    if (endDate) query = query.lte('transaction_date', endDate);

    const { data, error } = await query;
    if (error) throw error;

    const breakdown = {};
    for (const t of data || []) {
      const cat = t.category || 'outros';
      if (!breakdown[cat]) breakdown[cat] = 0;
      breakdown[cat] += parseFloat(t.amount);
    }

    return Object.entries(breakdown)
      .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount);
  } catch (err) {
    console.error('[Finance] Erro ao buscar categorias:', err.message);
    return [];
  }
}

module.exports = {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getFinanceStats,
  getCategoryBreakdown,
  VALID_CATEGORIES,
};
