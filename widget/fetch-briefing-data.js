// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: cloud-download-alt;

// Fetches overnight NY/London moves from Yahoo Finance and caches them as JSON
// for the Before the Bell widget. This is the only script that touches the
// network; the widget script just reads the cache.

const CACHE_FILE = "before-the-bell.json";

const INDEXES = [
  { symbol: "^GSPC", name: "S&P 500", market: "NY" },
  { symbol: "^FTSE", name: "FTSE 100", market: "LON" },
];

// Mirrors the dashboard's default watchlist.
const WATCHLIST = [
  { symbol: "AAPL", name: "Apple", market: "NY" },
  { symbol: "MSFT", name: "Microsoft", market: "NY" },
  { symbol: "NVDA", name: "Nvidia", market: "NY" },
  { symbol: "TSLA", name: "Tesla", market: "NY" },
  { symbol: "JPM", name: "JPMorgan Chase", market: "NY" },
  { symbol: "BP.L", name: "BP", market: "LON" },
  { symbol: "HSBA.L", name: "HSBC", market: "LON" },
  { symbol: "AZN.L", name: "AstraZeneca", market: "LON" },
  { symbol: "ULVR.L", name: "Unilever", market: "LON" },
  { symbol: "VOD.L", name: "Vodafone", market: "LON" },
];

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const req = new Request(url);
  req.headers = { "User-Agent": "Mozilla/5.0" };
  req.timeoutInterval = 15;

  const json = await req.loadJSON();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta || meta.regularMarketPrice == null || !meta.chartPreviousClose) {
    throw new Error(`No quote for ${symbol}`);
  }

  const price = meta.regularMarketPrice;
  const prevClose = meta.chartPreviousClose;
  return {
    currency: meta.currency,
    price,
    prevClose,
    pctChange: ((price - prevClose) / prevClose) * 100,
    asOf: new Date(meta.regularMarketTime * 1000).toISOString(),
  };
}

async function fetchAll(items) {
  const results = await Promise.allSettled(items.map((item) => fetchQuote(item.symbol)));
  return items.map((item, i) =>
    results[i].status === "fulfilled" ? { ...item, ...results[i].value } : { ...item, error: String(results[i].reason) }
  );
}

const [indexes, movers] = await Promise.all([fetchAll(INDEXES), fetchAll(WATCHLIST)]);
const okCount = movers.filter((m) => !m.error).length;

const fm = FileManager.local();
const path = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);

if (okCount === 0) {
  // Keep the last good cache rather than overwriting it with nothing.
  console.error("Every quote fetch failed; keeping the previous cache.");
} else {
  fm.writeString(path, JSON.stringify({ updatedAt: new Date().toISOString(), indexes, movers }, null, 2));
  console.log(`Cached ${okCount}/${movers.length} tickers to ${path}`);
}

Script.complete();
