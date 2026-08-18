import { supabase } from './_supabase.js';

/*
  Accounts API — multi-account CRUD (V2).
  Fields map camelCase (client) <-> snake_case (db). PATCH is partial-safe.
  Soft-archive via isArchived; hard-delete via DELETE.
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

function toDb(a) {
  var map = {
    name:           'name',
    broker:         'broker',
    accountType:    'account_type',
    assetClass:     'asset_class',
    env:            'env',
    currency:       'currency',
    initialBalance: 'initial_balance',
    currentBalance: 'current_balance',
    isArchived:     'is_archived'
  };
  var row = {};
  Object.keys(map).forEach(function(k) {
    if (a[k] !== undefined) row[map[k]] = a[k];
  });
  return row;
}

function num(v) { return v != null ? Number(v) : 0; }

function fromDb(row) {
  return {
    id:             row.id,
    name:           row.name,
    broker:         row.broker || '',
    accountType:    row.account_type || 'PERSONAL_SPOT',
    assetClass:     row.asset_class || 'US_STOCK',
    env:            row.env || 'LIVE',
    currency:       row.currency || 'USD',
    initialBalance: num(row.initial_balance),
    currentBalance: num(row.current_balance),
    isArchived:     !!row.is_archived,
    createdAt:      row.created_at || null
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    var { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data.map(fromDb));
  }

  if (req.method === 'POST') {
    var body = await readBody(req);
    var { data, error } = await supabase.from('accounts').insert(toDb(body)).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(fromDb(data));
  }

  if (req.method === 'PATCH') {
    var body = await readBody(req);
    var id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    var { data, error } = await supabase.from('accounts').update(toDb(body)).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(fromDb(data));
  }

  if (req.method === 'DELETE') {
    var body = await readBody(req);
    var { error } = await supabase.from('accounts').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).end();
}
