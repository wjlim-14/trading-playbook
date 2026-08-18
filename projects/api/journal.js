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

function toDb(t) {
  return {
    date:        t.date,
    account_id:  t.accountId,
    market:      t.market,
    asset:       t.asset,
    dir:         t.dir,
    entry:       t.entry,
    sl:          t.sl,
    tp:          t.tp,
    exit:        t.exit,
    units:       t.units,
    current_price: t.currentPrice,
    confluence1: t.confluence1,
    confluence2: t.confluence2,
    confluence3: t.confluence3,
    mood:        t.mood,
    review:      t.review,
    timeframes:    t.timeframes    || null,
    screenshot_url: t.screenshotUrl || null
  };
}

function fromDb(row) {
  return {
    id:           row.id,
    date:         row.date,
    accountId:    row.account_id,
    market:       row.market,
    asset:        row.asset,
    dir:          row.dir,
    entry:        row.entry    != null ? Number(row.entry)  : null,
    sl:           row.sl       != null ? Number(row.sl)     : null,
    tp:           row.tp       != null ? Number(row.tp)     : null,
    exit:         row.exit     != null ? Number(row.exit)   : null,
    units:        row.units    != null ? Number(row.units)  : null,
    currentPrice: row.current_price != null ? Number(row.current_price) : null,
    confluence1:  row.confluence1 || '',
    confluence2:  row.confluence2 || '',
    confluence3:  row.confluence3 || '',
    mood:         row.mood,
    review:       row.review,
    timeframes:    row.timeframes     || null,
    screenshotUrl: row.screenshot_url || null
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    var { data, error } = await supabase
      .from('journal')
      .select('*')
      .order('date', { ascending: true })
      .order('id',   { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data.map(fromDb));
  }

  if (req.method === 'POST') {
    var body = await readBody(req);
    var { data, error } = await supabase.from('journal').insert(toDb(body)).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(fromDb(data));
  }

  if (req.method === 'PATCH') {
    var body = await readBody(req);
    var id = body.id;
    var { data, error } = await supabase.from('journal').update(toDb(body)).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(fromDb(data));
  }

  if (req.method === 'DELETE') {
    var body = await readBody(req);
    var { error } = await supabase.from('journal').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).end();
}
