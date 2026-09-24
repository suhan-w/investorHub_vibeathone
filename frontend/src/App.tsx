import { FormEvent, useEffect, useState } from "react";
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
    } catch {
      setBriefingStatus("Couldn't reach the backend to generate a briefing.");
    } finally {
      setGeneratingBriefing(false);
    }
  };

  const nyse = moves?.filter((m) => m.exchange === "NYSE") ?? [];
  const lse = moves?.filter((m) => m.exchange === "LSE") ?? [];
  const other = moves?.filter((m) => m.exchange !== "NYSE" && m.exchange !== "LSE") ?? [];
  const asOf = moves?.find((m) => m.as_of)?.as_of;

  return (
    <div className="page">
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

      {error && <p className="error-banner">Couldn't reach the backend: {error}</p>}
      {loading && <p className="loading">Loading watchlist…</p>}

      {!loading && moves && (
        <main>
          <ExchangeSection title="NYSE" moves={nyse} onRemove={handleRemove} removingTicker={removingTicker} />
          <ExchangeSection title="LSE" moves={lse} onRemove={handleRemove} removingTicker={removingTicker} />
          <ExchangeSection title="Other" moves={other} onRemove={handleRemove} removingTicker={removingTicker} />
          {moves.length === 0 && <p className="empty-state">Your watchlist is empty — add a ticker above.</p>}
        </main>
      )}
    </div>
  );
}

export default App;
