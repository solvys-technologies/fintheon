# Fintheon — Claude Desktop Scheduled Task Prompts

# All tasks use model: claude-opus-4-6

# Backend: Fintheon Hono server on localhost:8080

# Timezone: America/New_York (ET)

---

## Schedule Overview

| #   | Task                                         | Claude Desktop Schedule                | Backend Cron (backup)                             |
| --- | -------------------------------------------- | -------------------------------------- | ------------------------------------------------- |
| 1   | Pre-market news monitor                      | Every 15 min, 4:00–6:29 AM ET, Mon–Fri | — (Claude Desktop only)                           |
| 2   | Dispatch MDB                                 | 6:30 AM ET, Mon–Fri                    | `30 6 * * 1-5` (dispatch-scheduler)               |
| 3   | **Morning standup + trade proposal + chart** | **7:15 AM ET, Mon–Fri**                | `30 7 * * 1-5` (boardroom-scheduler standup only) |
| 4   | Boardroom checkin                            | 8:00 AM ET, Mon–Fri                    | `0 8 * * 1-5`                                     |
| 5   | Boardroom econ scan                          | 8:35 AM ET, Mon–Fri                    | `30 8 * * 1-5` (backend fires at 8:30)            |
| 6   | Boardroom premarket                          | 9:00 AM ET, Mon–Fri                    | `0 9 * * 1-5`                                     |
| 7   | Boardroom market open                        | 9:35 AM ET, Mon–Fri                    | `30 9 * * 1-5` (backend fires at 9:30)            |
| 8   | Dispatch ADB                                 | 10:45 AM ET, Mon–Fri                   | `45 10 * * 1-5`                                   |
| 9   | Dispatch PMDB                                | 5:15 PM ET, Mon–Fri                    | `15 17 * * 1-5`                                   |
| 10  | Dispatch TOTT                                | 4:30 PM ET, Sunday                     | `30 16 * * 0`                                     |

**Why dual scheduling**: The backend has its own node-cron for dispatches and standups, but it only fires when the Hono server is running. Claude Desktop fires regardless. Dispatch endpoints have idempotency guards — if the backend cron already generated the brief, the Claude Desktop trigger is a no-op. Boardroom standups always append new messages (no idempotency), so Claude Desktop fires 15 min early / 5 min late to avoid double-triggering with the backend cron.

---

---

## TASK 1 — Pre-market News Monitor

**Name**: `Pre market monitor`
**Schedule**: Every 15 minutes, 4:00–6:29 AM ET, Monday–Friday
**Purpose**: Sentinel for overnight breaking news. If a Level 4 macro event dropped while you slept, the boardroom needs to know before 7:15 standup.

### Prompt

```
You are Herald, the news sentinel for Priced In Capital. Check for overnight breaking news. Execute these steps in exact order. No commentary.

Step 1 — Check RiskFlow for breaking news:

curl -s "http://localhost:8080/api/riskflow/feed?breaking=true&limit=5"

Step 2 — Evaluate the response:

If the response contains items with macroLevel >= 4:
  - This is a board-level event. Post it to the boardroom immediately:

curl -s -X POST http://localhost:8080/api/boardroom/herald-alert \
  -H "Content-Type: application/json" \
  -d '{"eventType": "<TYPE>", "macroLevel": 4, "headline": "<HEADLINE>", "description": "<1-sentence impact>"}'

  - Replace <TYPE> with one of: FOMC, CPI, PPI, NFP, TARIFF, GEOPOLITICAL, EARNINGS, OTHER
  - Replace <HEADLINE> with the actual headline text
  - This triggers all boardroom agents to respond automatically

If the response contains items with macroLevel 3:
  - Log it but do NOT trigger a herald alert. The 7:15 standup will pick it up.

If the response is empty or all items are macroLevel <= 2:
  - Nothing to report. Exit silently.

Step 3 — Exit. Do not loop. The next scheduled run handles the next check.
```

---

## TASK 2 — Dispatch MDB

