-- ============================================================
-- JARVIS 2.0 — Tabela de Transações Financeiras
-- Execute no Supabase > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS transactions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone            TEXT NOT NULL DEFAULT 'dashboard',
  description      TEXT NOT NULL,
  amount           DECIMAL(12,2) NOT NULL,
  type             TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category         TEXT NOT NULL DEFAULT 'outros',
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes            TEXT DEFAULT '',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions (type);

COMMENT ON TABLE transactions IS 'Transações financeiras do JARVIS';
COMMENT ON COLUMN transactions.type IS 'income = receita, expense = despesa';
COMMENT ON COLUMN transactions.category IS 'Categoria: alimentacao, transporte, saude, lazer, salario, freelance, etc';
