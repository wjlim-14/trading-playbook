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
    var { data, error } = await supabase.from('accounts').select('*').order('id');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'POST') {
    var body = await readBody(req);
    var { data, error } = await supabase.from('accounts').insert(body).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PATCH') {
    var body = await readBody(req);
    var id = body.id;
    delete body.id;
    var { data, error } = await supabase.from('accounts').update(body).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  if (req.method === 'DELETE') {
    var body = await readBody(req);
    var { error } = await supabase.from('accounts').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).end();
}
