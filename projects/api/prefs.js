import { supabase } from './_supabase.js';

function readBody(req) {
  return new Promise(function(resolve, reject) {
    var data = '';
    req.on('data', function(c) { data += c; });
    req.on('end', function() {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch(e) { reject(e); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    var { data, error } = await supabase
      .from('prefs')
      .select('value')
      .eq('key', 'settings')
      .single();
    if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message });
    var defaults = { defaultRiskPct: 2, dailyLimitPct: 6, mode: 'LIVE', activeAccountId: null };
    return res.json(data ? Object.assign(defaults, data.value) : defaults);
  }

  if (req.method === 'PUT') {
    var body = await readBody(req);
    var { error } = await supabase
      .from('prefs')
      .upsert({ key: 'settings', value: body });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(body);
  }

  res.status(405).end();
}
