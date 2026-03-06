// ─── Detail Page ───────────────────────────────────────────────────────────
function DetailPage({ position: p, initialTxns, onBack, onTxnsChanged, onRemoveHolding, user, onRequireLogin, portfolioId, isLive, lastUpdated, baseCcy }) {

  // ── Transactions state ──────────────────────────────────────────────────
  const [txns,         setTxns]        = useState(initialTxns || []);
  const [addingTxn,    setAddingTxn]   = useState(false);
  const [editingTxnId, setEditingTxnId]= useState(null);
  const [txnForm,      setTxnForm]     = useState({ date:'', type:'buy', shares:'', price:'', fees:'0', note:'' });
  const [savingTxn,    setSavingTxn]   = useState(false);
  const [txnError,     setTxnError]    = useState(null);
  const [removing,     setRemoving]    = useState(false);

  const todayStrT = () => new Date().toISOString().split('T')[0];
  const sortTxns  = arr => [...arr].sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);

  const openAddTxn = () => {
    setAddingTxn(true); setEditingTxnId(null);
    setTxnForm({ date: todayStrT(), type:'buy', shares:'', price:'', fees:'0', note:'' });
    setTxnError(null);
  };
  const openEditTxn = (t) => {
    setEditingTxnId(t.id); setAddingTxn(false);
    setTxnForm({ date:t.date, type:t.type, shares:String(t.shares), price:String(t.price), fees:String(t.fees), note:t.note||'' });
    setTxnError(null);
  };
  const cancelTxn = () => { setAddingTxn(false); setEditingTxnId(null); setTxnError(null); };

  const saveTxn = async () => {
    if (!txnForm.shares || !txnForm.price) return;
    setSavingTxn(true); setTxnError(null);
    const payload = {
      ticker:       p.ticker,
      portfolio_id: portfolioId,
      date:         txnForm.date,
      type:         txnForm.type,
      shares:       parseFloat(txnForm.shares),
      price:        parseFloat(txnForm.price),
      fees:         parseFloat(txnForm.fees  || 0),
      note:         txnForm.note.trim(),
    };
    try {
      if (addingTxn) {
        const res = await fetch(TRANSACTIONS_API, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        const next = sortTxns([...txns, created]);
        setTxns(next); onTxnsChanged(p.ticker, next);
      } else {
        const res = await fetch(`${TRANSACTIONS_API}?id=${editingTxnId}&_method=PUT`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error();
        const next = sortTxns(txns.map(t => t.id === editingTxnId ? { ...t, ...payload, id: editingTxnId } : t));
        setTxns(next); onTxnsChanged(p.ticker, next);
      }
      cancelTxn();
    } catch (_) { setTxnError('Could not save — check your connection.'); }
    setSavingTxn(false);
  };

  const deleteTxn = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await fetch(`${TRANSACTIONS_API}?id=${id}&_method=DELETE`, { method: 'POST' });
      const next = txns.filter(t => t.id !== id);
      setTxns(next); onTxnsChanged(p.ticker, next);
    } catch (_) { setTxnError('Could not delete — check your connection.'); }
  };

  // ── Notes state ────────────────────────────────────────────────────────
  const [notes,      setNotes]      = useState([]);
  const [notesReady, setNotesReady] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [noteForm,   setNoteForm]   = useState({ date: '', text: '' });
  const [saving,     setSaving]     = useState(false);
  const [noteError,  setNoteError]  = useState(null);
  const textareaRef = React.useRef(null);

  useEffect(() => {
    setNotesReady(false);
    fetch(`${NOTES_API}?ticker=${encodeURIComponent(p.ticker)}&portfolio_id=${portfolioId}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setNotes(Array.isArray(data) ? data : []); setNotesReady(true); })
      .catch(()  => { setNotes([]); setNotesReady(true); });
  }, [p.ticker]);

  const todayStr = () => new Date().toISOString().split('T')[0];
  const sortNotes = arr => [...arr].sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);

  const openAdd = () => {
    setAddingNote(true); setEditingId(null);
    setNoteForm({ date: todayStr(), text: '' }); setNoteError(null);
    setTimeout(() => textareaRef.current?.focus(), 60);
  };
  const openEdit = (note) => {
    setEditingId(note.id); setAddingNote(false);
    setNoteForm({ date: note.date, text: note.text }); setNoteError(null);
  };
  const cancelNote = () => {
    setAddingNote(false); setEditingId(null);
    setNoteForm({ date: '', text: '' }); setNoteError(null);
  };

  const saveNote = async () => {
    if (!noteForm.text.trim()) return;
    setSaving(true); setNoteError(null);
    try {
      if (addingNote) {
        const res = await fetch(NOTES_API, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ ticker: p.ticker, portfolio_id: portfolioId, date: noteForm.date, text: noteForm.text.trim() }),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setNotes(prev => sortNotes([...prev, created]));
      } else {
        const res = await fetch(`${NOTES_API}?id=${editingId}&_method=PUT`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ date: noteForm.date, text: noteForm.text.trim() }),
        });
        if (!res.ok) throw new Error();
        setNotes(prev => sortNotes(prev.map(n =>
          n.id === editingId ? { ...n, date: noteForm.date, text: noteForm.text.trim() } : n
        )));
      }
      cancelNote();
    } catch (_) {
      setNoteError('Could not save — check your connection and try again.');
    }
    setSaving(false);
  };

  const deleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try {
      await fetch(`${NOTES_API}?id=${id}&_method=DELETE`, { method: 'POST' });
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (_) {
      setNoteError('Could not delete — check your connection.');
    }
  };

  const removeHolding = async () => {
    const txnCount = txns.length;
    const msg = txnCount > 0
      ? `Remove ${p.ticker} from your portfolio?\n\nThis will also permanently delete ${txnCount} transaction${txnCount !== 1 ? 's' : ''} for this holding. This cannot be undone.`
      : `Remove ${p.ticker} from your portfolio? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setRemoving(true);
    try {
      if (txnCount > 0) {
        await fetch(`${TRANSACTIONS_API}?ticker=${encodeURIComponent(p.ticker)}&_method=DELETE`, { method: 'POST' });
      }
      if (p.id) {
        await fetch(`${PORTFOLIO_API}?id=${p.id}&_method=DELETE`, { method: 'POST' });
      }
      onRemoveHolding(p.ticker);
    } catch (_) {
      setRemoving(false);
      alert('Could not remove holding — check your connection.');
    }
  };

  const totalBought = txns.filter(t=>t.type==='buy').reduce((s,t)=>s+(t.shares*t.price+t.fees),0);
  const totalSold   = txns.filter(t=>t.type==='sell').reduce((s,t)=>s+(t.shares*t.price-t.fees),0);

  const fmtDate = (d) => {
    const [y,m,day] = d.split('-');
    return `${day}.${m}.${y}`;
  };

  const typeTag = (type) => type === 'buy'
    ? <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">BUY</span>
    : <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-600">SELL</span>;

  return (
    <div className="min-h-screen bg-gray-50 pb-12">

      {/* ── Header ── */}
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1">
          ← Portfolio
        </button>
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-bold text-lg">{p.ticker}</span>
          <span className="text-gray-400 text-sm truncate">{p.company}</span>
        </div>
        <span className={`text-[11px] px-2 py-0.5 rounded-full ${isLive ? 'bg-emerald-500 text-white' : 'bg-gray-600 text-gray-300'}`}>
          {isLive ? 'live' : 'cached'}
        </span>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {[
          { label: 'Price', value: p.price >= 1000 ? n(p.price,0) : n(p.price,2), sub: p.ccy },
          { label: 'Today', value: pct(p.chgPct), sub: signed(p.todayBase,0)+' '+baseCcy, color: clr(p.chgPct) },
          { label: 'Total G/L', value: pct(p.glPct), sub: signed(p.glBase,0)+' '+baseCcy, color: clr(p.glPct) },
          { label: 'Position', value: p.shares+' shares', sub: 'avg '+n(p.avgCost,2)+' '+p.ccy },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="bg-white rounded-xl px-4 py-3 shadow-sm border border-gray-100">
            <div className="text-[11px] text-gray-400 mb-1">{label}</div>
            <div className={`font-semibold text-[16px] mono ${color||'text-gray-900'}`}>{value}</div>
            <div className={`text-[11px] mono mt-0.5 ${color||'text-gray-400'}`}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      <div className="mx-4 mb-2">
        <StockChart yhTicker={p.yhTicker} ccy={p.ccy} />
      </div>

      {/* ── News ── */}
      <NewsPanel yhTicker={p.yhTicker} />

      {/* ── Valuation model ── */}
      <ValuationPanel
        ticker={p.ticker}
        portfolioId={portfolioId}
        currentPrice={p.price}
        currency={p.ccy}
        user={user}
        onRequireLogin={onRequireLogin}
      />

      {/* ── Transactions ── */}
      <div className="mx-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold text-gray-600 uppercase tracking-wide">Transactions</h2>
          {!addingTxn && user && (
            <button onClick={openAddTxn}
              className="text-[12px] text-blue-500 hover:text-blue-600 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
              + Add
            </button>
          )}
        </div>

        {/* Add form */}
        {addingTxn && (
          <TransactionForm form={txnForm} onChange={setTxnForm} onSave={saveTxn}
            onCancel={cancelTxn} saving={savingTxn} error={txnError} />
        )}

        {txns.length === 0 && !addingTxn ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-6 text-center text-gray-400 text-sm">
            No transactions yet{user ? (
              <> — <button onClick={openAddTxn} className="text-blue-400 font-medium hover:underline">add one</button></>
            ) : '.'}
          </div>
        ) : txns.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {txnError && !addingTxn && !editingTxnId && (
              <div className="px-4 py-2 text-[11px] text-red-500 bg-red-50">{txnError}</div>
            )}
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-[11px] uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-right">Shares</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Fees</th>
                  <th className="px-3 py-2 text-right">Value</th>
                  <th className="px-3 py-2 text-left">Note</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t, i) =>
                  editingTxnId === t.id ? (
                    <tr key={t.id}>
                      <td colSpan={8} className="p-2">
                        <TransactionForm form={txnForm} onChange={setTxnForm} onSave={saveTxn}
                          onCancel={cancelTxn} saving={savingTxn} error={txnError} />
                      </td>
                    </tr>
                  ) : (
                    <tr key={t.id} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/40'}`}>
                      <td className="px-3 py-2 mono text-gray-500">{fmtDate(t.date)}</td>
                      <td className="px-3 py-2">{typeTag(t.type)}</td>
                      <td className="px-3 py-2 text-right mono text-gray-700">{n(t.shares,0)}</td>
                      <td className="px-3 py-2 text-right mono text-gray-700">{n(t.price,2)}</td>
                      <td className="px-3 py-2 text-right mono text-gray-400">{t.fees ? n(t.fees,2) : '–'}</td>
                      <td className={`px-3 py-2 text-right mono font-medium ${t.type==='buy'?'text-gray-700':'text-emerald-600'}`}>
                        {t.type==='buy' ? '−'+n(t.shares*t.price+(t.fees||0),0) : '+'+n(t.shares*t.price-(t.fees||0),0)}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[140px] truncate">{t.note||''}</td>
                      <td className="px-2 py-2 whitespace-nowrap">
                        {user && (<><button onClick={() => openEditTxn(t)} title="Edit"
                          className="text-gray-300 hover:text-blue-400 transition-colors text-[13px] px-1">✎</button>
                        <button onClick={() => deleteTxn(t.id)} title="Delete"
                          className="text-gray-300 hover:text-red-400 transition-colors text-[13px] px-1">✕</button></>)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
              {txns.length > 1 && (
                <tfoot className="border-t border-gray-200 bg-gray-50 text-[11px] text-gray-500">
                  <tr>
                    <td colSpan={5} className="px-3 py-2">Total invested / received</td>
                    <td className="px-3 py-2 text-right mono font-semibold text-gray-700">
                      {totalBought > 0 && <span className="text-gray-700">−{n(totalBought,0)}</span>}
                      {totalSold > 0 && <span className="text-emerald-600 ml-2">+{n(totalSold,0)}</span>}
                    </td>
                    <td /><td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* ── Notes & Diary ── */}
      <div className="mx-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[13px] font-semibold text-gray-600 uppercase tracking-wide">Notes & Diary</h2>
          {!addingNote && user && (
            <button onClick={openAdd}
              className="text-[12px] text-blue-500 hover:text-blue-600 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
              + Add note
            </button>
          )}
        </div>

        {/* Add form */}
        {addingNote && (
          <NoteForm
            form={noteForm}
            onChange={setNoteForm}
            onSave={saveNote}
            onCancel={cancelNote}
            saving={saving}
            error={noteError}
            textareaRef={textareaRef}
          />
        )}

        {/* Notes list */}
        {!notesReady ? (
          <div className="text-center text-gray-400 text-sm py-6">Loading notes…</div>
        ) : notes.length === 0 && !addingNote ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-6 text-center text-gray-400 text-sm">
            No notes yet{user ? (
              <> — <button onClick={openAdd} className="text-blue-400 font-medium hover:underline">add one</button></>
            ) : '.'}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notes.map((note) =>
              editingId === note.id ? (
                <NoteForm
                  key={note.id}
                  form={noteForm}
                  onChange={setNoteForm}
                  onSave={saveNote}
                  onCancel={cancelNote}
                  saving={saving}
                  error={noteError}
                />
              ) : (
                <div key={note.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[11px] text-gray-400 mono">{fmtDate(note.date)}</div>
                    <div className="flex gap-1 shrink-0 -mt-0.5">
                      {user && (<><button onClick={() => openEdit(note)} title="Edit"
                        className="text-gray-300 hover:text-blue-400 transition-colors text-[14px] px-1 leading-none">✎</button>
                      <button onClick={() => deleteNote(note.id)} title="Delete"
                        className="text-gray-300 hover:text-red-400 transition-colors text-[14px] px-1 leading-none">✕</button></>)}
                    </div>
                  </div>
                  <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap mt-1">{note.text}</p>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Remove holding ── */}
      {user && (
      <div className="px-4 pt-6 pb-2">
        <button
          onClick={removeHolding}
          disabled={removing}
          className="text-[12px] text-red-400 hover:text-red-600 transition-colors disabled:opacity-40"
        >
          {removing ? 'Removing…' : '✕ Remove this holding'}
        </button>
      </div>
      )}

    </div>
  );
}

// ─── Insights: colour palette ─────────────────────────────────────────────
const INSIGHT_PALETTE = [
  '#6366f1','#10b981','#f59e0b','#3b82f6','#ef4444',
  '#8b5cf6','#14b8a6','#f97316','#ec4899','#84cc16',
];

// ─── PieChart — pure SVG donut ─────────────────────────────────────────────
const PIE_LEGEND_MAX = 10;

function PieChart({ data }) {
  const [hovered,   setHovered]   = React.useState(null);
  const [collapsed, setCollapsed] = React.useState(true);

  const size = 200, cx = 100, cy = 100, R = 80, r = 50;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  let angle = -Math.PI / 2;
  const slices = data.map((d) => {
    const sweep = (d.value / total) * Math.PI * 2;
    const s = { ...d, start: angle, end: angle + sweep };
    angle += sweep;
    return s;
  });

  const pt = (a, rad) => ({ x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a) });
  const arc = (s, e, outerR) => {
    const p1 = pt(s, outerR), p2 = pt(e, outerR), p3 = pt(e, r), p4 = pt(s, r);
    const lg = e - s > Math.PI ? 1 : 0;
    return `M${p1.x} ${p1.y} A${outerR} ${outerR} 0 ${lg} 1 ${p2.x} ${p2.y} L${p3.x} ${p3.y} A${r} ${r} 0 ${lg} 0 ${p4.x} ${p4.y}Z`;
  };

  const hSlice = hovered !== null ? slices[hovered] : null;
  const visibleSlices = collapsed ? slices.slice(0, PIE_LEGEND_MAX) : slices;
  const hiddenCount   = slices.length - PIE_LEGEND_MAX;

  return (
    <div className="flex flex-col sm:flex-row items-start gap-6" style={{ maxWidth: 560 }}>
      <svg width={size} height={size} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => (
          <path key={i}
            d={arc(s.start, s.end, hovered === i ? R + 7 : R)}
            fill={s.color}
            opacity={hovered !== null && hovered !== i ? 0.55 : 1}
            style={{ cursor: 'pointer', transition: 'all 0.12s ease' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        {hSlice ? (
          <>
            <text x={cx} y={cy - 7} textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">
              {(hSlice.value / total * 100).toFixed(1)}%
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9.5" fill="#6b7280">
              {hSlice.label.length > 13 ? hSlice.label.slice(0, 13) + '…' : hSlice.label}
            </text>
          </>
        ) : (
          <text x={cx} y={cy + 5} textAnchor="middle" fontSize="11" fill="#d1d5db">
            {data.length} {data.length === 1 ? 'item' : 'items'}
          </text>
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-0.5 min-w-0" style={{ width: 300 }}>
        {visibleSlices.map((s, i) => (
          <div key={i}
            className="flex items-center gap-2 cursor-default py-0.5"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className={`text-[12px] truncate transition-colors ${hovered === i ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
                  style={{ maxWidth: 180 }}>
              {s.label}
            </span>
            <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0 mono">
              {(s.value / total * 100).toFixed(1)}%
            </span>
          </div>
        ))}
        {slices.length > PIE_LEGEND_MAX && (
          <button
            onClick={() => setCollapsed(v => !v)}
            className="mt-1 text-[11px] text-gray-400 hover:text-gray-600 text-left transition-colors"
          >
            {collapsed
              ? `▸ Show ${hiddenCount} more`
              : `▴ Show less`}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── InsightsPanel ─────────────────────────────────────────────────────────
function InsightsPanel({ positions, baseCcy, metaLoading }) {
  const [view, setView] = React.useState('ticker');

  const active = positions.filter(p => p.shares > 0 && p.valueBase > 0);

  const groupBy = (field) => {
    const acc = {};
    active.forEach(p => {
      const key = (p[field] && p[field] !== 'Unknown' ? p[field] : 'Unknown');
      acc[key] = (acc[key] || 0) + p.valueBase;
    });
    return Object.entries(acc)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({
        label,
        value,
        color: i < INSIGHT_PALETTE.length ? INSIGHT_PALETTE[i] : '#9ca3af',
      }));
  };

  const tickerData = active
    .slice()
    .sort((a, b) => b.valueBase - a.valueBase)
    .map((p, i) => ({
      label: p.ticker,
      value: p.valueBase,
      color: i < INSIGHT_PALETTE.length ? INSIGHT_PALETTE[i] : '#9ca3af',
    }));

  const views = [
    { key: 'ticker',   label: 'Ticker'   },
    { key: 'currency', label: 'Currency' },
    { key: 'sector',   label: 'Sector'   },
    { key: 'country',  label: 'Country'  },
  ];

  const needsMeta = view === 'sector' || view === 'country';
  const data = view === 'ticker'   ? tickerData
             : view === 'currency' ? groupBy('ccy')
             : view === 'sector'   ? groupBy('sector')
             :                       groupBy('country');

  return (
    <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-5">
      {/* View toggle */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-[10px] text-gray-400 uppercase tracking-widest mr-1">Composition</span>
        {views.map(v => (
          <button key={v.key}
            onClick={() => setView(v.key)}
            className={`text-[12px] px-3 py-1 rounded-full border transition-colors ${
              view === v.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
            }`}>
            {v.label}
          </button>
        ))}
        {needsMeta && metaLoading > 0 && (
          <span className="text-[11px] text-gray-400 ml-1 flex items-center gap-1">
            <span className="inline-block spin">↻</span>
            fetching metadata ({metaLoading} left)…
          </span>
        )}
      </div>

      {data.length === 0 ? (
        <div className="text-[12px] text-gray-400 text-center py-6">
          {needsMeta && metaLoading > 0 ? 'Loading…' : 'No data'}
        </div>
      ) : (
        <PieChart data={data} />
      )}
    </div>
  );
}
