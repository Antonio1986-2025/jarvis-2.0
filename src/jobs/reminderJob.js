const cron = require('node-cron');
const { getDueReminders, scheduleNextOrDeactivate } = require('../services/reminderService');
const { sendMessage } = require('../services/evolutionService');
require('dotenv').config();

const TIMEZONE = process.env.TIMEZONE || 'America/Sao_Paulo';

/**
 * Job que roda a cada minuto e verifica lembretes a disparar
 */
function startReminderJob() {
  // Roda todo minuto: "* * * * *"
  cron.schedule(
    '* * * * *',
    async () => {
      const reminders = await getDueReminders();

      if (reminders.length === 0) return;

      console.log(`[Job] ${reminders.length} lembrete(s) para disparar`);

      for (const reminder of reminders) {
        try {
          // Monta mensagem de disparo
          let msg = `⏰ *JARVIS — Lembrete*\n\n${reminder.label}`;

          if (reminder.advance_minutes > 0) {
            msg += `\n\n_(aviso com ${reminder.advance_minutes} minuto(s) de antecedência)_`;
          }

          await sendMessage(reminder.phone, msg);

          // Agenda próximo ou desativa
          await scheduleNextOrDeactivate(reminder);

          console.log(`[Job] Lembrete disparado: ${reminder.id} → ${reminder.phone}`);
        } catch (err) {
          console.error(`[Job] Erro ao disparar lembrete ${reminder.id}:`, err.message);
        }
      }
    },
    { timezone: TIMEZONE }
  );

  console.log(`[Job] Cron de lembretes iniciado (fuso: ${TIMEZONE})`);
}

module.exports = { startReminderJob };
