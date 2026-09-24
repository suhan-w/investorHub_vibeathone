# CLAUDE.md: InvestorHub Vibeathon

## The situation

This is a one day vibeathon at the InvestorHub office in Melbourne, run with StartUp Link UniMelb. A brief is revealed live on the day. We have **2 hours to build a working tool and a pitch**, then present to the InvestorHub team at **5:15pm**.

- First prize: fast track to a final round interview for the InvestorHub summer internship.
- Second prize: team mentoring session with InvestorHub's Head of Growth.
- Judges are the InvestorHub team. Expect commercial judging: would a listed company pay for this, and does it help their platform?

Your job is to help me ship a narrow, polished, working demo fast. A small tool that works live beats an ambitious one that breaks.

## The brief

<!-- Paste the brief here as soon as it is revealed. -->

```
BRIEF: (paste on the day)
TARGET USER: (fill in after first 15 min)
ONE PROBLEM WE SOLVE: (fill in after first 15 min)
DEMO PATH (the exact clicks we show): (fill in)
```

Once this section is filled in, treat it as the source of truth. If a request drifts outside it, say so in one line before doing it.

## Who I am

Carson, Master of Management (Accounting) student at the University of Melbourne. Strong on accounting, capital markets and commercial framing. Comfortable with vibe coding tools but not a full-time engineer, so explain anything non-obvious in plain language and keep code simple enough for me to follow and demo confidently.

## Environment

- I work in Google Antigravity with Claude Code attached.
- Run commands yourself where you can; tell me clearly when I need to do something manually (log in, approve, deploy).
- If the morning workshop specifies tools or a stack, follow that instead of the defaults below.

## Default stack (unless the workshop says otherwise)

- Vite + React + TypeScript + Tailwind CSS. One app, no backend unless the brief truly needs one.
- Data from local JSON/CSV files in `/data`. No database.
- Charts: Recharts. Icons: lucide-react.
- If an LLM feature is needed, use the Claude API through a single small server function or API route, with the key in `.env` (never committed, never hardcoded). Always have a canned fallback response so the demo works if the API fails.
- Deploy to Vercel if a live link helps the pitch. Otherwise demo on localhost.

Commands:
```
npm create vite@latest app -- --template react-ts
npm install
npm run dev
npm run build
```

## How to work (time is the constraint)

**Timeline for the 2 hours:**
- 0:00 to 0:15: pick one user, one problem, one demo path. Fill in the brief section above. No code yet.
- 0:15 to 1:30: build. Get something rendering with real-looking data within the first 20 minutes, then improve.
- 1:30 to 2:00: feature freeze. Polish the demo path, fix visual rough edges, write the pitch, rehearse.

**Rules:**
1. Before any sizeable build step, give me a short plan (3 to 5 lines) and wait for a go.
2. Build the demo path first. Only build screens and states we will actually show.
3. Keep the app runnable after every change. Commit to git at each working milestone with a short message, so we can roll back instantly.
4. Prefer hardcoded or mock data over integrations. Fake it convincingly rather than wire up something fragile.
5. If something takes more than 10 minutes to fix, stop and suggest a simpler alternative.
6. After 1:30, only fix bugs and polish. Warn me if I ask for a new feature after this point.
7. Keep responses short. No long explanations unless I ask.

## Domain context: InvestorHub

InvestorHub (Melbourne, founded 2022, co-CEOs Rhys Davis and Ben Williamson) is sales and marketing software for investor relations. Clients are 300+ listed companies on the ASX and LSE, typically $5m to $5b market cap.

Core thesis: traditional IR focuses on the top 20 shareholders, but the investors who move a stock are spread across the whole register. InvestorHub helps companies reach and engage the whole register.

Product flywheel:
- **Attract:** branded investor hub (share price, announcements, Q&A, sign-up forms) that captures investors into an investor list.
- **Understand:** register, trading and engagement data unified per investor. **Ivy**, their AI analyst, tells the company who is moving, who is reachable and who to talk to next.
- **Engage:** targeted campaigns via email, webinars, LinkedIn and trackable links.
- **Repeat:** campaigns drive investors back to the hub. More engagement means more liquidity and better capital raise outcomes.

Customer segments and their pain:
- **Explorers (mining):** raise often, retail drifts away between drill results.
- **Biotech:** complex science, long waits for trial readouts, holders lose conviction.
- **Growth companies:** real revenue but under-followed and thinly traded.
- **Enterprise:** large, complex registers, compliance overhead, manual IR does not scale.

Their success metrics, which our pitch should speak to: hub sign-ups, unique investors engaged, register growth, liquidity, and oversubscribed raises (SPPs, placements).

Key terms: share register, beneficial owner, substantial holder, retail vs institutional vs high net worth, SPP (share purchase plan), placement, continuous disclosure, price-sensitive announcement, catalyst, liquidity, re-rate.

## Compliance guardrails (always apply)

Anything touching investors must respect listed company rules. Build these in visibly; judges will notice.
- No financial advice or buy/sell recommendations aimed at investors.
- Respect continuous disclosure: never surface or generate material information that is not already public in an announcement. AI-generated summaries must stick to facts in the source announcement.
- Any AI-drafted investor communication is a draft for human approval, labelled as such in the UI.
- Use only fictional companies and people in mock data. No real personal data.

## Mock data

Keep all mock data in `/data`. If it does not exist yet, generate it quickly for a fictional ASX company (for example "Exmoor Minerals, ASX:EXM"):
- `register.json`: ~50 holders with name, type (retail / HNW / institution), holding %, 30-day change, date joined.
- `subscribers.json`: hub subscribers with email opens, clicks, Q&A questions, last active date.
- `announcements.json`: 4 to 6 announcements (quarterly report, drilling update, capital raise, investor webinar) with dates and short realistic body text.
- `price.json`: 90 days of daily share price and volume.

Make the numbers realistic and internally consistent so the demo tells a clear story.

## UI and design

- It must look like credible B2B fintech software an IR manager would trust, not a hackathon toy.
- Pick a deliberate, restrained palette and one clear typeface family suited to financial software. Avoid generic defaults (cream background with terracotta accent, near-black with acid green, identical rounded cards everywhere, all-caps eyebrow labels).
- One memorable element (usually the key insight or number the tool produces); keep everything else quiet.
- Use real-looking content everywhere. No lorem ipsum, no "Test User".
- Plain, active copy written for an IR manager or CFO. Buttons say exactly what they do.
- Make the demo path work at laptop and projector resolution. Handle empty and loading states on the screens we show.

## Writing style

- No em dashes anywhere: code comments, UI copy, pitch text or chat replies. Use commas, colons or full stops instead.
- Australian English spelling in UI copy and pitch text (organise, analyse, colour).

## Pitch (last 30 minutes)

When I say "pitch", draft a 3 minute pitch and a 4 slide outline:
1. The customer and their pain (a specific IR manager at a specific type of company).
2. What we built and why it fits the InvestorHub flywheel.
3. Live demo path, step by step, with what to say at each click.
4. Commercial value: which metric it moves, who pays, how it could plug into InvestorHub (for example feeding Ivy or the investor list).

Also prepare answers to likely judge questions: "How does this handle continuous disclosure?", "Who pays for it?", "What would you build next?", "Why does this matter for liquidity?"

## Definition of done

- The demo path runs end to end without errors on a fresh `npm run dev`.
- Mock data tells a clear, consistent story.
- Compliance guardrails are visible in the UI where relevant.
- Latest working version is committed.
- Pitch and demo script are written and rehearsed.
