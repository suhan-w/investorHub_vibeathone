"""One command to build the morning briefing.

    python build_briefing.py            # script + audio
    python build_briefing.py --no-audio # script only, saves ElevenLabs credits
    python build_briefing.py --sample   # use sample_data.py instead of live scraping
    python build_briefing.py --date 2026-09-24  # label the brief for a given morning
    python build_briefing.py --cached   # reuse the last scrape instead of hitting Yahoo

Writes mobile/public/briefing.json and mobile/public/briefing.mp3,
which the phone app reads.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

import podcast

HERE = Path(__file__).parent
PUBLIC = HERE.parent / "mobile" / "public"

load_dotenv(HERE / ".env")

if "--sample" in sys.argv:
    from sample_data import get_market_data
    SOURCE = "sample"
else:
    from scraper import get_market_data  # teammate 1's live data layer
    SOURCE = "scraper"


def main() -> None:
    skip_audio = "--no-audio" in sys.argv

    print(f"[build] fetching market data from {SOURCE}")
    for_date = sys.argv[sys.argv.index("--date") + 1] if "--date" in sys.argv else None
    if SOURCE == "scraper":
        market = get_market_data(for_date, cached="--cached" in sys.argv)
    else:
        market = get_market_data()
    oceania = json.loads((HERE / "oceania_events.json").read_text())

    print("[build] writing widget text and script")
    written = podcast.write_briefing(market, oceania)
    script = written["script"]
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
        "sessions": {
            key: {
                **written[key],
                "indexes": market["sessions"][key].get("indexes", []),
                "movers": market["sessions"][key]["movers"],
            }
            for key in ("new_york", "london")
        }
        | {"oceania": oceania},
        "script": script,
        "audio_url": "/briefing.mp3" if mp3_path.exists() else None,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": SOURCE,
    }
    (PUBLIC / "briefing.json").write_text(json.dumps(briefing, indent=2))
    print(f"[build] briefing saved to {PUBLIC / 'briefing.json'}")


if __name__ == "__main__":
    main()
