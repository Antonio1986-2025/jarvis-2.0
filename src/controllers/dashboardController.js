const path = require('path');
const QRCode = require('qrcode');
const {
  listReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  getReminderStats,
} = require('../services/reminderService');
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

module.exports = {
  serveDashboard,
  getStatus,
  getReminders,
  postReminder,
  patchReminder,
  removeReminder,
  getStats,
  getLogs,
};
