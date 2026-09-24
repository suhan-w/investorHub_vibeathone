"""Turns raw ticker facts into a ~450-word podcast-style narrative via Claude.

Standalone and testable: summarize_ticker() never raises, it always returns
{"summary": str, "summary_source": "llm" | "fallback"}.
"""

import json
import os
import sys

import anthropic
from dotenv import load_dotenv

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_BACKEND_DIR = os.path.dirname(_THIS_DIR)
_ROOT_DIR = os.path.dirname(_BACKEND_DIR)
load_dotenv(os.path.join(_BACKEND_DIR, ".env"))
load_dotenv(os.path.join(_ROOT_DIR, ".env"))

MODEL = "claude-opus-5"

SUMMARY_SYSTEM_PROMPT = (
    "You are a financial news narrator writing a short segment for a capital-markets "
    "podcast briefing. You will be given raw facts about one stock: its latest price move, "
    "volume, and up to two recent headline snippets. Write a factual, engaging ~450-word "
    "narrative a podcast host could read aloud, weaving the price/volume move together with "
    "the headline context.\n\n"
    "Hard rules:\n"
    "- Ground every claim ONLY in the facts and headlines given below. Never invent numbers, "
    "events, causes, or context that isn't provided.\n"
    "- If headlines are missing or sparse, say so plainly rather than fabricating news.\n"
    "- Never give financial advice, and never make or imply a buy/sell/hold recommendation.\n"
    "- Never speculate about non-public or undisclosed information beyond what's provided.\n"
    "- Plain prose only, no headers, no bullet points, no markdown."
)


def _fallback_summary(facts: dict) -> str:
    ticker, exchange = facts.get("ticker"), facts.get("exchange")
    price, change_pct, volume_note = facts.get("price"), facts.get("change_pct"), facts.get("volume_note")
    if price is None:
        return f"{ticker} ({exchange}): no current price data available."
    direction = "up" if (change_pct or 0) >= 0 else "down"
    parts = [
        f"{ticker} ({exchange}) is trading at {price}, {direction} {abs(change_pct):.2f}% today, "
        f"on volume of {volume_note}."
    ]
    headlines = facts.get("headlines") or []
    if headlines:
        parts.append("Recent headlines: " + "; ".join(h["title"] for h in headlines if h.get("title")) + ".")
    else:
        parts.append("No recent headlines available.")
    return " ".join(parts)


def summarize_ticker(facts: dict) -> dict:
    """Returns {"summary": str, "summary_source": "llm" | "fallback"}. Never raises."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print(f"[summarizer] ANTHROPIC_API_KEY not set, using fallback for {facts.get('ticker')}", file=sys.stderr)
        return {"summary": _fallback_summary(facts), "summary_source": "fallback"}

    try:
        workspace_id = os.environ.get("ANTHROPIC_WORKSPACE_ID")
        default_headers = {"anthropic-workspace-id": workspace_id} if workspace_id else None
        client = anthropic.Anthropic(api_key=api_key, default_headers=default_headers)
        user_payload = json.dumps(
            {
                "ticker": facts["ticker"],
                "exchange": facts["exchange"],
                "price": facts["price"],
                "change_pct": facts["change_pct"],
                "volume_note": facts["volume_note"],
                "headlines": [
                    {"title": h["title"], "publisher": h.get("publisher")}
                    for h in (facts.get("headlines") or [])
                ],
            },
            indent=2,
        )
        response = client.messages.create(
            model=MODEL,
            max_tokens=2048,
            output_config={"effort": "low"},
            system=SUMMARY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Facts:\n{user_payload}\n\nWrite the ~450-word segment now."}],
        )
        text = next((b.text for b in response.content if b.type == "text"), "").strip()
        if not text:
            raise ValueError("empty text response from Claude")
        return {"summary": text, "summary_source": "llm"}
    except anthropic.AuthenticationError as exc:
        print(f"[summarizer] auth error for {facts.get('ticker')}: {exc}", file=sys.stderr)
    except anthropic.RateLimitError as exc:
        print(f"[summarizer] rate limited for {facts.get('ticker')}: {exc}", file=sys.stderr)
    except anthropic.APIStatusError as exc:
        print(f"[summarizer] API error for {facts.get('ticker')}: {exc}", file=sys.stderr)
    except anthropic.APIConnectionError as exc:
        print(f"[summarizer] network error for {facts.get('ticker')}: {exc}", file=sys.stderr)
    except Exception as exc:
        print(f"[summarizer] unexpected error for {facts.get('ticker')}: {exc}", file=sys.stderr)

    return {"summary": _fallback_summary(facts), "summary_source": "fallback"}
