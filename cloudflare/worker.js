export default {
  async fetch(request) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: { ...corsHeaders, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' },
      });
    }

    // Returns true if a Unix-seconds timestamp falls on today's date in CET/CEST
    function tradedTodayCET(unixSeconds) {
      const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' });
      const tradeDate = fmt.format(new Date(unixSeconds * 1000));
      const today    = fmt.format(new Date());
      return tradeDate === today;
    }

    // Chart endpoint: ?chart=SYMBOL&range=...
    const chart = url.searchParams.get('chart');
    if (chart) {
      const range = url.searchParams.get('range') || '3mo';
      const intervalMap = {
        '1d':  '1m',
        '5d':  '5m',
        '1mo': '1d',
        '3mo': '1d',
        '6mo': '1d',
        '1y':  '1wk',
        '2y':  '1wk',
        '5y':  '1mo',
        'max': '1mo',
      };
      const interval = intervalMap[range] || '1d';
      const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(chart)}?interval=${interval}&range=${range}`;
      const res  = await fetch(yfUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) {
        return new Response(JSON.stringify({ error: 'No data' }), { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }
      const timestamps = result.timestamp ?? [];
      const closes     = result.indicators?.quote?.[0]?.close ?? [];
      const currency   = result.meta?.currency ?? null;
      const points = timestamps.map((t, i) => ({ t, c: closes[i] ?? null })).filter(p => p.c !== null);
      return new Response(JSON.stringify({ symbol: chart, currency, points }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Quotes endpoint: ?symbols=X,Y,Z
    const symbolsParam = url.searchParams.get('symbols');
    if (!symbolsParam) {
      return new Response(JSON.stringify({ error: 'Missing symbols parameter' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
    const results = await Promise.all(symbols.map(async symbol => {
      try {
        const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res  = await fetch(yfUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return null;
        const price        = meta.regularMarketPrice ?? null;
        const prevClose    = meta.chartPreviousClose ?? meta.previousClose ?? null;
        const lastTradeTs  = meta.regularMarketTime ?? null;
        const tradedToday  = lastTradeTs ? tradedTodayCET(lastTradeTs) : false;
        const changePercent = (tradedToday && prevClose && price != null)
          ? ((price - prevClose) / prevClose) * 100
          : 0;
        return { symbol, regularMarketPrice: price, regularMarketChangePercent: changePercent };
      } catch {
        return null;
      }
    }));
    const body = JSON.stringify({ quoteResponse: { result: results.filter(Boolean), error: null } });
    return new Response(body, { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  },
};
