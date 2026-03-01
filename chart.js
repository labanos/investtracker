// chart.js — StockChart component (loaded via <script type="text/babel" src="chart.js">)

const StockChart = ({ yhTicker, ccy }) => {
  const WORKER = 'https://yf-proxy.labanos.workers.dev';
  const RANGES = [
    { label: '1D',  value: '1d'  },
    { label: '5D',  value: '5d'  },
    { label: '1M',  value: '1mo' },
    { label: '3M',  value: '3mo' },
    { label: '6M',  value: '6mo' },
    { label: 'YTD', value: 'ytd' },
    { label: '1Y',  value: '1y'  },
    { label: '2Y',  value: '2y'  },
    { label: '5Y',  value: '5y'  },
    { label: '10Y', value: '10y' },
    { label: 'MAX', value: 'max' },
  ];

  const [range, setRange]   = React.useState('3mo');
  const [data,  setData]    = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error,  setError]  = React.useState(null);
  const [hover,  setHover]  = React.useState(null);
  const svgRef = React.useRef(null);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    setHover(null);
    fetch(`${WORKER}/?chart=${encodeURIComponent(yhTicker)}&range=${range}`)
      .then(r => r.json())
      .then(d => {
        // Yahoo Finance returns timestamps in Unix SECONDS; normalise to ms for Date()
        const toMs = t => t < 1e12 ? t * 1000 : t;
        if (d.points) d = { ...d, points: d.points.map(p => ({ ...p, t: toMs(p.t) })) };
        setData(d);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [yhTicker, range]);

  // ── chart geometry (SVG user units) ────────────────────────────────────────
  const W = 800, H = 230;
  const PAD = { t: 14, r: 62, b: 30, l: 10 };
  const chartW = W - PAD.l - PAD.r;   // 728
  const chartH = H - PAD.t - PAD.b;   // 186

  // ── helpers ─────────────────────────────────────────────────────────────────
  const formatXLabel = (ts) => {
    const d = new Date(ts);
    const tz = 'Europe/Copenhagen';
    if (range === '1d')  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    if (range === '5d')  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: tz });
    if (['1mo','3mo'].includes(range))        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: tz });
    if (['6mo','ytd','1y'].includes(range))   return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: tz });
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: tz });
  };

  const formatPrice = (v) => {
    if (v >= 10000) return v.toFixed(0);
    if (v >= 1000)  return v.toFixed(0);
    if (v >= 100)   return v.toFixed(1);
    return v.toFixed(2);
  };

  // ── convert client coords → SVG user coords via transform matrix ────────────
  const clientToSVG = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    try {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    } catch { return null; }
  };

  const hitIndex = (svgX, pts) => {
    const relX = svgX - PAD.l;
    return Math.max(0, Math.min(pts.length - 1, Math.round((relX / chartW) * (pts.length - 1))));
  };

  // ── build chart ──────────────────────────────────────────────────────────────
  let svgContent = null;
  let periodReturn = null;
  let color = '#16a34a';

  if (data && data.points && data.points.length > 1) {
    const pts   = data.points;
    periodReturn = (pts[pts.length - 1].c - pts[0].c) / pts[0].c * 100;
    color = periodReturn >= 0 ? '#16a34a' : '#dc2626';

    const minC = Math.min(...pts.map(p => p.c));
    const maxC = Math.max(...pts.map(p => p.c));
    const span = maxC - minC || 1;

    const xScale = i => PAD.l + (i / (pts.length - 1)) * chartW;
    const yScale = v => PAD.t + chartH - ((v - minC) / span) * chartH;

    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.c).toFixed(1)}`).join(' ');
    const areaD = [
      `M${xScale(0).toFixed(1)},${(PAD.t + chartH).toFixed(1)}`,
      ...pts.map((p, i) => `L${xScale(i).toFixed(1)},${yScale(p.c).toFixed(1)}`),
      `L${xScale(pts.length - 1).toFixed(1)},${(PAD.t + chartH).toFixed(1)}Z`,
    ].join(' ');

    // Y grid – 3 levels
    const yLevels = [maxC, (minC + maxC) / 2, minC];

    // X labels – 5 evenly spaced, anchored so they don't clip the edges
    const xLabels = [0, 1, 2, 3, 4].map(i => {
      const idx = Math.round(i * (pts.length - 1) / 4);
      return { x: xScale(idx), label: formatXLabel(pts[idx].t), anchor: i === 0 ? 'start' : i === 4 ? 'end' : 'middle' };
    });

    // Mouse / touch handlers — use SVG coordinate transform for perfect alignment
    const updateHover = (clientX, clientY) => {
      const svgPt = clientToSVG(clientX, clientY);
      if (!svgPt) return;
      const idx = hitIndex(svgPt.x, pts);
      setHover({ x: xScale(idx), y: yScale(pts[idx].c), point: pts[idx] });
    };

    const handleMouseMove  = (e) => updateHover(e.clientX, e.clientY);
    const handleTouchMove  = (e) => { e.preventDefault(); updateHover(e.touches[0].clientX, e.touches[0].clientY); };

    // Tooltip
    let tooltip = null;
    if (hover) {
      const d = new Date(hover.point.t);
      const tz = 'Europe/Copenhagen';
      const isIntra = ['1d', '5d'].includes(range);
      const dateStr = isIntra
        ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz })
          + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz })
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });

      const tipW = 170, tipH = 54;
      const tipX = Math.min(hover.x + 12, PAD.l + chartW - tipW - 4);
      const tipY = Math.max(hover.y - tipH - 10, PAD.t);

      tooltip = (
        <g>
          <line x1={hover.x} y1={PAD.t} x2={hover.x} y2={PAD.t + chartH}
            stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4,3" />
          <circle cx={hover.x} cy={hover.y} r="5" fill={color} stroke="white" strokeWidth="2.5" />
          <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="5"
            fill="white" stroke="#e2e8f0" strokeWidth="1"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.10))' }} />
          <text x={tipX + 10} y={tipY + 18} style={{ fontSize: 'clamp(10px, 1.3vw, 12px)' }} fill="#64748b">{dateStr}</text>
          <text x={tipX + 10} y={tipY + 40} style={{ fontSize: 'clamp(12px, 1.6vw, 15px)' }} fontWeight="600" fill="#0f172a">
            {ccy} {hover.point.c.toFixed(2)}
          </text>
        </g>
      );
    }

    svgContent = (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`sg-${yhTicker}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.20" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Y grid lines */}
        {yLevels.map((v, i) => (
          <line key={i}
            x1={PAD.l} y1={yScale(v)} x2={PAD.l + chartW} y2={yScale(v)}
            stroke="#f1f5f9" strokeWidth="1" />
        ))}

        {/* area fill + price line */}
        <path d={areaD} fill={`url(#sg-${yhTicker})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Y axis labels (right side) */}
        {yLevels.map((v, i) => (
          <text key={i}
            x={PAD.l + chartW + 8} y={yScale(v) + 6}
            style={{ fontSize: 'clamp(9px, 1.4vw, 12px)' }} fill="#94a3b8" textAnchor="start">
            {formatPrice(v)}
          </text>
        ))}

        {/* X axis labels (bottom) */}
        {xLabels.map((xl, i) => (
          <text key={i}
            x={xl.x} y={PAD.t + chartH + 22}
            style={{ fontSize: 'clamp(9px, 1.3vw, 12px)' }} fill="#94a3b8" textAnchor={xl.anchor}>
            {xl.label}
          </text>
        ))}

        {tooltip}
      </svg>
    );
  }

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px 10px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

      {/* header: period return + scrollable range tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: periodReturn != null ? color : '#64748b', flexShrink: 0 }}>
          {periodReturn != null
            ? `${periodReturn >= 0 ? '+' : ''}${periodReturn.toFixed(2)}%`
            : loading ? 'Loading…' : error ? 'Error' : '—'}
          {periodReturn != null && (
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8', marginLeft: '6px' }}>
              {RANGES.find(r => r.value === range)?.label} return
            </span>
          )}
        </div>

        {/* tabs — overflow scrolls horizontally, scrollbar hidden on touch devices */}
        <div style={{
          display: 'flex', gap: '4px',
          overflowX: 'auto', flexShrink: 1, minWidth: 0,
          paddingBottom: '2px',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)} style={{
              flexShrink: 0,
              padding: '3px 10px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: r.value === range ? 600 : 400,
              background: r.value === range ? '#1e293b' : '#f1f5f9',
              color:      r.value === range ? 'white'   : '#64748b',
              whiteSpace: 'nowrap',
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* chart area — height flows from SVG aspect ratio */}
      <div style={{ position: 'relative', minHeight: '40px' }}>
        {loading && (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            Loading chart…
          </div>
        )}
        {error && !loading && (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#ef4444', fontSize: '13px' }}>
            Could not load chart data
          </div>
        )}
        {!loading && !error && svgContent}
      </div>
    </div>
  );
};

// ─── PortfolioChart — computed from price history × share counts ─────────────
// Props: positions (enriched holdings), allTxns ({ticker: [txn]}), baseCcy

const PortfolioChart = ({ positions, allTxns, baseCcy }) => {
  const WORKER = 'https://yf-proxy.labanos.workers.dev';

  const RANGES = [
    { label: '1D',  value: '1d'  },
    { label: '5D',  value: '5d'  },
    { label: '1M',  value: '1mo' },
    { label: '3M',  value: '3mo' },
    { label: '6M',  value: '6mo' },
    { label: 'YTD', value: 'ytd' },
    { label: '1Y',  value: '1y'  },
    { label: '2Y',  value: '2y'  },
    { label: '5Y',  value: '5y'  },
    { label: 'MAX', value: 'max' },
  ];

  const [range,   setRange]   = React.useState('1y');
  const [pts,     setPts]     = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error,   setError]   = React.useState(null);
  const [hover,   setHover]   = React.useState(null);
  const cacheRef = React.useRef({});   // keyed by `${range}_${baseCcy}`
  const svgRef   = React.useRef(null);

  // ── Share count for a ticker on a given date ─────────────────────────────────
  const sharesOnDate = (txns, dateStr) =>
    (txns || []).reduce((sum, t) => {
      if (t.date <= dateStr) sum += t.type === 'buy' ? Number(t.shares) : -Number(t.shares);
      return sum;
    }, 0);

  // ── Binary-search nearest price point ────────────────────────────────────────
  // Tolerance: 1 day for intraday (so a stock's last traded price is used across
  // the rest of the day, but no stale data from previous days bleeds in);
  // 4 days for daily/weekly/monthly (handles non-trading days / calendar gaps).
  const PRICE_WIN = ['1d', '5d'].includes(range) ? 86400000 : 86400000 * 4;

  const priceAt = (pricePts, ts) => {
    if (!pricePts || pricePts.length === 0) return null;
    let lo = 0, hi = pricePts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pricePts[mid].t < ts) lo = mid + 1; else hi = mid;
    }
    const candidates = lo > 0 ? [pricePts[lo - 1], pricePts[lo]] : [pricePts[lo]];
    const best = candidates.reduce((a, b) =>
      Math.abs(a.t - ts) < Math.abs(b.t - ts) ? a : b);
    return Math.abs(best.t - ts) < PRICE_WIN ? best.c : null;
  };

  // ── Fetch + compute portfolio value series ────────────────────────────────────
  React.useEffect(() => {
    if (!positions || positions.length === 0) return;
    const cacheKey = `${range}_${baseCcy}`;
    if (cacheRef.current[cacheKey]) { setPts(cacheRef.current[cacheKey]); return; }

    // Only positions that have transactions (shares history is knowable)
    const relevant = positions.filter(p => (allTxns[p.ticker] || []).length > 0);
    if (relevant.length === 0) { setPts([]); return; }

    setLoading(true);
    setError(null);
    setPts(null);
    setHover(null);

    const yhTickers = [...new Set(relevant.map(p => p.yhTicker))];

    // FX symbols needed: convert each stock's ccy to baseCcy via DKK as pivot
    const ccys = [...new Set(relevant.map(p => p.ccy))];
    const fxSymbols = [];
    ccys.forEach(c => { if (c !== 'DKK') fxSymbols.push(`${c}DKK=X`); });
    if (baseCcy !== 'DKK') fxSymbols.push(`${baseCcy}DKK=X`);
    const uniqFx = [...new Set(fxSymbols)];

    // Yahoo Finance returns timestamps in Unix SECONDS; normalise to ms for Date()
    const toMs = t => t < 1e12 ? t * 1000 : t;

    const fetchChart = sym =>
      fetch(`${WORKER}/?chart=${encodeURIComponent(sym)}&range=${range}`)
        .then(r => r.json())
        .then(d => {
          const raw = d.points || [];
          const pts = raw.map(p => ({ t: toMs(p.t), c: p.c }));
          return { sym, points: pts };
        })
        .catch(() => ({ sym, points: [] }));

    Promise.all([...yhTickers, ...uniqFx].map(fetchChart)).then(results => {
      const priceMap = {};
      results.forEach(r => { priceMap[r.sym] = r.points; });

      // Grid strategy:
      // • Intraday (1d/5d): union of all tickers so the chart spans EU open
      //   (09:00 CET) through US close (~22:00 CET) instead of being clipped
      //   to whichever single market has more data points.
      // • Weekly/monthly ranges: single ticker with most points. The union
      //   approach breaks here because FX and stock timestamps can be days
      //   apart, causing FX lookups to miss and USD positions to drop to zero,
      //   and duplicate grid points appear for the same week/month.
      let gridPoints;
      if (['1d', '5d'].includes(range)) {
        const tsSet = new Set();
        yhTickers.forEach(sym => (priceMap[sym] || []).forEach(p => tsSet.add(p.t)));
        gridPoints = [...tsSet].sort((a, b) => a - b).map(t => ({ t }));
      } else {
        gridPoints = ([...yhTickers]
          .map(s => priceMap[s] || [])
          .sort((a, b) => b.length - a.length)[0] || []);
      }

      if (gridPoints.length < 2) { setLoading(false); setPts([]); return; }

      const computed = gridPoints.map(gridPt => {
        const dateStr = new Date(gridPt.t).toISOString().slice(0, 10);
        let total = 0;

        relevant.forEach(pos => {
          const shares = sharesOnDate(allTxns[pos.ticker], dateStr);
          if (shares <= 0) return;

          const price = priceAt(priceMap[pos.yhTicker], gridPt.t);
          if (!price) return;

          // Convert to DKK, then to baseCcy
          let valueDKK;
          if (pos.ccy === 'DKK') {
            valueDKK = shares * price;
          } else {
            const fxRate = priceAt(priceMap[`${pos.ccy}DKK=X`], gridPt.t);
            if (!fxRate) return;
            valueDKK = shares * price * fxRate;
          }

          if (baseCcy === 'DKK') {
            total += valueDKK;
          } else {
            const baseFxRate = priceAt(priceMap[`${baseCcy}DKK=X`], gridPt.t);
            if (!baseFxRate) return;
            total += valueDKK / baseFxRate;
          }
        });

        return { t: gridPt.t, value: total };
      }).filter(p => p.value > 0);

      cacheRef.current[cacheKey] = computed;
      setPts(computed);
      setLoading(false);
    }).catch(e => { setError(e.message); setLoading(false); });
  }, [range, positions, allTxns, baseCcy]);

  // ── Chart geometry ────────────────────────────────────────────────────────────
  const W = 800, H = 230;
  const PAD = { t: 14, r: 72, b: 30, l: 10 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const formatXLabel = (ts) => {
    const d   = new Date(ts);
    const tz  = 'Europe/Copenhagen';
    if (range === '1d')  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz });
    if (range === '5d')  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', timeZone: tz });
    if (['1mo','3mo'].includes(range)) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: tz });
    if (['6mo','ytd','1y'].includes(range)) return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: tz });
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: tz });
  };

  const formatValue = v => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
    if (v >= 10_000)    return Math.round(v / 1000) + 'k';
    return v.toFixed(0);
  };

  const formatTooltipValue = v =>
    new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(v);

  const clientToSVG = (clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    try {
      const pt = svg.createSVGPoint();
      pt.x = clientX; pt.y = clientY;
      return pt.matrixTransform(svg.getScreenCTM().inverse());
    } catch { return null; }
  };

  const hitIndex = svgX =>
    Math.max(0, Math.min((pts||[]).length - 1,
      Math.round(((svgX - PAD.l) / chartW) * ((pts||[]).length - 1))));

  // ── Build SVG ─────────────────────────────────────────────────────────────────
  let svgContent  = null;
  let periodReturn = null;
  let periodChange = null;   // absolute value change in baseCcy
  let color       = '#16a34a';

  if (pts && pts.length > 1) {
    periodChange = pts[pts.length - 1].value - pts[0].value;
    periodReturn = periodChange / pts[0].value * 100;
    color = periodReturn >= 0 ? '#16a34a' : '#dc2626';

    const minV  = Math.min(...pts.map(p => p.value));
    const maxV  = Math.max(...pts.map(p => p.value));
    const span  = (maxV - minV) || 1;
    const pad   = span * 0.06;
    const lo    = minV - pad, hi = maxV + pad, rng = hi - lo;

    const xScale = i => PAD.l + (i / (pts.length - 1)) * chartW;
    const yScale = v => PAD.t + chartH - ((v - lo) / rng) * chartH;

    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.value).toFixed(1)}`).join(' ');
    const areaD = [
      `M${xScale(0).toFixed(1)},${(PAD.t + chartH).toFixed(1)}`,
      ...pts.map((p, i) => `L${xScale(i).toFixed(1)},${yScale(p.value).toFixed(1)}`),
      `L${xScale(pts.length - 1).toFixed(1)},${(PAD.t + chartH).toFixed(1)}Z`,
    ].join(' ');

    const yLevels = [maxV, (minV + maxV) / 2, minV];

    const xLabels = [0, 1, 2, 3, 4].map(i => {
      const idx = Math.round(i * (pts.length - 1) / 4);
      return { x: xScale(idx), label: formatXLabel(pts[idx].t), anchor: i === 0 ? 'start' : i === 4 ? 'end' : 'middle' };
    });

    const updateHover = (clientX, clientY) => {
      const svgPt = clientToSVG(clientX, clientY);
      if (!svgPt) return;
      const idx = hitIndex(svgPt.x);
      setHover({ x: xScale(idx), y: yScale(pts[idx].value), point: pts[idx] });
    };

    let tooltip = null;
    if (hover) {
      const d       = new Date(hover.point.t);
      const tz      = 'Europe/Copenhagen';
      const isIntra = ['1d', '5d'].includes(range);
      const dateStr = isIntra
        ? d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz })
          + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: tz })
        : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });
      const tipW = 190, tipH = 54;
      const tipX = Math.min(hover.x + 12, PAD.l + chartW - tipW - 4);
      const tipY = Math.max(hover.y - tipH - 10, PAD.t);

      tooltip = (
        <g>
          <line x1={hover.x} y1={PAD.t} x2={hover.x} y2={PAD.t + chartH}
            stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4,3" />
          <circle cx={hover.x} cy={hover.y} r="5" fill={color} stroke="white" strokeWidth="2.5" />
          <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="5"
            fill="white" stroke="#e2e8f0" strokeWidth="1"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.10))' }} />
          <text x={tipX + 10} y={tipY + 18} style={{ fontSize: 'clamp(10px, 1.3vw, 12px)' }} fill="#64748b">{dateStr}</text>
          <text x={tipX + 10} y={tipY + 40} style={{ fontSize: 'clamp(12px, 1.6vw, 15px)' }} fontWeight="600" fill="#0f172a">
            {formatTooltipValue(hover.point.value)} {baseCcy}
          </text>
        </g>
      );
    }

    svgContent = (
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ display: 'block', cursor: 'crosshair', touchAction: 'none' }}
        onMouseMove={e => updateHover(e.clientX, e.clientY)}
        onMouseLeave={() => setHover(null)}
        onTouchMove={e => { e.preventDefault(); updateHover(e.touches[0].clientX, e.touches[0].clientY); }}
        onTouchEnd={() => setHover(null)}
      >
        <defs>
          <linearGradient id="pg-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity="0.20" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yLevels.map((v, i) => (
          <line key={i} x1={PAD.l} y1={yScale(v)} x2={PAD.l + chartW} y2={yScale(v)}
            stroke="#f1f5f9" strokeWidth="1" />
        ))}

        <path d={areaD} fill="url(#pg-grad)" />
        <path d={lineD} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {yLevels.map((v, i) => (
          <text key={i} x={PAD.l + chartW + 8} y={yScale(v) + 6}
            style={{ fontSize: 'clamp(9px, 1.4vw, 12px)' }} fill="#94a3b8" textAnchor="start">
            {formatValue(v)}
          </text>
        ))}

        {xLabels.map((xl, i) => (
          <text key={i} x={xl.x} y={PAD.t + chartH + 22}
            style={{ fontSize: 'clamp(9px, 1.3vw, 12px)' }} fill="#94a3b8" textAnchor={xl.anchor}>
            {xl.label}
          </text>
        ))}

        {tooltip}
      </svg>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  const noData  = !loading && !error && pts !== null && pts.length < 2;
  const noTxns  = !loading && !error && pts === null &&
    positions.every(p => (allTxns[p.ticker] || []).length === 0);

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px 10px',
      marginBottom: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

      {/* header — stacked: change info row, then range chips row */}
      <div style={{ marginBottom: '10px' }}>

        {/* row 1: % change + absolute change + label */}
        <div style={{ fontSize: '15px', fontWeight: 600,
          color: periodReturn != null ? color : '#64748b', marginBottom: '8px' }}>
          {periodReturn != null
            ? `${periodReturn >= 0 ? '+' : ''}${periodReturn.toFixed(2)}%`
            : loading ? 'Computing…' : '—'}
          {periodChange != null && (
            <span style={{ fontSize: '13px', fontWeight: 500, color, marginLeft: '8px' }}>
              {periodChange >= 0 ? '+' : '−'}{formatTooltipValue(Math.abs(periodChange))} {baseCcy}
            </span>
          )}
          {periodReturn != null && (
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8', marginLeft: '6px' }}>
              {RANGES.find(r => r.value === range)?.label} change
            </span>
          )}
        </div>

        {/* row 2: range chips */}
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto',
          msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          {RANGES.map(r => (
            <button key={r.value} onClick={() => { setRange(r.value); setHover(null); }} style={{
              flexShrink: 0, padding: '3px 10px', borderRadius: '6px', border: 'none',
              cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap',
              fontWeight: r.value === range ? 600 : 400,
              background: r.value === range ? '#1e293b' : '#f1f5f9',
              color:      r.value === range ? 'white'   : '#64748b',
            }}>{r.label}</button>
          ))}
        </div>

      </div>

      {/* chart area */}
      <div style={{ position: 'relative', minHeight: '40px' }}>
        {loading && (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            Loading price history…
          </div>
        )}
        {error && !loading && (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#ef4444', fontSize: '13px' }}>
            Could not load price data
          </div>
        )}
        {(noData || noTxns) && (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            {noTxns
              ? 'Add transactions to your holdings to see portfolio history.'
              : 'Not enough data for this period.'}
          </div>
        )}
        {!loading && !error && svgContent}
      </div>
    </div>
  );
};
