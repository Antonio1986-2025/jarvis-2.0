const express = require('express');
const router  = express.Router();
const { handleWebhook } = require('../controllers/webhookController');

// POST /webhook  ← Evolution API aponta aqui
router.post('/', handleWebhook);

module.exports = router;
