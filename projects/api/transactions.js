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

function fromDb(row) {
  return {
    id:           row.id,
    date:         row.date,
    accountId:    row.account_id,
    type:         row.type,
    amount:       Number(row.amount),
    balanceAfter: Number(row.balance_after),
    note:         row.note
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    var { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('id', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data.map(fromDb));
  }

  if (req.method === 'POST') {
    var body = await readBody(req);
    var row = {
      date:         body.date,
      account_id:   body.accountId,
      type:         body.type,
      amount:       body.amount,
      balance_after: body.balanceAfter,
      note:         body.note
    };
    var { data, error } = await supabase.from('transactions').insert(row).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(fromDb(data));
  }

  res.status(405).end();
}
