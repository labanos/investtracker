# Cloudflare Worker: yf-proxy

Live URL: `https://yf-proxy.labanos.workers.dev/`

Deployed at: Cloudflare Dashboard → Workers & Pages → yf-proxy → Edit Code
Account: labanos@gmail.com

## Endpoints

### `?symbols=X,Y,Z` — Current prices
Returns real-time price and daily % change for one or more tickers.

```
GET https://yf-proxy.labanos.workers.dev/?symbols=AAPL,NVDA,DANSKE.CO
```

Response:
```json
{
  "quoteResponse": {
    "result": [
      { "symbol": "AAPL", "regularMarketPrice": 213.5, "regularMarketChangePercent": 1.23 }
    ],
    "error": null
  }
}
```

Notes:
- Uses Yahoo Finance `/v8/finance/chart` (not v7/quote) to avoid IP blocks
- Shows 0% change for stocks that haven't traded today in CET timezone (Danish stocks on weekends/holidays)

### `?chart=SYMBOL&range=RANGE` — Historical chart data
Returns OHLC close prices for charting.

```
GET https://yf-proxy.labanos.workers.dev/?chart=AAPL&range=1y
```

Supported ranges: `1d`, `5d`, `1mo`, `3mo` (default), `6mo`, `1y`, `2y`, `5y`, `max`

Response:
```json
{ "symbol": "AAPL", "currency": "USD", "points": [{ "t": 1700000000, "c": 189.5 }, ...] }
```

## Why this exists

The one.com shared hosting server IP is blocked by Yahoo Finance for all API calls
(both `file_get_contents` and `curl` return 502/500). This Cloudflare Worker runs
on Cloudflare's IP ranges which Yahoo Finance does not block.

## Notes on metadata (sector/industry/country)

Yahoo Finance now requires browser session cookies + a crumb token for their
`quoteSummary` API. This cannot be reliably obtained from a serverless Worker.
Their HTML pages also load profile data client-side via JavaScript.

Metadata (sector/industry/country) is handled by `php/meta.php` instead,
which uses a static ticker map. Add new tickers to the `$STATIC` array there.
