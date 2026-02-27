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
          <text x={tipX + 10} y={tipY + 18} fontSize="17" fill="#64748b">{dateStr}</text>
          <text x={tipX + 10} y={tipY + 40} fontSize="22" fontWeight="600" fill="#0f172a">
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
            fontSize="18" fill="#94a3b8" textAnchor="start">
            {formatPrice(v)}
          </text>
        ))}

        {/* X axis labels (bottom) */}
        {xLabels.map((xl, i) => (
          <text key={i}
            x={xl.x} y={PAD.t + chartH + 22}
            fontSize="17" fill="#94a3b8" textAnchor={xl.anchor}>
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
