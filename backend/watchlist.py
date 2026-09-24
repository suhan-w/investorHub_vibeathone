"""Default demo watchlist: 5 NYSE + 5 LSE tickers."""

WATCHLIST = [
    # NYSE
    {"ticker": "AAPL", "name": "Apple", "exchange": "NYSE"},
    {"ticker": "MSFT", "name": "Microsoft", "exchange": "NYSE"},
    {"ticker": "NVDA", "name": "Nvidia", "exchange": "NYSE"},
    {"ticker": "TSLA", "name": "Tesla", "exchange": "NYSE"},
    {"ticker": "JPM", "name": "JPMorgan Chase", "exchange": "NYSE"},
    # LSE (Yahoo uses the .L suffix)
    {"ticker": "BP.L", "name": "BP", "exchange": "LSE"},
    {"ticker": "HSBA.L", "name": "HSBC", "exchange": "LSE"},
    {"ticker": "AZN.L", "name": "AstraZeneca", "exchange": "LSE"},
    {"ticker": "ULVR.L", "name": "Unilever", "exchange": "LSE"},
    {"ticker": "VOD.L", "name": "Vodafone", "exchange": "LSE"},
]
