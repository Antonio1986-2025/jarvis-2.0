/**
 * Script para criar a tabela reminders no Supabase
 * Execute: node scripts/setup-db.js
 */
require('dotenv').config();
const https = require('https');

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PROJECT_REF = 'joyptemtydowkhopbbpa';

const sql = [
  "CREATE TABLE IF NOT EXISTS reminders (",
  "  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,",
  "  phone            TEXT NOT NULL,",
  "  label            TEXT NOT NULL,",
  "  next_fire_at     TIMESTAMPTZ NOT NULL,",
  "  interval_minutes INTEGER DEFAULT NULL,",
  "  end_at           TIMESTAMPTZ DEFAULT NULL,",
  "  advance_minutes  INTEGER DEFAULT 0,",
  "  active           BOOLEAN DEFAULT TRUE,",
  "  created_at       TIMESTAMPTZ DEFAULT NOW()",
  ");",
  "CREATE INDEX IF NOT EXISTS idx_reminders_fire ON reminders (next_fire_at, active);"
].join('\n');

const body = JSON.stringify({ query: sql });

const options = {
  hostname: `${PROJECT_REF}.supabase.co`,
  path: '/rest/v1/rpc/exec_sql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log('Criando tabela reminders no Supabase...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 204) {
      console.log('✅ Tabela criada com sucesso!');
    } else {
      // exec_sql não existe — vamos usar a Management API
      console.log(`Status ${res.statusCode}: ${data}`);
      console.log('\nTentando via Management API...');
      createViaManagementApi();
    }
  });
});

req.on('error', (e) => {
  console.error('Erro:', e.message);
  createViaManagementApi();
});

req.write(body);
req.end();

function createViaManagementApi() {
  // Supabase Management API — requer Personal Access Token, não service_role
  // Vamos apenas verificar a conexão e informar o usuário
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    `https://${PROJECT_REF}.supabase.co`,
    SERVICE_KEY
  );

  // Testa se a tabela já existe após tentativa anterior
  supabase.from('reminders').select('id').limit(1).then(({ error }) => {
    if (!error) {
      console.log('✅ Tabela reminders já existe e está acessível!');
    } else {
      console.log('\n⚠️  Não foi possível criar a tabela via API automaticamente.');
      console.log('Por favor, execute manualmente no Supabase SQL Editor:');
      console.log('\n--- COPIE O SQL ABAIXO ---\n');
      console.log(sql);
      console.log('\n--- FIM DO SQL ---\n');
      console.log('Acesse: https://supabase.com/dashboard/project/joyptemtydowkhopbbpa/sql/new');
    }
  });
}
