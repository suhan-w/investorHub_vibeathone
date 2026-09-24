"""Podcast agent: market data -> widget text + ~3 minute script -> mp3 via ElevenLabs."""

import json
import os
from datetime import date

import anthropic
import requests

DISCLAIMER = (
    "This briefing is AI-generated general information only. "
    "It is not financial advice."
)

SYSTEM_PROMPT = f"""You write a morning market briefing for Australian and New Zealand investors, delivered before the ASX opens. You produce two things: short text for a phone widget, and a spoken script.

The data covers a watchlist of individual stocks per session, not index levels. Each stock has price, percent change, volume versus average and up to two scraped headlines. LSE prices are in pence.

Widget text, per session (new_york and london):
- headline: at most 9 words, describing the session for this watchlist.
- bullets: 3 short factual lines, each at most 14 words.

Spoken script structure, with a natural transition between parts:
1. New York session: about 160 words.
2. London session: about 160 words.
3. Oceania ahead: about 90 words, covering only the events provided.
Total 410 to 440 words. Do not exceed 450, which is about 3 minutes of audio.

Rules for everything you write:
- Use only facts in the provided data. Never invent numbers, events, index levels or reasons.
- Do not link a move to a cause unless a headline clearly states it for that same company.
- Headlines are scraped and noisy. Ignore ones about a different company, and ignore opinion pieces on valuation or whether to buy.
- No buy, sell or hold suggestions and no price predictions.
- Australian English spelling.

Extra rules for the script:
- Written for the ear: short sentences, no lists, no headings, no markdown, no emoji.
- Say company names, not tickers. Say numbers in words, for example "up one point two percent".
- Round prices when spoken, for example "about two hundred and twenty five dollars". Mention at most one headline per company.
- Open with a one-line greeting using the exact spoken_date given.
- End with this exact sentence: "{DISCLAIMER}"
"""

SESSION_SCHEMA = {
    "type": "object",
    "properties": {
        "headline": {"type": "string"},
        "bullets": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["headline", "bullets"],
    "additionalProperties": False,
}

BRIEFING_SCHEMA = {
    "type": "object",
    "properties": {
        "new_york": SESSION_SCHEMA,
        "london": SESSION_SCHEMA,
        "script": {"type": "string"},
    },
    "required": ["new_york", "london", "script"],
    "additionalProperties": False,
}


def write_briefing(market: dict, oceania: dict) -> dict:
    """One Claude call for widget text and the spoken script.

    Returns {"new_york": {headline, bullets}, "london": {...}, "script": str}.
    Falls back to a template if the API fails, so the demo never breaks.
    """
    try:
        client = anthropic.Anthropic()
        response = client.beta.messages.create(
            model="claude-opus-5",
            max_tokens=8000,
            output_config={
                "effort": "low",
                "format": {"type": "json_schema", "schema": BRIEFING_SCHEMA},
            },
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": "Market data:\n"
                    + json.dumps(
                        {
                            "spoken_date": spoken_date(market["date"]),
                            "market": market,
                            "oceania": oceania,
                        },
                        indent=2,
                    ),
                }
            ],
        )
        if response.stop_reason == "refusal":
            raise RuntimeError("Claude declined the request")
        text = next(b.text for b in response.content if b.type == "text")
        return json.loads(text)
    except Exception as err:
        print(f"[podcast] Claude unavailable ({err}), using template briefing")
        return template_briefing(market, oceania)


def spoken_date(iso: str) -> str:
    """Compute the weekday in code so the model never has to guess it."""
    d = date.fromisoformat(iso)
    return f"{d.strftime('%A')} {d.day} {d.strftime('%B')}"


def template_session(session: dict) -> dict:
    movers = session.get("movers", [])
    if session.get("headline"):
        return {"headline": session["headline"], "bullets": session.get("bullets", [])}
    ups = sum(1 for m in movers if m["pct_change"] >= 0)
    return {
        "headline": f"{ups} of {len(movers)} watchlist stocks closed higher",
        "bullets": [f"{m['name']} {m['pct_change']:+.1f}%" for m in movers[:3]],
    }


def template_briefing(market: dict, oceania: dict) -> dict:
    """Canned briefing built straight from the data."""
    ny = template_session(market["sessions"]["new_york"])
    ldn = template_session(market["sessions"]["london"])
    parts = [
        "Good morning, here is your overnight market briefing.",
        f"First, New York. {ny['headline']}.",
        " ".join(ny["bullets"]),
        f"Over to London. {ldn['headline']}.",
        " ".join(ldn["bullets"]),
        f"Now, the Oceania session ahead. {oceania['headline']}.",
        " ".join(f"{e['title']}: {e['detail']}" for e in oceania["events"]),
        DISCLAIMER,
    ]
    return {"new_york": ny, "london": ldn, "script": "\n\n".join(parts)}


def synthesize(script: str, out_path: str) -> bool:
    """Turn the script into an mp3. Returns False (keeping any old file) on failure."""
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        print("[podcast] ELEVENLABS_API_KEY not set, skipping audio")
        return False

    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    model_id = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")
    res = requests.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        params={"output_format": "mp3_44100_128"},
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        json={"text": script, "model_id": model_id},
        timeout=120,
    )
    if res.status_code != 200:
        print(f"[podcast] ElevenLabs error {res.status_code}: {res.text[:300]}")
        return False

    with open(out_path, "wb") as f:
        f.write(res.content)
    return True
