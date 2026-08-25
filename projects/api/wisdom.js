import { supabase } from './_supabase.js';

/*
  Mindset API (V6) — table: wisdom.
  Saved meaningful quotes and personal trading lessons.
  kind: 'quote' | 'lesson'. Global (not per-account, not LIVE/BACKTEST).
*/

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

function toDb(t) {
  var map = {
    kind:     'kind',
    text:     'text',
    author:   'author',
    title:    'title',
    category: 'category',
    favorite: 'favorite'
  };
  var row = {};
  Object.keys(map).forEach(function(k) {
    if (t[k] !== undefined) row[map[k]] = t[k];
  });
  return row;
}

function fromDb(row) {
  return {
    id:        row.id,
    kind:      row.kind || 'quote',
    text:      row.text || '',
    author:    row.author || '',
    title:     row.title || '',
    category:  row.category || '',
    favorite:  !!row.favorite,
    createdAt: row.created_at || null
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    try {
      var { data, error } = await supabase.from('wisdom').select('*').order('created_at', { ascending: false });
      if (error) {
        var r2 = await supabase.from('wisdom').select('*');
        if (r2.error) return res.status(200).json([]);   // never break startup on a read
        return res.json((r2.data || []).map(fromDb));
      }
      return res.json((data || []).map(fromDb));
    } catch (e) {
      return res.status(200).json([]);
    }
  }

  if (req.method === 'POST') {
    var body = await readBody(req);
    var { data, error } = await supabase.from('wisdom').insert(toDb(body)).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(fromDb(data));
  }

  if (req.method === 'PATCH') {
    var body = await readBody(req);
    if (!body.id) return res.status(400).json({ error: 'Missing id' });
    var { data, error } = await supabase.from('wisdom').update(toDb(body)).eq('id', body.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(fromDb(data));
  }

  if (req.method === 'DELETE') {
    var body = await readBody(req);
    var { error } = await supabase.from('wisdom').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).end();
}
