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

  const [range, setRange] = React.useState('3mo');
  const [data, setData] = React.useState(null);   // { symbol, currency, points }
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [hover, setHover] = React.useState(null); // { x, y, point }

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    setHover(null);
    fetch(`${WORKER}/?chart=${encodeURIComponent(yhTicker)}&range=${range}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [yhTicker, range]);

  // ── chart geometry ──────────────────────────────────────────────────────────
  const W = 800, H = 180, PAD = { t: 12, r: 16, b: 24, l: 16 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  let svgContent = null;
  let periodReturn = null;
  let color = '#16a34a'; // green default

  if (data && data.points && data.points.length > 1) {
    const pts = data.points;
    const first = pts[0].c;
    const last  = pts[pts.length - 1].c;
    periodReturn = ((last - first) / first * 100);
    color = periodReturn >= 0 ? '#16a34a' : '#dc2626';

    const minC = Math.min(...pts.map(p => p.c));
    const maxC = Math.max(...pts.map(p => p.c));
    const rangeC = maxC - minC || 1;

    const xScale = i => PAD.l + (i / (pts.length - 1)) * chartW;
    const yScale = v => PAD.t + chartH - ((v - minC) / rangeC) * chartH;

    // Build SVG path strings
    const linePoints = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(p.c).toFixed(1)}`).join(' ');
    const areaPoints = [
      `M${xScale(0).toFixed(1)},${(PAD.t + chartH).toFixed(1)}`,
      ...pts.map((p, i) => `L${xScale(i).toFixed(1)},${yScale(p.c).toFixed(1)}`),
      `L${xScale(pts.length - 1).toFixed(1)},${(PAD.t + chartH).toFixed(1)}`,
      'Z',
    ].join(' ');

    // Hover crosshair mouse handler
    const handleMouseMove = (e) => {
      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (W / rect.width);
      const relX = mx - PAD.l;
      const idx = Math.max(0, Math.min(pts.length - 1, Math.round((relX / chartW) * (pts.length - 1))));
      setHover({
        x: xScale(idx),
        y: yScale(pts[idx].c),
        point: pts[idx],
        idx,
      });
    };

    // Tooltip
    let tooltip = null;
    if (hover) {
      const d = new Date(hover.point.t);
      const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const priceStr = hover.point.c.toFixed(2);
      const tipW = 130, tipH = 38;
      const tipX = Math.min(hover.x + 8, W - tipW - 4);
      const tipY = Math.max(hover.y - tipH - 6, 4);
      tooltip = (
        <g>
          {/* vertical crosshair line */}
          <line x1={hover.x} y1={PAD.t} x2={hover.x} y2={PAD.t + chartH}
            stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
          {/* dot on line */}
          <circle cx={hover.x} cy={hover.y} r="4" fill={color} stroke="white" strokeWidth="2" />
          {/* tooltip box */}
          <rect x={tipX} y={tipY} width={tipW} height={tipH} rx="4"
            fill="white" stroke="#e2e8f0" strokeWidth="1"
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.12))' }} />
          <text x={tipX + 8} y={tipY + 14} fontSize="11" fill="#64748b">{dateStr}</text>
          <text x={tipX + 8} y={tipY + 28} fontSize="13" fontWeight="600" fill="#0f172a">
            {ccy} {priceStr}
          </text>
        </g>
      );
    }

    svgContent = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`grad-${yhTicker}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* area fill */}
        <path d={areaPoints} fill={`url(#grad-${yhTicker})`} />
        {/* line */}
        <path d={linePoints} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {tooltip}
      </svg>
    );
  }

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: 'white', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
      {/* header row: period return + range tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, color: periodReturn != null ? color : '#64748b' }}>
          {periodReturn != null
            ? `${periodReturn >= 0 ? '+' : ''}${periodReturn.toFixed(2)}%`
            : loading ? 'Loading…' : error ? 'Error' : '—'}
          {periodReturn != null && (
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8', marginLeft: '6px' }}>
              {RANGES.find(r => r.value === range)?.label} return
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              style={{
                padding: '3px 10px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: r.value === range ? 600 : 400,
                background: r.value === range ? '#1e293b' : '#f1f5f9',
                color: r.value === range ? 'white' : '#64748b',
                transition: 'background 0.15s',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* chart area */}
      <div style={{ height: '180px', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>
            Loading chart…
          </div>
        )}
        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '13px' }}>
            Could not load chart data
          </div>
        )}
        {svgContent}
      </div>
    </div>
  );
};
