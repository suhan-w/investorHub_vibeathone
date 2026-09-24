"""Standalone data layer: price, volume, headlines, and an AI summary per
watchlist ticker.

Run directly: `python backend/scrapper/data_layer.py [--refresh] [--skip-summary]`
Diagnostics go to stderr; the final JSON array goes to stdout.
"""

import argparse
import json
import os
import sys
import time

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_THIS_DIR)
for _p in (_THIS_DIR, _BACKEND_DIR):
    if _p not in sys.path:
        sys.path.insert(0, _p)

import yfinance as yf  # noqa: E402

from fetch_moves import fetch_moves  # noqa: E402
from watchlist import WATCHLIST  # noqa: E402
from summarizer import summarize_ticker, _fallback_summary  # noqa: E402

CACHE_FILE = os.path.join(_THIS_DIR, ".data_layer_cache.json")
CACHE_TTL_SECONDS = 300


def _load_cache() -> dict | None:
    if not os.path.exists(CACHE_FILE):
        return None
    try:
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            cache = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    if time.time() - cache.get("cached_at", 0) > CACHE_TTL_SECONDS:
        return None
    return cache


def _save_cache(data: list[dict]) -> None:
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump({"cached_at": time.time(), "data": data}, f, indent=2)
    except OSError as exc:
        print(f"[data_layer] failed to write cache: {exc}", file=sys.stderr)


def fetch_headlines(ticker: str, limit: int = 2) -> list[dict]:
    try:
        raw = yf.Ticker(ticker).news or []
    except Exception as exc:
        print(f"[data_layer] headline fetch failed for {ticker}: {exc}", file=sys.stderr)
        return []

    def is_story(article):
        return article.get("content", article).get("contentType") == "STORY"

    raw_sorted = sorted(raw, key=lambda a: 0 if is_story(a) else 1)
    headlines = []
    for article in raw_sorted:
        content = article.get("content", article)
        title = content.get("title")
        if not title:
            continue
        provider = content.get("provider") or {}
        link = (
            (content.get("canonicalUrl") or {}).get("url")
            or (content.get("clickThroughUrl") or {}).get("url")
            or content.get("link")
        )
        headlines.append(
            {
                "title": title,
                "publisher": provider.get("displayName") or content.get("publisher"),
                "link": link,
                "published": content.get("pubDate") or content.get("providerPublishTime"),
            }
        )
        if len(headlines) >= limit:
            break
    return headlines


def _format_volume_note(volume, avg_volume, unusual_volume) -> str:
    if not volume or not avg_volume:
        return "no volume data"
    ratio = volume / avg_volume

    def fmt(n):
        if n >= 1e6:
            return f"{n / 1e6:.1f}M"
        if n >= 1e3:
            return f"{n / 1e3:.1f}K"
        return str(int(n))

    tag = " — unusual" if unusual_volume else ""
    return f"{fmt(volume)} ({ratio:.1f}x avg{tag})"


def build_ticker_record(move: dict, skip_summary: bool = False) -> dict:
    ticker, exchange = move["ticker"], move.get("exchange")
    headlines = fetch_headlines(ticker)

    if move.get("error"):
        price, change_pct, volume_note = None, None, "no data available"
    else:
        price = move.get("close")
        change_pct = move.get("pct_change")
        volume_note = _format_volume_note(move.get("volume"), move.get("avg_volume"), move.get("unusual_volume"))

    facts = {
        "ticker": ticker,
        "exchange": exchange,
        "price": price,
        "change_pct": change_pct,
        "volume_note": volume_note,
        "headlines": headlines,
    }

    if skip_summary:
        summary_result = {"summary": _fallback_summary(facts), "summary_source": "fallback"}
    else:
        summary_result = summarize_ticker(facts)

    record = {
        "ticker": ticker,
        "exchange": exchange,
        "price": price,
        "change_pct": change_pct,
        "volume_note": volume_note,
        "summary": summary_result["summary"],
        "summary_source": summary_result["summary_source"],
        "headlines": headlines,
    }
    if move.get("error"):
        record["error"] = move["error"]
    return record


def get_all_ticker_data(force_refresh: bool = False, skip_summary: bool = False) -> list[dict]:
    if not force_refresh:
        cached = _load_cache()
        if cached is not None:
            print(f"[data_layer] cache hit ({int(time.time() - cached['cached_at'])}s old)", file=sys.stderr)
            return cached["data"]

    print("[data_layer] fetching fresh data...", file=sys.stderr)
    try:
        moves = fetch_moves()
    except Exception as exc:
        print(f"[data_layer] fetch_moves() failed entirely: {exc}", file=sys.stderr)
        moves = [{**item, "error": str(exc)} for item in WATCHLIST]

    records = []
    for move in moves:
        try:
            records.append(build_ticker_record(move, skip_summary=skip_summary))
        except Exception as exc:
            print(f"[data_layer] record build failed for {move.get('ticker')}: {exc}", file=sys.stderr)
            records.append(
                {
                    "ticker": move.get("ticker"),
                    "exchange": move.get("exchange"),
                    "price": None,
                    "change_pct": None,
                    "volume_note": "no data available",
                    "summary": "No data available for this ticker.",
                    "summary_source": "fallback",
                    "headlines": [],
                    "error": str(exc),
                }
            )
        time.sleep(0.3)  # polite pacing between per-ticker unofficial-news-endpoint calls

    _save_cache(records)
    return records


def main() -> None:
    parser = argparse.ArgumentParser(description="Price, volume, headlines, and AI summary per watchlist ticker.")
    parser.add_argument("--refresh", action="store_true", help="bypass cache, re-fetch and re-summarize everything")
    parser.add_argument(
        "--skip-summary",
        action="store_true",
        help="skip the Claude call, use the templated fallback (fast dev loop, zero API cost)",
    )
    args = parser.parse_args()
    print(json.dumps(get_all_ticker_data(force_refresh=args.refresh, skip_summary=args.skip_summary), indent=2))


if __name__ == "__main__":
    main()
