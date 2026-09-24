"""Pulls the latest overnight move + a headline per ticker in the watchlist.

Standalone and testable on its own: `python fetch_moves.py` prints the JSON.
"""

import json
from concurrent.futures import ThreadPoolExecutor

import yfinance as yf

from watchlist_store import load_watchlist


def _fetch_headline(ticker: str) -> str | None:
    try:
        news = yf.Ticker(ticker).news
        for item in news or []:
            title = item.get("content", {}).get("title")
            if title:
                return title
    except Exception:
        pass
    return None


def fetch_moves() -> list[dict]:
    watchlist = load_watchlist()
    tickers = [item["ticker"] for item in watchlist]

    data = yf.download(
        tickers,
        period="2mo",
        interval="1d",
        group_by="ticker",
        auto_adjust=False,
        progress=False,
    )

    with ThreadPoolExecutor(max_workers=len(tickers) or 1) as pool:
        headlines = dict(zip(tickers, pool.map(_fetch_headline, tickers)))

    moves = []
    for item in watchlist:
        ticker = item["ticker"]
        try:
            hist = data[ticker].dropna()
        except KeyError:
            hist = None

        if hist is None or len(hist) < 2:
            moves.append({**item, "error": "no data available"})
            continue

        latest = hist.iloc[-1]
        prev = hist.iloc[-2]

        close = float(latest["Close"])
        prev_close = float(prev["Close"])
        change = close - prev_close
        pct_change = (change / prev_close) * 100 if prev_close else 0.0

        volume = float(latest["Volume"])
        avg_volume = float(hist["Volume"].iloc[:-1].tail(30).mean())
        unusual_volume = avg_volume > 0 and volume > avg_volume * 1.5

        moves.append(
            {
                **item,
                "close": round(close, 2),
                "prev_close": round(prev_close, 2),
                "change": round(change, 2),
                "pct_change": round(pct_change, 2),
                "volume": int(volume),
                "avg_volume": int(avg_volume),
                "unusual_volume": unusual_volume,
                "as_of": str(hist.index[-1].date()),
                "headline": headlines.get(ticker),
            }
        )

    return moves


if __name__ == "__main__":
    print(json.dumps(fetch_moves(), indent=2))
