"""Persists the user's watchlist membership to a local JSON file.

Seeded with a 5 NYSE + 5 LSE demo set; add_ticker/remove_ticker let the
dashboard manage membership without touching the data-fetch layer.
"""

import json
from pathlib import Path

import yfinance as yf

STATE_FILE = Path(__file__).parent / "watchlist_state.json"

DEFAULT_WATCHLIST = [
    {"ticker": "AAPL", "name": "Apple", "exchange": "NYSE"},
    {"ticker": "MSFT", "name": "Microsoft", "exchange": "NYSE"},
    {"ticker": "NVDA", "name": "Nvidia", "exchange": "NYSE"},
    {"ticker": "TSLA", "name": "Tesla", "exchange": "NYSE"},
    {"ticker": "JPM", "name": "JPMorgan Chase", "exchange": "NYSE"},
    {"ticker": "BP.L", "name": "BP", "exchange": "LSE"},
    {"ticker": "HSBA.L", "name": "HSBC", "exchange": "LSE"},
    {"ticker": "AZN.L", "name": "AstraZeneca", "exchange": "LSE"},
    {"ticker": "ULVR.L", "name": "Unilever", "exchange": "LSE"},
    {"ticker": "VOD.L", "name": "Vodafone", "exchange": "LSE"},
]


class TickerNotFoundError(Exception):
    pass


def load_watchlist() -> list[dict]:
    if not STATE_FILE.exists():
        save_watchlist(DEFAULT_WATCHLIST)
        return DEFAULT_WATCHLIST
    return json.loads(STATE_FILE.read_text())


def save_watchlist(items: list[dict]) -> None:
    STATE_FILE.write_text(json.dumps(items, indent=2))


def _lookup_ticker(ticker: str) -> dict:
    """Validates a ticker against Yahoo Finance and builds its display metadata."""
    try:
        last_price = yf.Ticker(ticker).fast_info["lastPrice"]
    except Exception as exc:
        raise TickerNotFoundError(f"No market data found for '{ticker}'") from exc

    if last_price is None:
        raise TickerNotFoundError(f"No market data found for '{ticker}'")

    exchange = "LSE" if ticker.upper().endswith(".L") else "NYSE"
    return {"ticker": ticker.upper(), "name": ticker.upper(), "exchange": exchange}


def add_ticker(ticker: str) -> dict:
    ticker = ticker.strip().upper()
    items = load_watchlist()

    existing = next((i for i in items if i["ticker"] == ticker), None)
    if existing:
        return existing

    new_item = _lookup_ticker(ticker)
    items.append(new_item)
    save_watchlist(items)
    return new_item


def remove_ticker(ticker: str) -> None:
    ticker = ticker.strip().upper()
    items = [i for i in load_watchlist() if i["ticker"] != ticker]
    save_watchlist(items)
