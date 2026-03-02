// v2
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

    // Search endpoint: ?search=<query>
    const searchQ = url.searchParams.get('search');
    if (searchQ) {
      const yfUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(searchQ)}&quotesCount=8&newsCount=0&listsCount=0`;
      const res  = await fetch(yfUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      });
      const data = await res.json();
      const quotes = (data?.quotes || [])
        .filter(q => q.isYahooFinance && ['EQUITY', 'ETF', 'MUTUALFUND'].includes(q.quoteType))
        .slice(0, 8)
        .map(q => ({
          symbol:   q.symbol,
          name:     q.shortname || q.longname || q.symbol,
          exchange: q.exchDisp  || q.exchange  || '',
          type:     q.typeDisp  || q.quoteType || '',
        }));
      return new Response(JSON.stringify({ quotes }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Chart endpoint: ?chart=SYMBOL&range=...
    const chart = url.searchParams.get('chart');
    if (chart) {
      const range = url.searchParams.get('range') || '3mo';
      const intervalMap = {
        '1d':  '5m',
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
      // Include previous close so the frontend can base 1D change on last close, not open
      const prevClose = result.meta?.chartPreviousClose ?? null;
      return new Response(JSON.stringify({ symbol: chart, currency, points, prevClose }), {
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
        // Use 5d range with 1d interval so we always get recent daily candles;
        // range=1d returns no timestamps for some tickers (e.g. NOVO-B.CO).
        const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
        const res  = await fetch(yfUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        const data = await res.json();
        const result     = data?.chart?.result?.[0];
        const meta       = result?.meta;
        if (!meta) return null;
        const price        = meta.regularMarketPrice ?? null;
        // Find the most recent close that is NOT from today in CET.
        // - If today's candle is present (most tickers): skip it because its close ≈
        //   regularMarketPrice, giving ~0% change. Use the previous day's close instead.
        // - If today's candle is absent (e.g. NOVO-B.CO / NU on Mondays before Yahoo
        //   catches up): the last candle is already the previous trading day — use it.
        // meta.chartPreviousClose is the close before the 5d window and is too old.
        const timestamps   = result?.timestamp ?? [];
        const closes       = result?.indicators?.quote?.[0]?.close ?? [];
        const fmtDate      = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Copenhagen' });
        const today        = fmtDate.format(new Date());
        let prevClose = null;
        for (let i = timestamps.length - 1; i >= 0; i--) {
          if (closes[i] != null && fmtDate.format(new Date(timestamps[i] * 1000)) !== today) {
            prevClose = closes[i];
            break;
          }
        }
        prevClose = prevClose ?? meta.chartPreviousClose ?? meta.previousClose ?? null;
        const changePercent = (prevClose && price != null)
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
