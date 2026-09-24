"""Stand-in for teammate 1's scraper.

build_briefing.py uses this only when backend/scraper.py does not exist yet.
Shape here IS the contract: scraper.get_market_data() must return the same keys.

{
  "date": "YYYY-MM-DD",                      # the Oceania morning this brief is for
  "sessions": {
    "new_york": {
      "headline": str,                        # one line, what defined the session
      "bullets": [str, ...],                  # 3 to 4 short facts, no advice
      "movers": [{"ticker", "name", "pct_change"}, ...]   # 3 to 5 biggest moves
    },
    "london": { same shape as new_york }
  }
}

Oceania events come from oceania_events.json, not the scraper.
"""


def get_market_data() -> dict:
    return {
        "date": "2026-09-25",
        "sessions": {
            "new_york": {
                "headline": "Wall Street closes higher as tech leads a late rally",
                "bullets": [
                    "S&P 500 up 0.6%, Nasdaq Composite up 1.1%, Dow Jones up 0.2%.",
                    "Chipmakers led gains after Nvidia added 3.4% on heavy volume.",
                    "US 10-year Treasury yield eased to 4.12%.",
                    "Energy lagged as WTI crude slipped 1.3%.",
                ],
                "movers": [
                    {"ticker": "NVDA", "name": "Nvidia", "pct_change": 3.4},
                    {"ticker": "TSLA", "name": "Tesla", "pct_change": -2.1},
                    {"ticker": "AAPL", "name": "Apple", "pct_change": 1.2},
                    {"ticker": "JPM", "name": "JPMorgan Chase", "pct_change": 0.4},
                ],
            },
            "london": {
                "headline": "FTSE 100 edges lower as miners and oil weigh",
                "bullets": [
                    "FTSE 100 down 0.3%, FTSE 250 up 0.1%.",
                    "BP fell 1.8% alongside weaker crude prices.",
                    "AstraZeneca rose 1.5%, cushioning the index.",
                    "Pound steady against the US dollar at 1.34.",
                ],
                "movers": [
                    {"ticker": "BP.L", "name": "BP", "pct_change": -1.8},
                    {"ticker": "AZN.L", "name": "AstraZeneca", "pct_change": 1.5},
                    {"ticker": "HSBA.L", "name": "HSBC", "pct_change": -0.6},
                    {"ticker": "VOD.L", "name": "Vodafone", "pct_change": 0.9},
                ],
            },
        },
    }
