"""Podcast agent: market data -> ~3 minute spoken script -> mp3 via ElevenLabs."""

import json
import os
from datetime import date

import anthropic
import requests

DISCLAIMER = (
    "This briefing is AI-generated general information only. "
    "It is not financial advice."
)

SYSTEM_PROMPT = f"""You write a spoken morning market briefing for Australian and New Zealand investors, read aloud before the ASX opens.

Structure, with a natural spoken transition between each part:
1. New York session: about 175 words.
2. London session: about 175 words.
3. Oceania ahead: about 100 words, covering only the events provided.
Total 420 to 460 words, which is about 3 minutes of audio.

Rules:
- Use only facts in the provided data. Never invent numbers, events or reasons.
- Do not link moves to causes unless the data states the cause. Transitions can be neutral ("Over in London").
- Use the exact spoken_date given for the greeting.
- No buy, sell or hold suggestions and no price predictions.
- Write for the ear: short sentences, no bullet points, no headings, no markdown, no emoji.
- Say tickers as company names. Say percentages in words, for example "up one point two percent".
- Australian English spelling.
- Open with one short greeting line. End with this exact sentence: "{DISCLAIMER}"

Output only the script text."""


def write_script(market: dict, oceania: dict) -> str:
    """Ask Claude for the script. Falls back to a template if the API fails."""
    try:
        client = anthropic.Anthropic()
        response = client.beta.messages.create(
            model="claude-opus-5",
            max_tokens=4000,
            output_config={"effort": "low"},
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
        text = "".join(b.text for b in response.content if b.type == "text").strip()
        if not text:
            raise RuntimeError("Claude returned an empty script")
        return text
    except Exception as err:
        print(f"[podcast] Claude unavailable ({err}), using template script")
        return template_script(market, oceania)


def spoken_date(iso: str) -> str:
    """Compute the weekday in code so the model never has to guess it."""
    d = date.fromisoformat(iso)
    return f"{d.strftime('%A')} {d.day} {d.strftime('%B')}"


def template_script(market: dict, oceania: dict) -> str:
    """Canned script built straight from the data, so the demo never breaks."""
    ny = market["sessions"]["new_york"]
    ldn = market["sessions"]["london"]
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
    return "\n\n".join(parts)


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
