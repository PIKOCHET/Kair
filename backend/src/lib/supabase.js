const { createClient } = require('@supabase/supabase-js');

// Service role key bypasses RLS — use only on the backend, never expose to frontend
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = supabase;
