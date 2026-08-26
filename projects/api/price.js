/*
  Live price proxy (V7).
    GET /api/price?type=crypto&symbol=BTCUSDT   -> Binance public ticker (no key)
    GET /api/price?type=stock&symbol=NVDA       -> Finnhub quote (needs FINNHUB_KEY env)
  Returns { symbol, price, source } or { error } (soft errors return 200 so the
  client shows a toast instead of blowing up).
*/
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  try {
    var url = new URL(req.url, 'http://x');
    var type = (url.searchParams.get('type') || '').toLowerCase();
    var symbol = (url.searchParams.get('symbol') || '').trim();
    if (!symbol) return res.status(400).json({ error: 'missing symbol' });

    if (type === 'crypto') {
      var r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=' + encodeURIComponent(symbol.toUpperCase()));
      if (!r.ok) return res.status(200).json({ error: 'symbol not on Binance' });
      var d = await r.json();
      var p = parseFloat(d.price);
      if (!isFinite(p)) return res.status(200).json({ error: 'no price' });
      return res.json({ symbol: symbol.toUpperCase(), price: p, source: 'binance' });
    }

    if (type === 'stock') {
      var key = process.env.FINNHUB_KEY;
      if (!key) return res.status(200).json({ error: 'FINNHUB_KEY not configured' });
      var r2 = await fetch('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(symbol.toUpperCase()) + '&token=' + key);
      if (!r2.ok) return res.status(200).json({ error: 'finnhub http ' + r2.status });
      var d2 = await r2.json();
      var p2 = parseFloat(d2.c);
      if (!isFinite(p2) || p2 === 0) return res.status(200).json({ error: 'no quote for ' + symbol });
      return res.json({ symbol: symbol.toUpperCase(), price: p2, source: 'finnhub' });
    }

    return res.status(400).json({ error: 'unsupported type (use crypto|stock)' });
  } catch (e) {
    return res.status(200).json({ error: String((e && e.message) || e) });
  }
}