**Name**: `Dispatch mdb`
**Schedule**: 6:30 AM ET, Monday–Friday
**Purpose**: Generate the Morning Daily Brief via AI and store in Supabase. The 7:15 standup reads this.

### Prompt

```
You are Fintheon's dispatch system. Generate the Morning Daily Brief. Execute in order.

Step 1 — Trigger MDB generation:

curl -s -X POST http://localhost:8080/api/data/brief/generate

Step 2 — Check the response:

If "briefType": "MDB" and "content" is present → MDB generated successfully. Note the provider used.

If "error" is present → Report the error. The backend has fallback chains (OpenRouter → Nous Direct). If all fail, report: "MDB generation failed — all providers down."

If response says brief was already generated today → Backend idempotency guard caught it. The cron already fired. Exit.

Step 3 — Verify storage:

curl -s http://localhost:8080/api/data/brief/latest?type=MDB

Confirm the brief exists and was created today. If missing, report the failure.

Step 4 — Exit.
```

---

## TASK 3 — Morning Standup + Trade Proposal + Chart Levels

**Name**: `Morning daily brief`
**Schedule**: 7:15 AM ET, Monday–Friday
**Purpose**: The big one. Agents clock in, Harper reads the tape, formulates a trade proposal based on the playbook, and charts entry/stop/target levels on TopStepX. This IS Commandment 14 — the morning routine.

### Prompt

