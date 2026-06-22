const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

/**
 * Envia uma mensagem de texto pelo WhatsApp via Evolution API
 * @param {string} phone   - Número no formato 5511999999999
 * @param {string} message - Texto a enviar
 */
async function sendMessage(phone, message) {
  try {
    const url = `${BASE_URL}/message/sendText/${INSTANCE}`;

    const response = await axios.post(
      url,
      {
        number: phone,
        text: message,
      },
      {
        headers: {
          apikey: API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[Evolution] Mensagem enviada para ${phone}`);
    return response.data;
  } catch (error) {
    console.error('[Evolution] Erro ao enviar mensagem:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendMessage };
