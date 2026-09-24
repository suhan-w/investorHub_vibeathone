// Before the Bell: iPhone home screen widget for Scriptable.
// Reads today's briefing.json and taps through to the web app to play the audio.

const BASE_URL = "http://172.20.10.8:5173";

const C = {
  bg: new Color("#0f3d3e"),
  ink: Color.white(),
  soft: new Color("#ffffff", 0.7),
  faint: new Color("#ffffff", 0.45),
  up: new Color("#6ee7a0"),
  down: new Color("#ff9b9b"),
};

async function loadBriefing() {
  const fm = FileManager.local();
  const cache = fm.joinPath(fm.documentsDirectory(), "before-the-bell.json");
  try {
    const req = new Request(`${BASE_URL}/briefing.json?t=${Date.now()}`);
    req.timeoutInterval = 8;
    const data = await req.loadJSON();
    fm.writeString(cache, JSON.stringify(data));
    return data;
  } catch (e) {
    // Offline or laptop asleep: show the last briefing we saw
    return fm.fileExists(cache) ? JSON.parse(fm.readString(cache)) : null;
  }
}

function pct(v) {
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function dayLabel(iso) {
  const d = new Date(iso + "T00:00:00");
  const df = new DateFormatter();
  df.dateFormat = "EEE d MMM";
  return df.string(d);
}

function addText(stack, text, size, color, weight = "regular", lines = 1) {
  const t = stack.addText(text);
  t.font = weight === "bold" ? Font.boldSystemFont(size)
    : weight === "semibold" ? Font.semiboldSystemFont(size)
    : Font.systemFont(size);
  t.textColor = color;
  t.lineLimit = lines;
  return t;
}

function marketColumn(parent, label, session, count) {
  const col = parent.addStack();
  col.layoutVertically();
  addText(col, label, 11, C.faint, "semibold");
  for (const idx of session.indexes || []) {
    const row = col.addStack();
    addText(row, idx.name, 11, C.soft);
    row.addSpacer(4);
    addText(row, pct(idx.pct_change), 11, idx.pct_change >= 0 ? C.up : C.down, "bold");
  }
  col.addSpacer(2);
  addText(col, session.headline, 12, C.ink, "semibold", 2);
  col.addSpacer(6);
  const movers = [...session.movers]
    .sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change))
    .slice(0, count);
  for (const m of movers) {
    const row = col.addStack();
    row.centerAlignContent();
    addText(row, m.name, 12, C.soft);
    row.addSpacer();
    addText(row, pct(m.pct_change), 12, m.pct_change >= 0 ? C.up : C.down, "semibold");
    col.addSpacer(3);
  }
}

function playPill(parent, briefing) {
  const pill = parent.addStack();
  pill.backgroundColor = C.ink;
  pill.cornerRadius = 11;
  pill.setPadding(4, 10, 4, 10);
  pill.centerAlignContent();
  const icon = pill.addImage(SFSymbol.named("play.fill").image);
  icon.imageSize = new Size(10, 10);
  icon.tintColor = C.bg;
  pill.addSpacer(5);
  addText(pill, briefing.audio_url ? "Play morning brief" : "Read brief", 11, C.bg, "bold");
}

async function buildWidget() {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 14, 14, 14);
  w.url = BASE_URL;
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);

  const briefing = await loadBriefing();
  if (!briefing) {
    addText(w, "Before the Bell", 13, C.ink, "bold");
    w.addSpacer(6);
    addText(w, "Today's briefing isn't ready yet.", 12, C.soft, "regular", 2);
    return w;
  }

  const { new_york, london, oceania } = briefing.sessions;
  const family = config.widgetFamily || "medium";

  // Header: brand, date, play pill
  const header = w.addStack();
  header.centerAlignContent();
  const titles = header.addStack();
  titles.layoutVertically();
  addText(titles, "BEFORE THE BELL", 10, C.faint, "bold");
  addText(titles, dayLabel(briefing.date), 15, C.ink, "bold");
  header.addSpacer();
  if (family !== "small") playPill(header, briefing);

  w.addSpacer(8);

  if (family === "small") {
    addText(w, oceania.headline, 12, C.ink, "semibold", 3);
    w.addSpacer();
    playPill(w, briefing);
    return w;
  }

  // Overnight: New York and London side by side
  const rows = family === "large" ? 5 : 2;
  const markets = w.addStack();
  marketColumn(markets, "NEW YORK", new_york, rows);
  markets.addSpacer(14);
  marketColumn(markets, "LONDON", london, rows);

  w.addSpacer();

  // Oceania line along the bottom
  const foot = w.addStack();
  foot.centerAlignContent();
  const pin = foot.addImage(SFSymbol.named("sunrise.fill").image);
  pin.imageSize = new Size(11, 11);
  pin.tintColor = C.soft;
  foot.addSpacer(5);
  addText(foot, oceania.headline, 11, C.soft, "regular", 1);

  if (family === "large") {
    w.addSpacer(8);
    for (const e of oceania.events.slice(0, 3)) {
      const row = w.addStack();
      addText(row, e.time, 10, C.faint, "semibold");
      row.addSpacer(8);
      addText(row, e.title, 11, C.ink);
      w.addSpacer(3);
    }
  }

  return w;
}

const widget = await buildWidget();
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
