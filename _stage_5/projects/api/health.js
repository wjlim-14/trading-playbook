import { supabase, configError } from './_supabase.js';

/* Diagnostic endpoint — GET /api/health.
   Reports env-var presence, whether the URL looks right, and per-table
   reachability. Leaks no secrets (only the host + booleans + error text). */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  var url = process.env.SUPABASE_URL || '';
  var out = {
    ok: false,
    hasUrl: !!process.env.SUPABASE_URL,
    urlHost: url ? (url.split('/')[2] || null) : null,
    urlLooksCorrect: /^https:\/\/[a-z0-9-]+\.supabase\.co/i.test(url),
    hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    configError: configError || null,
    tables: {},
    hint: null
  };

  if (configError) {
    out.hint = 'Fix the env vars in Vercel → Settings → Environment Variables, then redeploy.';
    return res.status(200).json(out);
  }

  var names = ['accounts', 'trades', 'account_transactions', 'prefs'];
  for (var i = 0; i < names.length; i++) {
    try {
      var r = await supabase.from(names[i]).select('*', { count: 'exact', head: true });
      out.tables[names[i]] = r.error ? ('ERROR: ' + r.error.message) : 'ok';
    } catch (e) {
      out.tables[names[i]] = 'ERROR: ' + (e && e.message ? e.message : String(e));
    }
  }

  var allOk = names.every(function(n){ return out.tables[n] === 'ok'; });
  out.ok = allOk;
  if (!allOk) {
    var anyMissing = names.some(function(n){ return /does not exist|relation|not find/i.test(out.tables[n] || ''); });
    out.hint = anyMissing
      ? 'Tables missing — run migration_v2.sql in the Supabase SQL editor.'
      : 'Query failed — check the service_role key and that SUPABASE_URL matches the project.';
  }
  return res.status(200).json(out);
}
