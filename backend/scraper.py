"""Adapter: teammate 1's data layer -> the briefing contract in sample_data.py.

Uses their prices, volume and headlines, but skips their per-ticker Claude
summaries: podcast.write_briefing() writes one script for the whole session.
"""

import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "scrapper"))

import json  # noqa: E402

import yfinance as yf  # noqa: E402

from data_layer import CACHE_FILE, get_all_ticker_data  # noqa: E402
from watchlist_store import load_watchlist  # noqa: E402

SESSIONS = {"new_york": ("NYSE", "NASDAQ"), "london": ("LSE",)}
INDEXES = {
    "new_york": [("^GSPC", "S&P 500"), ("^IXIC", "Nasdaq Composite")],
    "london": [("^FTSE", "FTSE 100")],
}


def last_session(for_date: str) -> str:
    """The overnight NY and London session before an Oceania morning."""
    d = datetime.fromisoformat(for_date).date() - timedelta(days=1)
    while d.weekday() >= 5:
        d -= timedelta(days=1)
    return d.isoformat()


def index_moves(session: str) -> dict:
    """Index % change for one session, from hourly bars.

    Yahoo's daily index bars have gaps, so the last hourly close of each day is used.
    """
    end = datetime.fromisoformat(session).date() + timedelta(days=1)
    start = end - timedelta(days=7)
    out = {key: [] for key in INDEXES}
    for key, indexes in INDEXES.items():
        for symbol, name in indexes:
            try:
                bars = yf.download(symbol, start=start.isoformat(), end=end.isoformat(),
                                   interval="1h", auto_adjust=False, progress=False)
                close = bars["Close"].squeeze().dropna()
                daily = close.groupby(close.index.date).last()
                if str(daily.index[-1]) != session or len(daily) < 2:
                    continue
                pct = (daily.iloc[-1] / daily.iloc[-2] - 1) * 100
                out[key].append({"name": name, "pct_change": round(float(pct), 1)})
            except Exception as exc:
                print(f"[scraper] index {symbol} failed: {exc}", file=sys.stderr)
    return out


def briefing_date() -> str:
    """The Oceania morning this brief is for.

    Before the 10am ASX open that is today; after it, the next trading day.
    """
    now = datetime.now(ZoneInfo("Australia/Sydney"))
    d = now.date() + timedelta(days=1 if now.hour >= 10 else 0)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.isoformat()


def get_market_data(for_date: str | None = None, cached: bool = False) -> dict:
    names = {w["ticker"]: w.get("name", w["ticker"]) for w in load_watchlist()}
    if cached:
        # Reuse the last scrape, e.g. to rewrite the script after London has opened
        records = json.loads(Path(CACHE_FILE).read_text())["data"]
    else:
        records = get_all_ticker_data(force_refresh=True, skip_summary=True)
    for_date = for_date or briefing_date()
    indexes = index_moves(last_session(for_date))

    sessions = {}
    for key, exchanges in SESSIONS.items():
        stocks = []
        for r in records:
            if r.get("exchange") not in exchanges or r.get("change_pct") is None:
                continue
            stocks.append(
                {
                    "ticker": r["ticker"],
                    "name": names.get(r["ticker"], r["ticker"]),
                    "price": r["price"],
                    "price_unit": "pence" if r["exchange"] == "LSE" else "USD",
                    "pct_change": round(r["change_pct"], 2),
                    "volume_note": r["volume_note"],
                    "headlines": [h["title"] for h in r.get("headlines", [])],
                }
            )
        movers = sorted(stocks, key=lambda s: abs(s["pct_change"]), reverse=True)
        sessions[key] = {
            "indexes": indexes[key],
            "stocks": stocks,
            "movers": [
                {"ticker": s["ticker"], "name": s["name"], "pct_change": s["pct_change"]}
                for s in movers[:6]
            ],
        }

    return {"date": for_date, "sessions": sessions}


if __name__ == "__main__":
    import json

    print(json.dumps(get_market_data(), indent=2))