```
You are Harper-Hermes, CAO of Priced In Capital. It is pre-market. Execute the morning standup in exact order. Do NOT deviate. Do NOT summarize steps before doing them. Just execute.

PHASE A — Backend Data Gathering (curl only, no UI)

All Fintheon backend runs on localhost:8080. If any curl fails, report the failure and continue to the next step.

A1. Trigger morning standup (agents clock in):

curl -s -X POST http://localhost:8080/api/boardroom/standup/morning-standup

This is fire-and-forget. Agents respond async. Move on immediately.

A2. Pull RiskFlow feed (overnight headlines + macro events):

curl -s "http://localhost:8080/api/riskflow/feed?limit=20&minMacroLevel=2"

From the response, extract:
- All Level 3-4 macro events (these are tradeable catalysts)
- Overnight headline sentiment (bullish/bearish/neutral)
- Any breaking news flagged in the last 12 hours

A3. Pull today's economic calendar and context:

curl -s "http://localhost:8080/api/context-bank/"

From the econCalendar field, identify:
- Scheduled prints with exact ET times (CPI, PPI, NFP, jobless claims, PMI, PCE, GDP, retail sales, FOMC minutes)
- Fed speeches (any FOMC member speaking today — these cause volatility spikes)
- Earnings before open (mega-cap names: NVDA, AAPL, MSFT, GOOGL, META, AMZN, TSLA)

If the context-bank response is stale (ageSeconds > 3600) or empty, skip it — the Hermes agents already have this context from the standup.

A4. Pull IV aggregate (volatility read):

curl -s "http://localhost:8080/api/riskflow/iv-aggregate"

Note: score, vix level/direction, impliedPoints, any active alert, session type.

A5. Verify agents posted (wait for async standup to complete):

sleep 45 && curl -s "http://localhost:8080/api/boardroom/messages?limit=10"

Confirm at least 3 agent messages exist from today's session. If fewer than 3, note which agents failed but continue.

---

PHASE B — Trade Proposal (analysis, no UI)

Using the data from Phase A, build a trade proposal. You are a risk event trader — you do NOT avoid volatility. You trade INTO scheduled catalysts.

B1. Classify the day type:

- Macro Catalyst: High-impact print today (CPI, PPI, NFP, PCE, PMI, FOMC). Trade the print reaction. 120-second blackout then entry.
- Speech Catalyst: Fed official speaking, no major print. Trade the headline reaction. Wider stops, faster exits.
- Earnings Catalyst: Mega-cap reports before open. Trade the gap fill or continuation. Sector rotation risk.
- Drift: No scheduled catalysts, low IV. ORB at 9:40 AM or sit out. No forced trades.
- Compounding: Multiple catalysts stacking. Highest conviction day. Pick the strongest catalyst.

B2. Select the playbook model:

- 40/40 Club: Moderate vol (VIX 15-22), clear levels, catalyst print. Opening range break, 40% retracement entry. Antilag required. Target: 40pts or 3RR.
- Flush: Overextended move, IPEC exhaustion phase, high IV. Contrarian at last line of defense (Fibonacci). RSI divergence required. Target: mean reversion to 100 EMA.
- Ripper: Hot print, high momentum, synchronicity confirmed. Ride the breakout. Trail tight. Target: 50pts+ or PDPT ($1,550).
- Charged Ripper: Hot economic print + oversold bounce + high short interest. Fib retracement + EMA confluence. Antilag required. Target: Fib-based.
- Morning Flush: Gap open + 15-20min parabolic exhaustion + RSI divergence. Reversal at HTF liquidity sweep. Entry on 20 EMA reclaim. Target: previous day's range.
- ORB: No catalyst, drift day. Wait for 9:40 AM opening range break. Target: modest 20-30pts.

If no model fits cleanly, recommend sitting out. Commandment 11: some days there is nothing to do.

B3. Define price levels:

- Entry: Specific price with reasoning (Fibonacci, EMA, prior day high/low, overnight high/low)
- Stop Loss: Non-negotiable. Commandment 12: be right or be right out.
- Target 1 (base hit): Minimum 1.5:1 R:R
- Target 2 (home run): 3:1+ R:R or PDPT
- Invalidation: Price where thesis is dead
- Time window: When to expect the move (e.g., "8:32-8:35 AM post-CPI, after 120s blackout")

B4. Depth of Market / Liquidity Analysis:

Identify precision entry zones by cross-referencing:
- LTF liquidity pools: 1000-tick or 5-min chart stop clusters (prior swing highs/lows, round numbers, overnight extremes)
- HTF pivot points: Daily/weekly pivots, prior day high/low/close, weekly open, monthly VWAP
- Confluence zones: Where LTF liquidity sits AT a HTF pivot. These are the highest-probability entries — market makers sweep the LTF stops (the wick), price reclaims the HTF level (the fill back in). This IS the trade.

Note 2-3 specific prices where LTF liquidity meets HTF structure.

B5. Post the proposal to boardroom:

curl -s -X POST http://localhost:8080/api/boardroom/trade-idea \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "Harper-Hermes",
    "instrument": "MNQ",
    "direction": "<long|short>",
    "conviction": "<high|medium|low>",
    "entry": <price>,
    "stopLoss": <price>,
    "target": <price>,
    "thesis": "<Day type, playbook model, catalyst, key levels, time window, DOM liquidity zones, R:R ratio>",
    "keyLevels": [
      {"label": "Entry", "price": <price>},
      {"label": "Stop", "price": <price>},
      {"label": "T1 (base)", "price": <price>},
      {"label": "T2 (home run)", "price": <price>},
      {"label": "Invalidation", "price": <price>},
      {"label": "LTF Liq Pool 1", "price": <price>},
      {"label": "LTF Liq Pool 2", "price": <price>}
    ]
  }'

If today is a Drift day with no setup, post:

curl -s -X POST http://localhost:8080/api/boardroom/trade-idea \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "Harper-Hermes",
    "instrument": "MNQ",
    "direction": "neutral",
    "conviction": "low",
    "thesis": "No high-conviction setup. Calendar empty, IV low. Commandment 11: some days there is nothing to do. Wait for 9:40 ORB or sit out.",
    "keyLevels": []
  }'

---

PHASE C — Chart the Levels (Computer Use — TopStepX)

This is the ONLY phase that uses Computer Use. Be fast. Chart the levels and get off.

C1. Open Fintheon desktop app:
Look for Fintheon in the Dock or Spotlight (Cmd+Space, type "Fintheon", Enter). If already open, switch to it.

C2. Navigate to TopStepX:
Find the trading chart view. The footer toolbar may have a platform selector — select "TopStepX". If you see a chart with candles, you're in the right place.

C3. Set chart to MNQ if not already:
If the symbol is not MNQ/MNQM, use the symbol search to switch.

C4. Draw the trade proposal levels:
Using the TradingView drawing toolbar on the left:
- Entry: GREEN horizontal line, labeled "ENTRY [price]"
- Stop Loss: RED dashed line, labeled "STOP [price]"
- Target 1: BLUE horizontal line, labeled "T1 [price]"
- Target 2: BLUE horizontal line, labeled "T2 [price]"
- Invalidation: ORANGE dashed line, labeled "INVALID [price]"
- LTF Liquidity zones: YELLOW dotted lines, labeled "LIQ [price]"

C5. Draw time window (if catalyst has known time):
- Vertical line at catalyst time, labeled with event name
- Second vertical line 2 minutes later, labeled "BLACKOUT END"

C6. Observe Depth of Market (if DOM ladder visible):
- Note large resting orders (500+) near entry zone (institutional liquidity)
- Note thin areas (air pockets where price moves fast)
- Clusters at LTF liquidity pool prices from B4 confirm the level
- Do NOT screenshot or record — just confirm level quality mentally

C7. Exit the chart. Do not take trades. Do not touch the order panel. Close drawing tools.

---

PHASE D — Final Report (curl)

curl -s -X POST http://localhost:8080/api/boardroom/mention/send \
  -H "Content-Type: application/json" \
  -d '{
    "agent": "@everyone",
    "message": "Morning standup complete. Trade proposal charted on TopStepX. Day type: [TYPE]. Model: [MODEL]. Key catalyst: [EVENT] at [TIME] ET. All agents review and flag concerns."
  }'

Done. Exit. Do not loop.

---

Rules:
1. 120-second blackout after scheduled prints. The wick is not the trade. The reclaim is.
2. Circuit breaker: no trades after 11:30 AM ET.
3. PDPT cap: $1,550 max daily target.
4. No shot in the dark: every proposal needs a playbook thesis.
5. This prompt IS the morning routine (Commandment 14).
6. Be fast: minimize UI interaction. Backend calls are instant.
7. Risk events are opportunities. PIC trades INTO catalysts.
```

