import { useEffect, useState } from "react";
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
  error?: string;
}

const API_URL = "http://localhost:8000/api/watchlist";

function formatPrice(exchange: string, value: number) {
  const prefix = exchange === "LSE" ? "£" : "$";
  return `${prefix}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function ExchangeSection({ title, moves }: { title: string; moves: Move[] }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      <div className="table">
        <div className="table-header">
          <span>Ticker</span>
          <span>Close</span>
          <span>Change</span>
          <span>Volume</span>
        </div>
        {moves.map((m) => (
          <div className="table-row" key={m.ticker}>
            <span className="cell-ticker">
              <span className="ticker">{m.ticker}</span>
              <span className="name">{m.name}</span>
            </span>

            {m.error ? (
              <span className="cell-error" style={{ gridColumn: "2 / span 3" }}>
                No data available
              </span>
            ) : (
              <>
                <span className="cell-num">{formatPrice(m.exchange, m.close!)}</span>
                <span className={`cell-num delta ${m.change! >= 0 ? "up" : "down"}`}>
                  {formatPct(m.pct_change!)}
                </span>
                <span className="cell-num volume">
                  {m.volume!.toLocaleString()}
                  {m.unusual_volume && <span className="badge">unusual</span>}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [moves, setMoves] = useState<Move[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(API_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setMoves)
      .catch((err) => setError(err.message));
  }, []);

  const nyse = moves?.filter((m) => m.exchange === "NYSE") ?? [];
  const lse = moves?.filter((m) => m.exchange === "LSE") ?? [];
  const asOf = moves?.find((m) => m.as_of)?.as_of;

  return (
    <div className="page">
      <header className="page-header">
        <h1>Overnight Briefing</h1>
        <p className="subtitle">
          {asOf ? `Latest close as of ${asOf}` : "Your watchlist, summarized before the open"}
        </p>
      </header>

      {error && <p className="error-banner">Couldn't reach the backend: {error}</p>}
      {!moves && !error && <p className="loading">Loading watchlist…</p>}

      {moves && (
        <main>
          <ExchangeSection title="NYSE" moves={nyse} />
          <ExchangeSection title="LSE" moves={lse} />
        </main>
      )}
    </div>
  );
}

export default App;
