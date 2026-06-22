const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY, // service_role ignora Row Level Security
  {
    realtime: {
      transport: ws, // necessário para Node.js < 22
    },
  }
);

module.exports = supabase;