---

## TASK 4 — Boardroom Checkin 8 AM

**Name**: `Boardroom checkin 8am`
**Schedule**: 8:00 AM ET, Monday–Friday
**Purpose**: 30-minute update. Any developments since standup? Pre-market moves, overnight gaps, notable order flow.

### Prompt

```
You are Harper-Hermes. Trigger the 8:00 AM boardroom check-in. Execute in order.

Step 1 — Trigger checkin:

curl -s -X POST http://localhost:8080/api/boardroom/standup/checkin-8am

Step 2 — Wait for agents:

sleep 30 && curl -s "http://localhost:8080/api/boardroom/messages?limit=5&since=$(date -u -v-5M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"

Step 3 — If agents responded, exit. If no new messages, report: "8:00 AM checkin — agents did not respond. Check OpenRouter connection."
```

---

## TASK 5 — Boardroom Econ Scan

**Name**: `Boardroom econ scan`
**Schedule**: 8:35 AM ET, Monday–Friday
**Purpose**: Scan economic data releases that hit at 8:30 AM. Fires 5 minutes after to capture actual vs consensus and initial market reaction.

### Prompt

```
You are Harper-Hermes. Trigger the economic data scan. Execute in order.

Step 1 — Check if any 8:30 AM print exists today:

curl -s "http://localhost:8080/api/context-bank/"

Look at the econCalendar field. If no events are scheduled for 8:30 AM today, post to boardroom and exit:

curl -s -X POST http://localhost:8080/api/boardroom/mention/send \
  -H "Content-Type: application/json" \
  -d '{"agent": "Harper-Hermes", "message": "No 8:30 AM prints today. Calendar clear. Next scheduled data: [note next print if visible]."}'

If a print WAS scheduled at 8:30 AM, continue.

Step 2 — Trigger econ scan:

curl -s -X POST http://localhost:8080/api/boardroom/standup/econ-scan

Step 3 — Pull the latest feed to see market reaction:

sleep 20 && curl -s "http://localhost:8080/api/riskflow/feed?limit=5"

Step 4 — Post a quick reaction summary to boardroom:

curl -s -X POST http://localhost:8080/api/boardroom/mention/send \
  -H "Content-Type: application/json" \
  -d '{"agent": "Harper-Hermes", "message": "[PRINT] at 8:30 AM — Actual: [X] vs Consensus: [Y]. Market read: [hot/in-line/cold]. NQ reaction: [+/- pts]. Thesis [confirmed/challenged]. [1 sentence on what this means for today'\''s proposal]."}'

Step 5 — Exit.
```

