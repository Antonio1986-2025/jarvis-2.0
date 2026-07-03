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
  getLogs,
} = require('../controllers/dashboardController');

router.get('/', serveDashboard);

router.get('/api/status', getStatus);
router.get('/api/stats', getStats);
router.get('/api/reminders', getReminders);
router.post('/api/reminders', postReminder);
router.patch('/api/reminders/:id', patchReminder);
router.delete('/api/reminders/:id', removeReminder);
router.get('/api/logs', getLogs);

module.exports = router;
