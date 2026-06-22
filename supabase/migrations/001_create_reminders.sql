-- ============================================================
-- JARVIS 2.0 — Tabela de Lembretes
-- Execute no Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS reminders (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone            TEXT NOT NULL,                  -- número WhatsApp (ex: 5511999999999)
  label            TEXT NOT NULL,                  -- descrição do lembrete
  next_fire_at     TIMESTAMPTZ NOT NULL,           -- próximo disparo (UTC)
  interval_minutes INTEGER DEFAULT NULL,           -- intervalo em minutos (null = único)
  end_at           TIMESTAMPTZ DEFAULT NULL,       -- data final da repetição (null = único)
  advance_minutes  INTEGER DEFAULT 0,              -- minutos de antecedência
  active           BOOLEAN DEFAULT TRUE,           -- false = desativado/concluído
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para o cron buscar rápido
CREATE INDEX IF NOT EXISTS idx_reminders_fire
  ON reminders (next_fire_at, active);

-- Comentários
COMMENT ON TABLE reminders IS 'Lembretes do JARVIS para disparar via WhatsApp';
COMMENT ON COLUMN reminders.phone IS 'Número no formato 5511999999999';
COMMENT ON COLUMN reminders.interval_minutes IS 'Nulo = lembrete único';
COMMENT ON COLUMN reminders.advance_minutes IS '0 = dispara no horário exato';
