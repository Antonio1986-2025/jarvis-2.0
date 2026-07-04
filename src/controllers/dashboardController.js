const path = require('path');
const QRCode = require('qrcode');
const {
  listReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  getReminderStats,
} = require('../services/reminderService');
const {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getFinanceStats,
  getCategoryBreakdown,
} = require('../services/financeService');
const { getLastQR, getConnectionStatus } = require('../services/whatsappService');
const supabase = require('../config/supabase');

async function serveDashboard(_req, res) {
  res.sendFile(path.join(__dirname, '..', 'views', 'dashboard.html'));
}

async function getStatus(_req, res) {
  const conn = getConnectionStatus();
  const qr = getLastQR();
  let qrDataUrl = null;

  if (qr) {
    qrDataUrl = await QRCode.toDataURL(qr, { scale: 4 });
  }

  res.json({
    ...conn,
    qr: qrDataUrl,
  });
}

async function getReminders(req, res) {
  const status = req.query.status || 'all';
  const reminders = await listReminders(status);
  res.json(reminders);
}

async function postReminder(req, res) {
  try {
    const { phone, label, first_fire_at, interval_minutes, end_at, advance_minutes } = req.body;

    if (!label || !first_fire_at) {
      return res.status(400).json({ error: 'label e first_fire_at são obrigatórios' });
    }

    const reminder = await createReminder({
      phone: phone || 'dashboard',
      label,
      first_fire_at,
      interval_minutes: interval_minutes || null,
      end_at: end_at || null,
      advance_minutes: advance_minutes || 0,
    });

    res.status(201).json(reminder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function patchReminder(req, res) {
  try {
    const { id } = req.params;
    const reminder = await updateReminder(id, req.body);
    res.json(reminder);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function removeReminder(req, res) {
  try {
    const { id } = req.params;
    await deleteReminder(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getStats(_req, res) {
  try {
    const stats = await getReminderStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getFinances(req, res) {
  try {
    const { type, category, start_date, end_date, limit, offset } = req.query;
    const transactions = await listTransactions({
      type, category,
      startDate: start_date,
      endDate: end_date,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function postFinance(req, res) {
  try {
    const tx = await createTransaction(req.body);
    res.status(201).json(tx);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function patchFinance(req, res) {
  try {
    const { id } = req.params;
    const tx = await updateTransaction(id, req.body);
    res.json(tx);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function removeFinance(req, res) {
  try {
    const { id } = req.params;
    await deleteTransaction(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getFinanceSummary(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const stats = await getFinanceStats({ startDate: start_date, endDate: end_date });
    const breakdown = await getCategoryBreakdown({ startDate: start_date, endDate: end_date });
    res.json({ ...stats, breakdown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getLogs(_req, res) {
  try {
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const createTableSQL = `
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL DEFAULT 'dashboard',
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL DEFAULT 'outros',
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);
`;

async function runMigrate(_req, res) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.json({
      success: false,
      message: 'DATABASE_URL não configurada. Adicione a connection string do Supabase nas variáveis do Railway.',
      sql: createTableSQL,
      supabase_sql_editor: 'https://supabase.com/dashboard/project/joyptemtydowkhopbbpa/sql/new',
    });
  }

  try {
    const { Client } = require('pg');
    const client = new Client({ connectionString: dbUrl, connectionTimeoutMillis: 10000 });
    await client.connect();
    await client.query(createTableSQL);
    await client.end();
    console.log('[Migrate] Tabela transactions criada com sucesso!');
    return res.json({ success: true, message: 'Tabela transactions criada com sucesso!' });
  } catch (err) {
    console.error('[Migrate] Erro ao criar tabela:', err.message);
    return res.json({ success: false, message: err.message, sql: createTableSQL });
  }
}

module.exports = {
  serveDashboard,
  getStatus,
  getReminders,
  postReminder,
  patchReminder,
  removeReminder,
  getStats,
  getFinances,
  postFinance,
  patchFinance,
  removeFinance,
  getFinanceSummary,
  getLogs,
  runMigrate,
};
