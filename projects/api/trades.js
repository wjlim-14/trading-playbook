import { supabase } from './_supabase.js';

/*
  Trades API — the core V2 record store (replaces the old `journal` table).
  Handles the full PLANNING -> ACTIVE -> CLOSED lifecycle plus dual grading,
  cash-flow-isolated realized PnL, chart screenshot URLs and post-trade review.

  Query params on GET:
    ?mode=LIVE|BACKTEST   filter by trading mode (default: no filter)
    ?accountId=<uuid>     filter by account
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

/* camelCase (client) -> snake_case (db). Only maps keys that are present,
   so PATCH stays a partial update and never nulls untouched columns. */
function toDb(t) {
  var map = {
    accountId:       'account_id',
    mode:            'mode',
    ticker:          'ticker',
    direction:       'direction',
    assetType:       'asset_type',
    status:          'status',
    entryPrice:      'entry_price',
    stopLossPrice:   'stop_loss_price',
    targetPrice:     'target_price',
    positionSize:    'position_size',
    riskAmount:      'risk_amount',
    riskPct:         'risk_pct',
    plannedRR:       'planned_rr',
    entryGrade:      'entry_grade',
    preTradeMood:    'pre_trade_mood',
    entryReasonTags: 'entry_reason_tags',
    preChartUrl4H:   'pre_chart_url_4h',
    preChartUrl1H:   'pre_chart_url_1h',
    tfHigh:          'tf_high',
    tfLow:           'tf_low',
    preShots:        'pre_shots',
    postShots:       'post_shots',
    entryTimestamp:  'entry_timestamp',
    setupNotes:      'setup_notes',
    executedSize:    'executed_size',
    avgEntry:        'avg_entry',
    openSize:        'open_size',
    contractValue:   'contract_value',
    entries:         'entries',
    exits:           'exits',
    exitPrice:       'exit_price',
    exitTimestamp:   'exit_timestamp',
    realizedPnL:     'realized_pnl',
    realizedR:       'realized_r',
    exitGrade:       'exit_grade',
    postChartUrl4H:  'post_chart_url_4h',
    postChartUrl1H:  'post_chart_url_1h',
    mistakeTags:     'mistake_tags',
    reflectionNote:  'reflection_note',
    reviewComplete:  'review_complete',
    log:             'log'
  };
  var row = {};
  Object.keys(map).forEach(function(k) {
    if (t[k] !== undefined) row[map[k]] = t[k];
  });
  return row;
}

function num(v) { return v != null ? Number(v) : null; }

function fromDb(row) {
  return {
    id:              row.id,
    accountId:       row.account_id,
    mode:            row.mode || 'LIVE',
    ticker:          row.ticker,
    direction:       row.direction,
    assetType:       row.asset_type,
    status:          row.status,
    entryPrice:      num(row.entry_price),
    stopLossPrice:   num(row.stop_loss_price),
    targetPrice:     num(row.target_price),
    positionSize:    num(row.position_size),
    riskAmount:      num(row.risk_amount),
    riskPct:         num(row.risk_pct),
    plannedRR:       num(row.planned_rr),
    entryGrade:      row.entry_grade || null,
    preTradeMood:    row.pre_trade_mood || null,
    entryReasonTags: row.entry_reason_tags || [],
    preChartUrl4H:   row.pre_chart_url_4h || null,
    preChartUrl1H:   row.pre_chart_url_1h || null,
    tfHigh:          row.tf_high || null,
    tfLow:           row.tf_low || null,
    preShots:        row.pre_shots || [],
    postShots:       row.post_shots || [],
    entryTimestamp:  row.entry_timestamp || null,
    setupNotes:      row.setup_notes || '',
    executedSize:    num(row.executed_size),
    avgEntry:        num(row.avg_entry),
    openSize:        num(row.open_size),
    contractValue:   num(row.contract_value),
    entries:         row.entries || [],
    exits:           row.exits || [],
    exitPrice:       num(row.exit_price),
    exitTimestamp:   row.exit_timestamp || null,
    realizedPnL:     num(row.realized_pnl),
    realizedR:       num(row.realized_r),
    exitGrade:       row.exit_grade || null,
    postChartUrl4H:  row.post_chart_url_4h || null,
    postChartUrl1H:  row.post_chart_url_1h || null,
    mistakeTags:     row.mistake_tags || [],
    reflectionNote:  row.reflection_note || '',
    reviewComplete:  !!row.review_complete,
    log:             row.log || [],
    createdAt:       row.created_at || null
  };
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET') {
    var q = supabase.from('trades').select('*');
    var url = new URL(req.url, 'http://x');
    var mode = url.searchParams.get('mode');
    var accountId = url.searchParams.get('accountId');
    if (mode) q = q.eq('mode', mode);
    if (accountId) q = q.eq('account_id', accountId);
    var { data, error } = await q
      .order('created_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data.map(fromDb));
  }

  if (req.method === 'POST') {
    var body = await readBody(req);
    var { data, error } = await supabase.from('trades').insert(toDb(body)).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(fromDb(data));
  }

  if (req.method === 'PATCH') {
    var body = await readBody(req);
    var id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    var patch = toDb(body);
    var { data, error } = await supabase.from('trades').update(patch).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(fromDb(data));
  }

  if (req.method === 'DELETE') {
    var body = await readBody(req);
    var { error } = await supabase.from('trades').delete().eq('id', body.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.status(405).end();
}
