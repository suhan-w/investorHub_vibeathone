// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: bell;

// Renders the Before the Bell widget from the cached JSON written by
// fetch-briefing-data.js. Never touches the network, so a failed or slow
// fetch can't leave the widget blank.

const CACHE_FILE = "before-the-bell.json";
const STALE_AFTER_HOURS = 12;
const MAX_ROWS_LARGE = 3;
// Deep link opened when the widget is tapped, e.g. your deployed dashboard with an autoplay param.
const APP_URL = "";

const THEME = {
  bg: "#0f2a1f",
  textPrimary: "#ffffff",
  textSecondary: "#a9bdb2",
  textMuted: "#6f8a7d",
  rule: "#224535",
  up: "#4fd18b",
  down: "#ff7b72",
  pillBg: "#ffffff",
  pillInk: "#0f2a1f",
};

// ---------- Data ----------

function loadCache() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), CACHE_FILE);
  if (!fm.fileExists(path)) return null;
  try {
    return JSON.parse(fm.readString(path));
  } catch {
    return null;
  }
}

function topMovers(data, market, count) {
  return data.movers
    .filter((m) => m.market === market && !m.error)
    .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange))
    .slice(0, count);
}

// ---------- Formatting ----------

function fmtNum(value, decimals) {
  return value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatPrice(quote) {
  // LSE equities quote in pence (GBp), not pounds.
  if (quote.currency === "GBp") return `${fmtNum(quote.price, 1)}p`;
  const symbol = { USD: "$", GBP: "£" }[quote.currency] ?? "";
  return `${symbol}${fmtNum(quote.price, 2)}`;
}

function formatPct(value) {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
}

function signalColor(value) {
  if (value > 0) return new Color(THEME.up);
  if (value < 0) return new Color(THEME.down);
  return new Color(THEME.textSecondary);
}

function formatAge(hours) {
  if (hours < 48) return `${Math.floor(hours)}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ---------- ASX session ----------

function sydneyOffsetMs(date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Australia/Sydney",
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const wallClockAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((wallClockAsUtc - date.getTime()) / 60000) * 60000;
}

// Uses today's UTC offset for the whole week, so a DST switch mid-week can be off by an hour.
// Public holidays aren't accounted for.
function asxSession(now) {
  const offset = sydneyOffsetMs(now);
  const tz = offset === 11 * 3600000 ? "AEDT" : "AEST";
  const sydneyNow = new Date(now.getTime() + offset);

  for (let i = 0; i < 8; i++) {
    const y = sydneyNow.getUTCFullYear();
    const m = sydneyNow.getUTCMonth();
    const d = sydneyNow.getUTCDate() + i;
    const weekday = new Date(Date.UTC(y, m, d)).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;

    const open = new Date(Date.UTC(y, m, d, 10, 0) - offset);
    const close = new Date(Date.UTC(y, m, d, 16, 0) - offset);
    if (now < open) return { state: "pre", open, tz, isToday: i === 0 };
    if (now < close) return { state: "open", close, tz };
  }
}

// ---------- Drawing helpers ----------

function addText(parent, str, font, color) {
  const t = parent.addText(str);
  t.font = font;
  t.textColor = color instanceof Color ? color : new Color(color);
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.75;
  return t;
}

function addRightAligned(parent, str, font, color, width) {
  const cell = parent.addStack();
  cell.size = new Size(width, 0);
  cell.addSpacer();
  addText(cell, str, font, color);
}

function addRule(widget) {
  const line = widget.addStack();
  line.size = new Size(0, 1);
  line.backgroundColor = new Color(THEME.rule);
  line.addSpacer();
}

// ---------- Sections ----------

function addHeader(widget, data, now) {
  const row = widget.addStack();
  row.centerAlignContent();

  addText(row, "BEFORE THE BELL", Font.heavySystemFont(11), THEME.textPrimary);
  row.addSpacer(6);
  // Built by hand because locale month abbreviations vary ("SEP" vs "SEPT") across iOS versions.
  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const date = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
  addText(row, date, Font.semiboldSystemFont(11), THEME.textSecondary);
  row.addSpacer();

  if (data) {
    const ageHours = (now - new Date(data.updatedAt)) / 3600000;
    if (ageHours > STALE_AFTER_HOURS) {
      addText(row, `Updated ${formatAge(ageHours)}`, Font.mediumSystemFont(10), THEME.textMuted);
    }
  }
}

function addMarketSection(widget, label, data, market, maxRows) {
  const header = widget.addStack();
  header.centerAlignContent();
  addText(header, label, Font.boldSystemFont(10), THEME.textSecondary);
  header.addSpacer();

  const index = data.indexes.find((i) => i.market === market && !i.error);
  if (index) {
    addText(header, index.name, Font.mediumSystemFont(10), THEME.textMuted);
    header.addSpacer(6);
    addText(header, formatPct(index.pctChange), Font.semiboldMonospacedSystemFont(10), signalColor(index.pctChange));
  }

  widget.addSpacer(5);
  addRule(widget);

  const rows = topMovers(data, market, maxRows);
  if (rows.length === 0) {
    widget.addSpacer(6);
    addText(widget, "No data", Font.systemFont(11), THEME.textMuted);
    return;
  }

  for (const mover of rows) {
    widget.addSpacer(6);
    const row = widget.addStack();
    row.centerAlignContent();
    const ticker = mover.symbol.replace(/\.L$/, "");
    addText(row, ticker, Font.boldMonospacedSystemFont(12), THEME.textPrimary);
    if (mover.name.toUpperCase() !== ticker) {
      row.addSpacer(6);
      addText(row, mover.name, Font.systemFont(11), THEME.textSecondary);
    }
    row.addSpacer();
    addRightAligned(row, formatPrice(mover), Font.regularMonospacedSystemFont(12), THEME.textPrimary, 78);
    addRightAligned(row, formatPct(mover.pctChange), Font.semiboldMonospacedSystemFont(12), signalColor(mover.pctChange), 64);
  }
}

function addPlayRow(widget) {
  const pill = widget.addStack();
  pill.backgroundColor = new Color(THEME.pillBg);
  pill.cornerRadius = 18;
  pill.setPadding(9, 12, 9, 14);
  pill.centerAlignContent();

  const symbol = SFSymbol.named("play.fill");
  symbol.applyFont(Font.boldSystemFont(12));
  const icon = pill.addImage(symbol.image);
  icon.imageSize = new Size(12, 12);
  icon.tintColor = new Color(THEME.pillInk);

  pill.addSpacer(8);
  addText(pill, "Play today's briefing", Font.semiboldSystemFont(13), THEME.pillInk);
  pill.addSpacer();
}

function addAsxStrip(widget, now) {
  addRule(widget);
  widget.addSpacer(8);

  const strip = widget.addStack();
  strip.centerAlignContent();
  addText(strip, "ASX", Font.boldSystemFont(10), THEME.textSecondary);
  strip.addSpacer(6);

  const session = asxSession(now);
  if (session.state === "open") {
    addText(strip, `OPEN · CLOSES 16:00 ${session.tz}`, Font.mediumSystemFont(10), THEME.textMuted);
    return;
  }

  const day = session.isToday
    ? ""
    : new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "Australia/Sydney" }).format(session.open).toUpperCase() + " ";
  addText(strip, `OPENS ${day}10:00 ${session.tz}`, Font.mediumSystemFont(10), THEME.textMuted);
  strip.addSpacer();

  if (session.open - now < 12 * 3600000) {
    const countdown = strip.addDate(session.open);
    countdown.applyTimerStyle();
    countdown.font = Font.semiboldMonospacedSystemFont(10);
    countdown.textColor = new Color(THEME.textSecondary);
    countdown.rightAlignText();
  }
}

function addEmptyState(widget) {
  widget.addSpacer();
  addText(widget, "No market data yet", Font.semiboldSystemFont(13), THEME.textPrimary);
  widget.addSpacer(4);
  const hint = addText(widget, "Run fetch-briefing-data in Scriptable to populate this widget.", Font.systemFont(11), THEME.textMuted);
  hint.lineLimit = 2;
  widget.addSpacer();
}

// ---------- Widget ----------

function buildLarge(data, now) {
  const widget = new ListWidget();
  widget.backgroundColor = new Color(THEME.bg);
  widget.setPadding(16, 16, 14, 16);

  addHeader(widget, data, now);
  widget.addSpacer(12);

  if (!data) {
    addEmptyState(widget);
    return widget;
  }

  addMarketSection(widget, "NEW YORK", data, "NY", MAX_ROWS_LARGE);
  widget.addSpacer(12);
  addMarketSection(widget, "LONDON", data, "LON", MAX_ROWS_LARGE);
  widget.addSpacer();
  addPlayRow(widget);
  widget.addSpacer(12);
  addAsxStrip(widget, now);
  return widget;
}

function nextRefresh(now) {
  const halfHour = new Date(now.getTime() + 30 * 60000);
  const session = asxSession(now);
  const boundary = session.state === "pre" ? session.open : session.close;
  return boundary < halfHour ? boundary : halfHour;
}

const now = new Date();
const data = loadCache();
// Medium and small layouts come next; every size renders the large layout for now.
const widget = buildLarge(data, now);
if (APP_URL) widget.url = APP_URL;
widget.refreshAfterDate = nextRefresh(now);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentLarge();
}
Script.complete();
