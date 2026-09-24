"""One command to build the morning briefing.

    python build_briefing.py            # script + audio
    python build_briefing.py --no-audio # script only, saves ElevenLabs credits

Writes frontend/public/briefing.json and frontend/public/briefing.mp3,
which the phone app reads.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

import podcast

HERE = Path(__file__).parent
PUBLIC = HERE.parent / "frontend" / "public"

load_dotenv(HERE / ".env")

try:
    from scraper import get_market_data  # teammate 1's real scraper
    SOURCE = "scraper"
except ImportError:
    from sample_data import get_market_data  # stand-in until scraper.py lands
    SOURCE = "sample"


def main() -> None:
    skip_audio = "--no-audio" in sys.argv

    print(f"[build] fetching market data from {SOURCE}")
    market = get_market_data()
    oceania = json.loads((HERE / "oceania_events.json").read_text())

    print("[build] writing script")
    script = podcast.write_script(market, oceania)
    words = len(script.split())
    print(f"[build] script is {words} words (about {words / 150:.1f} min)")

    mp3_path = PUBLIC / "briefing.mp3"
    if skip_audio:
        print("[build] --no-audio, keeping existing mp3")
    else:
        print("[build] generating audio with ElevenLabs")
        if podcast.synthesize(script, str(mp3_path)):
            print(f"[build] audio saved to {mp3_path}")

    briefing = {
        "date": market["date"],
        "sessions": {**market["sessions"], "oceania": oceania},
        "script": script,
        "audio_url": "/briefing.mp3" if mp3_path.exists() else None,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": SOURCE,
    }
    (PUBLIC / "briefing.json").write_text(json.dumps(briefing, indent=2))
    print(f"[build] briefing saved to {PUBLIC / 'briefing.json'}")


if __name__ == "__main__":
    main()