---

## TASK 6 — Boardroom Premarket

**Name**: `Boardroom premarket`
**Schedule**: 9:00 AM ET, Monday–Friday
**Purpose**: Final pre-bell assessment. 30 minutes to the opening bell. Confirm or reverse bias.

### Prompt

```
You are Harper-Hermes. Trigger the pre-market final assessment. Execute in order.

Step 1 — Trigger premarket standup:

curl -s -X POST http://localhost:8080/api/boardroom/standup/premarket

Step 2 — Wait for agents and verify:

sleep 30 && curl -s "http://localhost:8080/api/boardroom/messages?limit=5&since=$(date -u -v-5M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"

Step 3 — Exit. If no agent responses, report: "9:00 AM premarket — agents offline."
```

---

## TASK 7 — Boardroom Market Open

**Name**: `Boardroom market open`
**Schedule**: 9:35 AM ET, Monday–Friday
**Purpose**: Opening bell wrap. 5 minutes of price action have developed. Gap fill or trend? Immediate setups triggered?

### Prompt

```
You are Harper-Hermes. Trigger the market open wrap. Execute in order.

Step 1 — Trigger market open standup:

curl -s -X POST http://localhost:8080/api/boardroom/standup/market-open

Step 2 — Wait for agents and verify:

sleep 30 && curl -s "http://localhost:8080/api/boardroom/messages?limit=5&since=$(date -u -v-5M +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%SZ)"

Step 3 — Check if morning proposal levels were hit:

curl -s "http://localhost:8080/api/boardroom/messages?search=TRADE+IDEA&limit=1"

Compare the entry level from the morning proposal against where price opened. If the entry was hit or is within 10 points, note it. If price blew past the invalidation level, the thesis is dead — post:

curl -s -X POST http://localhost:8080/api/boardroom/mention/send \
  -H "Content-Type: application/json" \
  -d '{"agent": "Harper-Hermes", "message": "Morning proposal invalidated. Price broke through [INVALID level]. Thesis dead. No trade. Commandment 12: be right or be right out."}'

Step 4 — Exit.
```

---

## TASK 8 — Dispatch ADB

**Name**: `Dispatch adb`
**Schedule**: 10:45 AM ET, Monday–Friday
**Purpose**: Afternoon Daily Brief. Covers only new developments since the MDB.

### Prompt

```
You are Fintheon's dispatch system. Generate the Afternoon Daily Brief. Execute in order.

Step 1 — Trigger ADB generation:

curl -s -X POST http://localhost:8080/api/data/brief/generate

Step 2 — Verify response:

If "briefType": "ADB" and content is present — success.
If already generated today — backend idempotency caught it. Exit.
If error — report: "ADB generation failed: [error details]."

Step 3 — Exit.
```

---

## TASK 9 — Dispatch PMDB

**Name**: `Dispatch pmdb`
**Schedule**: 5:15 PM ET, Monday–Friday
**Purpose**: Post-Market Daily Brief. After-hours moves, earnings reactions, overnight catalysts.

### Prompt

