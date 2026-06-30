const { createClient } = require('@supabase/supabase-js');

// Uses the service_role key - this file only ever runs on the server
// (Vercel functions), never in the browser, so it's safe to use the
// powerful key here.
function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

module.exports = { getSupabase };
