import { supabase } from './_supabase.js';

/*
  Cash Flow Transactions API (V2) — table: account_transactions.
  Types: DEPOSIT | WITHDRAWAL | PROP_PAYOUT | FEE_ADJUSTMENT.
  Balance is COMPUTED on the client (never stored per-row) so cash flow
  stays strictly isolated from trading statistics.

  GET ?accountId=<uuid> to filter by account.
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
    accountId: 'account_id',
    type:      'type',
    amount:    'amount',
    fee:       'fee',
    date:      'date',
    notes:     'notes'
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
    accountId: row.account_id,
    type:      row.type,
    amount:    Number(row.amount),
    fee:       row.fee != null ? Number(row.fee) : 0,
    date:      row.date,
    notes:     row.notes || '',
    createdAt: row.created_at || null
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    var url = new URL(req.url, 'http://x');
    var accountId = url.searchParams.get('accountId');
    try {
      var q = supabase.from('account_transactions').select('*');
      if (accountId) q = q.eq('account_id', accountId);
      var { data, error } = await q.order('created_at', { ascending: true });
      if (error) {
        // retry once without ordering, then give up gracefully
        var r2q = supabase.from('account_transactions').select('*');
        if (accountId) r2q = r2q.eq('account_id', accountId);
        var r2 = await r2q;
        if (r2.error) return res.status(200).json([]);   // never break app startup on a read
        return res.json((r2.data || []).map(fromDb));
      }
      return res.json((data || []).map(fromDb));
    } catch (e) {
      return res.status(200).json([]);
    }
  }

  if (req.method === 'POST') {
    var body = await readBody(req);
    var { data, error } = await supabase.from('account_transactions').insert(toDb(body)).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(fromDb(data));
  }

  if (req.method === 'PATCH') {
    var body = await readBody(req);
    var id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    var { data, error } = await supabase.from('account_transactions').update(toDb(body)).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(fromDb(data));
  }

  if (req.method === 'DELETE') {
    var body = await readBody(req);
    var { error } = await supabase.from('account_transactions').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).end();
}