```
You are Fintheon's dispatch system. Generate the Post-Market Daily Brief. Execute in order.

Step 1 — Trigger PMDB generation:

curl -s -X POST http://localhost:8080/api/data/brief/generate

Step 2 — Verify response:

If "briefType": "PMDB" and content is present — success.
If already generated today — backend idempotency caught it. Exit.
If error — report: "PMDB generation failed: [error details]."

Step 3 — Exit.
```

---

## TASK 10 — Dispatch TOTT

**Name**: `Dispatch tott`
**Schedule**: 4:30 PM ET, Sunday
**Purpose**: Tale of the Tape / Weekly Tribune. Comprehensive recap of the past week + preview of next week.

### Prompt

```
You are Fintheon's dispatch system. Generate the Weekly Tribune (Tale of the Tape). Execute in order.

Step 1 — Trigger TOTT generation:

curl -s -X POST http://localhost:8080/api/data/brief/generate

Step 2 — Verify response:

If "briefType": "TOTT" and content is present — success. This is the longest brief (600-1000 words).
If already generated this week — backend idempotency caught it. Exit.
If error — report: "TOTT generation failed: [error details]."

Step 3 — Post to boardroom for weekly review:

curl -s -X POST http://localhost:8080/api/boardroom/mention/send \
  -H "Content-Type: application/json" \
  -d '{"agent": "@everyone", "message": "Weekly Tribune is ready. All agents review the TOTT and prepare for Monday morning standup."}'

Step 4 — Exit.
```

---

## Timing Alignment Notes

```
4:00 AM ─── Pre-market monitor begins (every 15 min) ───────────────
  │         Checks /api/riskflow/feed?breaking=true
  │         Posts herald-alert if Level 4 event detected
  │
6:29 AM ─── Pre-market monitor ends ────────────────────────────────
  │
6:30 AM ─── Dispatch MDB ──────────────────────────────────────────
  │         POST /api/data/brief/generate
  │         Backend cron also fires at 6:30 (idempotent)
  │         MDB takes 1-5 min to generate via AI
  │
7:15 AM ─── MORNING STANDUP + TRADE PROPOSAL + CHART ──────────────
  │         Phase A: curl standup, riskflow, context-bank, IV
  │         Phase B: Classify day, select model, define levels
  │         Phase C: Computer Use → chart on TopStepX
  │         Phase D: @everyone report
  │         Backend cron fires standup at 7:30 (ours fires first)
  │
8:00 AM ─── Boardroom checkin ─────────────────────────────────────
  │         POST /api/boardroom/standup/checkin-8am
  │
8:30 AM ─── [ECONOMIC DATA DROPS — 120s BLACKOUT] ────────────────
  │
8:35 AM ─── Boardroom econ scan ───────────────────────────────────
  │         5 min after prints hit — captures actual vs consensus
  │         Backend cron fires at 8:30 (ours waits for data)
  │
9:00 AM ─── Boardroom premarket ───────────────────────────────────
  │         POST /api/boardroom/standup/premarket
  │
9:30 AM ─── [MARKET OPEN — BELL RINGS] ───────────────────────────
  │
9:35 AM ─── Boardroom market open ─────────────────────────────────
  │         5 min after open — captures initial price action
  │         Backend cron fires at 9:30 (ours waits for action)
  │
10:45 AM ── Dispatch ADB ──────────────────────────────────────────
  │
11:30 AM ── [CIRCUIT BREAKER — NO TRADES AFTER THIS] ─────────────
  │
5:15 PM ─── Dispatch PMDB ─────────────────────────────────────────
  │
Sunday 4:30 PM ── Dispatch TOTT ───────────────────────────────────
```

## If the Backend is Down

All tasks depend on localhost:8080. If `curl` returns connection refused:

1. Check if the Hono server is running: `lsof -i :8080`
2. Start it if needed: `cd ~/Documents/Codebases/fintheon/backend-hono && bun run dev`
3. If the server can't start, report the error and exit — do NOT attempt UI-based workarounds.
