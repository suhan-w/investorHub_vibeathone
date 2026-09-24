"""Adapter: teammate 1's data layer -> the briefing contract in sample_data.py.

Uses their prices, volume and headlines, but skips their per-ticker Claude
summaries: podcast.write_briefing() writes one script for the whole session.
"""

import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "scrapper"))

from data_layer import get_all_ticker_data  # noqa: E402
from watchlist_store import load_watchlist  # noqa: E402

SESSIONS = {"new_york": ("NYSE", "NASDAQ"), "london": ("LSE",)}


def briefing_date() -> str:
    """The Oceania morning this brief is for.

    Before the 10am ASX open that is today; after it, the next trading day.
    """
    now = datetime.now(ZoneInfo("Australia/Sydney"))
    d = now.date() + timedelta(days=1 if now.hour >= 10 else 0)
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d.isoformat()


def get_market_data(for_date: str | None = None) -> dict:
    names = {w["ticker"]: w.get("name", w["ticker"]) for w in load_watchlist()}
    records = get_all_ticker_data(force_refresh=True, skip_summary=True)

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
            "stocks": stocks,
            "movers": [
                {"ticker": s["ticker"], "name": s["name"], "pct_change": s["pct_change"]}
                for s in movers[:4]
            ],
        }

    return {"date": for_date or briefing_date(), "sessions": sessions}


if __name__ == "__main__":
    import json

    print(json.dumps(get_market_data(), indent=2))
