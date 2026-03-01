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
      .then(d => { setData(d); setLoading(false); })
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

// ─── PortfolioChart — portfolio total value over time ──────────────────────────
// Uses daily snapshots stored in portfolio_history.php.
// Props: portfolioId (int), ccy (string), apiBase (string)

const PortfolioChart = ({ portfolioId, ccy, apiBase }) => {
  const HISTORY_API = `${apiBase}/portfolio_history.php`;

  const RANGES = [
    { label: '1W',  days: 7    },
    { label: '1M',  days: 30   },
    { label: '3M',  days: 90   },
    { label: '6M',  days: 182  },
    { label: 'YTD', days: null },   // null = year-to-date
    { label: '1Y',  days: 365  },
    { label: 'ALL', days: -1   },   // -1 = all data
  ];

  const [rangeLabel, setRangeLabel] = React.useState('ALL');
  const [allData,    setAllData]    = React.useState(null);
  const [loading,    setLoading]    = React.useState(true);
  const [error,      setError]      = React.useState(null);
  const [hover,      setHover]      = React.useState(null);
  const svgRef = React.useRef(null);

  // Fetch all snapshot data once; filter client-side per range
  React.useEffect(() => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    setHover(null);
    fetch(`${HISTORY_API}?id=${portfolioId}&ccy=${encodeURIComponent(ccy)}`)
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d)) throw new Error('Bad response');
        setAllData(d);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [portfolioId, ccy]);

  // Filter data by selected range
  const pts = React.useMemo(() => {
    if (!allData || allData.length === 0) return [];
    const sel = RANGES.find(r => r.label === rangeLabel);
    if (!sel || sel.days === -1) return allData; // ALL

    const now = new Date();
    let cutoff;
    if (sel.days === null) {
      // YTD
      cutoff = new Date(now.getFullYear(), 0, 1);
    } else {
      cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - sel.days);
    }
    const cutStr = cutoff.toISOString().slice(0, 10);
    return allData.filter(p => p.date >= cutStr);
  }, [allData, rangeLabel]);

  // ── chart geometry ──────────────────────────────────────────────────────────
  const W = 800, H = 230;
  const PAD = { t: 14, r: 72, b: 30, l: 10 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  // ── helpers ─────────────────────────────────────────────────────────────────
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');  // noon to avoid DST weirdness
    if (rangeLabel === '1W' || rangeLabel === '1M') {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }
    if (rangeLabel === '3M' || rangeLabel === '6M') {
      return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    }
    return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
  };

  const formatValue = (v) => {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
    if (v >= 10_000)    return Math.round(v / 1000) + 'k';
    return v.toFixed(0);
  };

  const formatTooltipValue = (v) => {
    return new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 }).format(v);
  };

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

  const hitIndex = (svgX) => {
    const relX = svgX - PAD.l;
    return Math.max(0, Math.min(pts.length - 1, Math.round((relX / chartW) * (pts.length - 1))));
  };

  // ── build chart ──────────────────────────────────────────────────────────────
  let svgContent = null;
  let periodReturn = null;
  let color = '#16a34a';

  if (pts.length > 1) {
    periodReturn = (pts[pts.length - 1].value - pts[0].value) / pts[0].value * 100;
    color = periodReturn >= 0 ? '#16a34a' : '#dc2626';

    const minV = Math.min(...pts.map(p => p.value));
    const maxV = Math.max(...pts.map(p => p.value));
    // Add a little padding so the line doesn't touch the very top/bottom
    const span = (maxV - minV) || 1;
    const pad  = span * 0.06;
    const lo   = minV - pad;
    const hi   = maxV + pad;
    const rng  = hi - lo;

    const xScale = i  => PAD.l + (i / (pts.length - 1)) * chartW;
    const yScale = v  => PAD.t + chartH - ((v - lo) / rng) * chartH;

    const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.value).toFixed(1)}`).join(' ');
    const areaD = [
      `M${xScale(0).toFixed(1)},${(PAD.t + chartH).toFixed(1)}`,
      ...pts.map((p, i) => `L${xScale(i).toFixed(1)},${yScale(p.value).toFixed(1)}`),
      `L${xScale(pts.length - 1).toFixed(1)},${(PAD.t + chartH).toFixed(1)}Z`,
    ].join(' ');

    // Y grid – 3 levels
    const yLevels = [maxV, (minV + maxV) / 2, minV];

    // X labels – 5 evenly spaced
    const xLabels = [0, 1, 2, 3, 4].map(i => {
      const idx = Math.round(i * (pts.length - 1) / 4);
      return { x: xScale(idx), label: formatDate(pts[idx].date), anchor: i === 0 ? 'start' : i === 4 ? 'end' : 'middle' };
    });

    // Mouse / touch handlers
    const updateHover = (clientX, clientY) => {
      const svgPt = clientToSVG(clientX, clientY);
      if (!svgPt) return;
      const idx = hitIndex(svgPt.x);
      setHover({ x: xScale(idx), y: yScale(pts[idx].value), point: pts[idx] });
    };

    const handleMouseMove = (e) => updateHover(e.clientX, e.clientY);
    const handleTouchMove = (e) => { e.preventDefault(); updateHover(e.touches[0].clientX, e.touches[0].clientY); };

    // Tooltip
    let tooltip = null;
    if (hover) {
      const d = new Date(hover.point.date + 'T12:00:00');
      const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      const tipW = 180, tipH = 54;
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
            {formatTooltipValue(hover.point.value)} {ccy}
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
          <linearGradient id={`pg-${portfolioId}`} x1="0" y1="0" x2="0" y2="1">
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

        {/* area fill + value line */}
        <path d={areaD} fill={`url(#pg-${portfolioId})`} />
        <path d={lineD} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Y axis labels (right side) */}
        {yLevels.map((v, i) => (
          <text key={i}
            x={PAD.l + chartW + 8} y={yScale(v) + 6}
            style={{ fontSize: 'clamp(9px, 1.4vw, 12px)' }} fill="#94a3b8" textAnchor="start">
            {formatValue(v)}
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

  // ── render ──────────────────────────────────────────────────────────────────
  const noData = !loading && !error && pts.length < 2;

  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px 10px', marginBottom: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>

      {/* header: period return + range tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: periodReturn != null ? color : '#64748b', flexShrink: 0 }}>
          {periodReturn != null
            ? `${periodReturn >= 0 ? '+' : ''}${periodReturn.toFixed(2)}%`
            : loading ? 'Loading…' : noData ? 'No history yet' : error ? 'Error' : '—'}
          {periodReturn != null && (
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8', marginLeft: '6px' }}>
              {rangeLabel} return
            </span>
          )}
        </div>

        {/* range tabs */}
        <div style={{
          display: 'flex', gap: '4px',
          overflowX: 'auto', flexShrink: 1, minWidth: 0,
          paddingBottom: '2px',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {RANGES.map(r => (
            <button key={r.label} onClick={() => setRangeLabel(r.label)} style={{
              flexShrink: 0,
              padding: '3px 10px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: r.label === rangeLabel ? 600 : 400,
              background: r.label === rangeLabel ? '#1e293b' : '#f1f5f9',
              color:      r.label === rangeLabel ? 'white'   : '#64748b',
              whiteSpace: 'nowrap',
            }}>{r.label}</button>
          ))}
        </div>
      </div>

      {/* chart area */}
      <div style={{ position: 'relative', minHeight: '40px' }}>
        {loading && (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            Loading history…
          </div>
        )}
        {error && !loading && (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#ef4444', fontSize: '13px' }}>
            Could not load portfolio history
          </div>
        )}
        {noData && (
          <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
            Portfolio history will appear here once prices have been loaded on at least two separate days.
          </div>
        )}
        {!loading && !error && !noData && svgContent}
      </div>
    </div>
  );
};
