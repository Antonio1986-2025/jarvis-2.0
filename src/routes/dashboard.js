const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/dashboardController');

router.get('/', serveDashboard);

router.get('/api/status', getStatus);
router.get('/api/stats', getStats);
router.get('/api/reminders', getReminders);
router.post('/api/reminders', postReminder);
router.patch('/api/reminders/:id', patchReminder);
router.delete('/api/reminders/:id', removeReminder);

router.get('/api/finances', getFinances);
router.post('/api/finances', postFinance);
router.patch('/api/finances/:id', patchFinance);
router.delete('/api/finances/:id', removeFinance);
router.get('/api/finances/summary', getFinanceSummary);

router.get('/api/logs', getLogs);
router.post('/api/migrate', runMigrate);

module.exports = router;
