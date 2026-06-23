const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.EVOLUTION_API_URL;
const API_KEY  = process.env.EVOLUTION_API_KEY;
const INSTANCE = process.env.EVOLUTION_INSTANCE;

/**
 * Envia uma mensagem de texto pelo WhatsApp via Evolution API
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

/**
 * Baixa o conteúdo de uma mídia (áudio, imagem, vídeo) em Base64
 * @param {Object} messageData - Objeto data do webhook (com key e message)
 * @returns {{base64: string, mimetype: string}}
 */
async function getMediaBase64(messageData) {
  try {
    const url = `${BASE_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`;

    const response = await axios.post(
      url,
      {
        message: {
          key: messageData.key,
        },
        convertToMp4: false,
      },
      {
        headers: {
          apikey: API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return {
      base64: response.data.base64,
      mimetype: response.data.mimetype || 'application/octet-stream',
    };
  } catch (error) {
    console.error('[Evolution] Erro ao baixar mídia:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendMessage, getMediaBase64 };
