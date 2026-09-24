import { FormEvent, useEffect, useRef, useState } from "react";
import "./App.css";

interface Move {
  ticker: string;
  name: string;
  exchange: string;
  close?: number;
  prev_close?: number;
  change?: number;
  pct_change?: number;
  volume?: number;
  avg_volume?: number;
  unusual_volume?: boolean;
  as_of?: string;
  headline?: string | null;
  error?: string;
}

const API_BASE = "http://localhost:8000/api";

function formatPrice(exchange: string, value: number) {
  const prefix = exchange === "LSE" ? "£" : "$";
  return `${prefix}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// ---------- Desktop layout (Bloomberg-style flat table) ----------

function WatchlistRow({ move, onRemove, removing }: { move: Move; onRemove: (ticker: string) => void; removing: boolean }) {
  return (
    <div className="table-row">
      <span className="cell-ticker">
        <span className="ticker">{move.ticker}</span>
        <span className="name">{move.name}</span>
      </span>

      {move.error ? (
        <span className="cell-error" style={{ gridColumn: "2 / span 2" }}>
          No data available
        </span>
      ) : (
        <>
          <span className="cell-num">{formatPrice(move.exchange, move.close!)}</span>
          <span className={`cell-num delta ${move.change! >= 0 ? "up" : "down"}`}>
            {formatPct(move.pct_change!)}
            {move.unusual_volume && <span className="badge">unusual vol</span>}
          </span>
        </>
      )}

      <span className="cell-headline" title={move.headline ?? undefined}>
        {move.headline ?? "—"}
      </span>

      <button
        className="remove-btn"
        onClick={() => onRemove(move.ticker)}
        disabled={removing}
        aria-label={`Remove ${move.ticker}`}
        title={`Remove ${move.ticker}`}
      >
        ×
      </button>
    </div>
  );
}

function ExchangeSection({
  title,
  moves,
  onRemove,
  removingTicker,
}: {
  title: string;
  moves: Move[];
  onRemove: (ticker: string) => void;
  removingTicker: string | null;
}) {
  if (moves.length === 0) return null;

  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      <div className="table">
        <div className="table-header">
          <span>Ticker</span>
          <span>Close</span>
          <span>Change</span>
          <span>Headline</span>
          <span aria-hidden="true" />
        </div>
        {moves.map((m) => (
          <WatchlistRow key={m.ticker} move={m} onRemove={onRemove} removing={removingTicker === m.ticker} />
        ))}
      </div>
    </section>
  );
}

// ---------- Mobile layout (Stocks-widget rows + Podcasts-style mini player) ----------

function MobileRow({
  move,
  expanded,
  onToggle,
  onRemove,
  removing,
}: {
  move: Move;
  expanded: boolean;
  onToggle: () => void;
  onRemove: (ticker: string) => void;
  removing: boolean;
}) {
  return (
    <div className="mobile-row">
      <div className="mobile-row-header" role="button" tabIndex={0} onClick={onToggle} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onToggle()}>
        <span className="cell-ticker">
          <span className="ticker">{move.ticker}</span>
          <span className="name">{move.name}</span>
        </span>

        {move.error ? (
          <span className="cell-error">No data</span>
        ) : (
          <span className="cell-price-stack">
            <span className="cell-num">{formatPrice(move.exchange, move.close!)}</span>
            <span className={`cell-num delta ${move.change! >= 0 ? "up" : "down"}`}>
              {formatPct(move.pct_change!)}
              {move.unusual_volume && <span className="vol-dot" title="Unusual volume" aria-label="Unusual volume" />}
            </span>
          </span>
        )}
      </div>

      {expanded && !move.error && (
        <div className="mobile-row-detail">
          <p className="cell-headline">{move.headline ?? "No recent headline."}</p>
          <button className="remove-link" onClick={() => onRemove(move.ticker)} disabled={removing}>
            {removing ? "Removing…" : "Remove from watchlist"}
          </button>
        </div>
      )}
    </div>
  );
}

function App() {
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTicker, setNewTicker] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removingTicker, setRemovingTicker] = useState<string | null>(null);

  const [briefingStatus, setBriefingStatus] = useState<string | null>(null);
  const [generatingBriefing, setGeneratingBriefing] = useState(false);

  // Mobile-only UI state
  const [mobileTab, setMobileTab] = useState<"NYSE" | "LSE">("NYSE");
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  // Briefing playback is a UI shell until Phase 3 wires up real ElevenLabs audio —
  // play/pause toggles the icon only, no actual scrubbing happens yet.
  const [briefingReady, setBriefingReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const loadWatchlist = () => {
    setLoading(true);
    setError(null);
    return fetch(`${API_BASE}/watchlist`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setMoves)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadWatchlist();
  }, []);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;

    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`${API_BASE}/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? `Couldn't add ${ticker}`);
      setMoves(body);
      setNewTicker("");
      setAddSheetOpen(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't add ticker");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (ticker: string) => {
    setRemovingTicker(ticker);
    try {
      const res = await fetch(`${API_BASE}/watchlist/${ticker}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Couldn't remove ${ticker}`);
      setMoves(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove ticker");
    } finally {
      setRemovingTicker(null);
    }
  };

  const handleGenerateBriefing = async () => {
    setGeneratingBriefing(true);
    setBriefingStatus(null);
    try {
      const res = await fetch(`${API_BASE}/briefing`, { method: "POST" });
      const body = await res.json();
      setBriefingStatus(body.message ?? "Briefing requested.");
      setBriefingReady(true);
    } catch {
      setBriefingStatus("Couldn't reach the backend to generate a briefing.");
    } finally {
      setGeneratingBriefing(false);
    }
  };

  const toggleExpanded = (ticker: string) => {
    setExpandedTickers((prev) => {
      const next = new Set(prev);
      next.has(ticker) ? next.delete(ticker) : next.add(ticker);
      return next;
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 50) {
      setMobileTab((prev) => (prev === "NYSE" ? "LSE" : "NYSE"));
    }
    touchStartX.current = null;
  };

  const nyse = moves?.filter((m) => m.exchange === "NYSE") ?? [];
  const lse = moves?.filter((m) => m.exchange === "LSE") ?? [];
  const other = moves?.filter((m) => m.exchange !== "NYSE" && m.exchange !== "LSE") ?? [];
  const asOf = moves?.find((m) => m.as_of)?.as_of;
  const mobileMoves = mobileTab === "NYSE" ? nyse : lse;

  return (
    <div className="page">
      {error && <p className="error-banner">Couldn't reach the backend: {error}</p>}
      {loading && <p className="loading">Loading watchlist…</p>}

      {!loading && moves && (
        <>
          {/* ---------- Desktop ---------- */}
          <div className="desktop-layout">
            <header className="page-header">
              <div>
                <h1>Overnight Briefing</h1>
                <p className="subtitle">
                  {asOf ? `Latest close as of ${asOf}` : "Your watchlist, summarized before the open"}
                </p>
              </div>
              <button className="primary-btn" onClick={handleGenerateBriefing} disabled={generatingBriefing || loading}>
                {generatingBriefing ? "Generating…" : "Generate briefing"}
              </button>
            </header>

            {briefingStatus && <p className="info-banner">{briefingStatus}</p>}

            <form className="add-form" onSubmit={handleAdd}>
              <input
                type="text"
                placeholder="Add a ticker (e.g. GOOGL, BARC.L)"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                disabled={adding}
              />
              <button type="submit" disabled={adding || !newTicker.trim()}>
                {adding ? "Adding…" : "Add"}
              </button>
            </form>
            {addError && <p className="error-text">{addError}</p>}

            <main>
              <ExchangeSection title="NYSE" moves={nyse} onRemove={handleRemove} removingTicker={removingTicker} />
              <ExchangeSection title="LSE" moves={lse} onRemove={handleRemove} removingTicker={removingTicker} />
              <ExchangeSection title="Other" moves={other} onRemove={handleRemove} removingTicker={removingTicker} />
              {moves.length === 0 && <p className="empty-state">Your watchlist is empty — add a ticker above.</p>}
            </main>
          </div>

          {/* ---------- Mobile ---------- */}
          <div className="mobile-layout">
            <header className="mobile-header">
              <h1>Overnight Briefing</h1>
              <p className="subtitle">{asOf ? `As of ${asOf}` : "Loading…"}</p>
            </header>

            <div className="tabs">
              <button className={`tab ${mobileTab === "NYSE" ? "active" : ""}`} onClick={() => setMobileTab("NYSE")}>
                NYSE
              </button>
              <button className={`tab ${mobileTab === "LSE" ? "active" : ""}`} onClick={() => setMobileTab("LSE")}>
                LSE
              </button>
            </div>

            <div className="mobile-list" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
              {mobileMoves.map((m) => (
                <MobileRow
                  key={m.ticker}
                  move={m}
                  expanded={expandedTickers.has(m.ticker)}
                  onToggle={() => toggleExpanded(m.ticker)}
                  onRemove={handleRemove}
                  removing={removingTicker === m.ticker}
                />
              ))}
              {mobileMoves.length === 0 && <p className="empty-state">No tickers here yet — tap + to add one.</p>}
            </div>

            <button className="fab" onClick={() => setAddSheetOpen(true)} aria-label="Add ticker">
              +
            </button>

            {addSheetOpen && (
              <div className="sheet-backdrop" onClick={() => setAddSheetOpen(false)}>
                <div className="sheet" onClick={(e) => e.stopPropagation()}>
                  <h3>Add ticker</h3>
                  <form onSubmit={handleAdd}>
                    <input
                      type="text"
                      autoFocus
                      placeholder="e.g. GOOGL, BARC.L"
                      value={newTicker}
                      onChange={(e) => setNewTicker(e.target.value)}
                      disabled={adding}
                    />
                    {addError && <p className="error-text">{addError}</p>}
                    <div className="sheet-actions">
                      <button type="button" onClick={() => setAddSheetOpen(false)}>
                        Cancel
                      </button>
                      <button type="submit" disabled={adding || !newTicker.trim()}>
                        {adding ? "Adding…" : "Add"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            <div className="bottom-bar">
              {!briefingReady ? (
                <button className="bottom-cta" onClick={handleGenerateBriefing} disabled={generatingBriefing}>
                  {generatingBriefing ? "Generating…" : "Generate briefing"}
                </button>
              ) : (
                <div className="now-playing">
                  <button className="play-btn" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Pause" : "Play"}>
                    {playing ? "❚❚" : "▶"}
                  </button>
                  <div className="now-playing-info">
                    <span className="now-playing-title">Overnight Briefing</span>
                    <div className="scrubber">
                      <div className="scrubber-fill" />
                    </div>
                  </div>
                  <span className="now-playing-time">0:00</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
