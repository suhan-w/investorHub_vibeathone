import { useEffect, useRef, useState } from "react";
import "./App.css";

interface Mover {
  ticker: string;
  name: string;
  pct_change: number;
}

interface MarketSession {
  headline: string;
  bullets: string[];
  movers: Mover[];
}

interface OceaniaEvent {
  time: string;
  title: string;
  detail: string;
}

interface Briefing {
  date: string;
  sessions: {
    new_york: MarketSession;
    london: MarketSession;
    oceania: { headline: string; events: OceaniaEvent[] };
  };
  script: string;
  audio_url: string | null;
  generated_at: string;
}

function formatDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatPct(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function Player({ briefing }: { briefing: Briefing }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Lock screen and notification controls while the briefing plays
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `Market briefing, ${formatDate(briefing.date)}`,
      artist: "Before the Bell",
      artwork: [{ src: "/favicon.svg", sizes: "any", type: "image/svg+xml" }],
    });
    navigator.mediaSession.setActionHandler("play", () => audioRef.current?.play());
    navigator.mediaSession.setActionHandler("pause", () => audioRef.current?.pause());
  }, [briefing.date]);

  if (!briefing.audio_url) {
    return (
      <div className="player player-empty">
        Audio for today's briefing is still being generated.
      </div>
    );
  }

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play();
    else audio.pause();
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (audioRef.current) audioRef.current.currentTime = Number(e.target.value);
  };

  return (
    <div className="player">
      <audio
        ref={audioRef}
        src={briefing.audio_url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <button
        className="play-button"
        onClick={toggle}
        aria-label={playing ? "Pause briefing" : "Play briefing"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
          </svg>
        )}
      </button>
      <div className="player-body">
        <div className="player-label">
          {playing ? "Playing briefing" : "Listen to the briefing"}
        </div>
        <input
          className="scrubber"
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={seek}
          aria-label="Seek"
        />
        <div className="player-times">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <a className="download" href={briefing.audio_url} download={`briefing-${briefing.date}.mp3`}>
        Download
      </a>
    </div>
  );
}

function SessionCard({ title, closed, session }: { title: string; closed: string; session: MarketSession }) {
  return (
    <section className="card">
      <header className="card-header">
        <h2>{title}</h2>
        <span className="card-meta">{closed}</span>
      </header>
      <p className="card-headline">{session.headline}</p>
      <ul className="bullets">
        {session.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <div className="movers">
        {session.movers.map((m) => (
          <div className="mover" key={m.ticker}>
            <span className="mover-name">{m.name}</span>
            <span className={`mover-pct ${m.pct_change >= 0 ? "up" : "down"}`}>
              {formatPct(m.pct_change)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function App() {
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showScript, setShowScript] = useState(false);

  useEffect(() => {
    fetch(`/briefing.json?t=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setBriefing)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="page">
        <p className="state">Today's briefing isn't available yet. Pull down to refresh.</p>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="page">
        <p className="state">Loading today's briefing…</p>
      </div>
    );
  }

  const { new_york, london, oceania } = briefing.sessions;

  return (
    <div className="page">
      <header className="masthead">
        <div className="brand">Before the Bell</div>
        <h1>{formatDate(briefing.date)}</h1>
        <p className="subtitle">Overnight markets in three minutes, ready for the ASX open.</p>
      </header>

      <Player briefing={briefing} />

      <section className="card card-oceania">
        <header className="card-header">
          <h2>Oceania ahead</h2>
          <span className="card-meta">ASX opens 10:00 AEST</span>
        </header>
        <p className="card-headline">{oceania.headline}</p>
        <ol className="events">
          {oceania.events.map((e) => (
            <li key={e.title}>
              <span className="event-time">{e.time}</span>
              <div>
                <div className="event-title">{e.title}</div>
                <div className="event-detail">{e.detail}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <SessionCard title="New York" closed="Closed 06:00 AEST" session={new_york} />
      <SessionCard title="London" closed="Closed 01:30 AEST" session={london} />

      <button className="script-toggle" onClick={() => setShowScript((s) => !s)}>
        {showScript ? "Hide transcript" : "Read the transcript"}
      </button>
      {showScript && <div className="script">{briefing.script}</div>}

      <footer className="disclaimer">
        AI-generated summary of public market information. General information only, not
        financial advice. Generated{" "}
        {new Date(briefing.generated_at).toLocaleTimeString("en-AU", {
          hour: "numeric",
          minute: "2-digit",
        })}
        .
      </footer>
    </div>
  );
}

export default App;
