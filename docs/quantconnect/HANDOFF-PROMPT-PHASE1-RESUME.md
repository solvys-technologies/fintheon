# Handoff Prompt — Phase 1 Resume (QuantConnect + Autopilot)
<!-- claude-code 2026-03-03 | Full rewrite — end-to-end Phase I + Phase II prep -->

## How to Use This File

Start a new Claude Code session and say:
> "Read `docs/quantconnect/HANDOFF-PROMPT-PHASE1-RESUME.md` and execute Phase I."

---

## Scope

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase I** | 40/40 Club QC algorithm + Autopilot execution loop wired end-to-end | **In progress** |
| **Phase II** | Flush + Ripper QC algorithms + footprint chart data + catalyst severity classification | Prepped, pending |

---

## What Is Already Done

| Work | Files | Status |
|------|-------|--------|
| `POST /api/trading/test-trade` endpoint | `backend-hono/src/routes/trading/handlers.ts`, `index.ts` | Done |
| `fireTestTrade()` — Rithmic primary, ProjectX fallback | `backend-hono/src/services/trading-service.ts` | Done |
| `placeOrder()` + `searchContracts()` | `backend-hono/src/services/projectx/client.ts` | Done |
| Rithmic Gateway Python sidecar | `rithmic-gateway/gateway.py`, `requirements.txt`, `.env.example` | Done |
| `rithmic-service.ts` — calls gateway HTTP API | `backend-hono/src/services/rithmic-service.ts` | Done |
| Autopilot pipeline — generate / acknowledge / execute routes | `backend-hono/src/routes/autopilot/`, `proposal-service.ts` | Done |
| QC MCP configured (Docker, cloud API) | `~/.claude.json`, `~/.cursor/mcp.json` | Done |
| All strategy specs resolved (40/40 Club, Flush, Ripper, Antilag) | `docs/quantconnect/STRATEGY-*.md`, `ANTILAG-SPEC.md` | Done |

---

## Phase I — Complete These Steps in Order

### Step 1 — Start Rithmic Gateway

```bash
cd rithmic-gateway
cp .env.example .env
# Fill in: RITHMIC_USER, RITHMIC_PASSWORD, RITHMIC_SYSTEM_NAME, RITHMIC_URI
pip install -r requirements.txt
uvicorn gateway:app --port 3002
```

Verify: `curl http://localhost:3002/status` → should return `{ "status": "connected" }`

### Step 2 — Verify QC MCP Connection

1. Ensure Docker Desktop is running
2. Open Claude Code in this repo
3. Type `/` → select `MCP status`
4. After ~10s: `qc-mcp: connected` ✓

If not connected → restart Claude Code with Docker Desktop running.

**MCP config:** `~/.claude.json` + `~/.cursor/mcp.json` both point to `quantconnect/mcp-server` Docker image.
**Auth:** userId `469596` + API token baked into env vars. No local LEAN image needed.

---

### Step 3 — Build 40/40 Club Algorithm on QuantConnect

Read `docs/quantconnect/STRATEGY-40-40-CLUB.md` and `docs/quantconnect/ANTILAG-SPEC.md` fully before writing any code.

#### 3a. Create the QC Project via MCP
```
Use qc-mcp tool: create_project name="FortyFortyClub" language="Python"
```

#### 3b. Algorithm Structure (Python)

```python
# FortyFortyClub — QuantConnect Algorithm
# Backtest: 2025-04-02 to present | Instrument: /MNQ
# Resolution: Tick (1000-tick consolidation for entry, 15-min for context)

class FortyFortyClub(QCAlgorithm):

    def initialize(self):
        self.set_start_date(2025, 4, 2)   # Liberation Day
        self.set_cash(50000)
        self.set_brokerage_model(BrokerageModel.INTERACTIVE_BROKERS_BROKERAGE)

        # Primary instrument
        self.mnq = self.add_future("MNQ", Resolution.TICK)
        self.mnq.set_filter(0, 90)

        # Confirmation instrument (no execution)
        self.es = self.add_future("ES", Resolution.TICK)
        self.es.set_filter(0, 90)

        # Indicators — 15-min context
        self.ema20_15m = self.ema(self.mnq.symbol, 20, Resolution.MINUTE)
        self.ema100_15m = self.ema(self.mnq.symbol, 100, Resolution.MINUTE)
        self.rsi_15m = self.rsi(self.mnq.symbol, 20, MovingAverageType.WILDERS, Resolution.MINUTE)

        # Tick consolidators — 1000T for NQ, 500T for ES
        self.nq_consolidator = TickConsolidator(1000)
        self.nq_consolidator.data_consolidated += self.on_nq_bar
        self.subscription_manager.add_consolidator(self.mnq.symbol, self.nq_consolidator)

        self.es_consolidator = TickConsolidator(500)
        self.es_consolidator.data_consolidated += self.on_es_bar
        self.subscription_manager.add_consolidator(self.es.symbol, self.es_consolidator)

        # State
        self.last_nq_bar_time = None
        self.last_es_bar_time = None
        self.nq_bar_duration = None
        self.es_bar_duration = None
        self.position_size = 0
        self.entry_price = None
        self.stop_price = None
        self.re_entry_count = 0
        self.daily_pnl = 0
        self.trading_mode = "combine"  # "combine" or "funded"
        self.pdpt_combine = 1550
        self.pdpt_funded_avg = 1500

    def on_nq_bar(self, sender, bar):
        if self.last_nq_bar_time:
            self.nq_bar_duration = (bar.end_time - self.last_nq_bar_time).total_seconds()
        self.last_nq_bar_time = bar.end_time
        self.check_entry_conditions()

    def on_es_bar(self, sender, bar):
        if self.last_es_bar_time:
            self.es_bar_duration = (bar.end_time - self.last_es_bar_time).total_seconds()
        self.last_es_bar_time = bar.end_time
```

#### 3c. Antilag Signal (implement as method)

```python
def antilag_fires(self, nq_bar, es_bar) -> bool:
    """
    Antilag = tick velocity spike at EMA extreme, both instruments aligned.
    See ANTILAG-SPEC.md for full spec.
    """
    if not all([self.nq_bar_duration, self.es_bar_duration]):
        return False

    prev_nq_duration = self.prev_nq_bar_duration  # track in on_nq_bar
    prev_es_duration = self.prev_es_bar_duration

    # 1. Tick velocity: current candle ≥2x faster than previous
    nq_fast = self.nq_bar_duration <= prev_nq_duration * 0.5
    es_fast = self.es_bar_duration <= prev_es_duration * 0.5

    # 2. Valid time range: 2–30 seconds
    nq_valid = 2 <= self.nq_bar_duration <= 30
    es_valid = 2 <= self.es_bar_duration <= 30

    # 3. Directional alignment
    nq_bull = nq_bar.close > nq_bar.open
    es_bull = es_bar.close > es_bar.open
    aligned = nq_bull == es_bull

    # 4. At EMA extreme (within ATR × 0.3 of 20 EMA or 100 EMA)
    price = nq_bar.close
    atr = self.compute_3bar_atr()  # 3-candle lookback, 1000T
    near_ema20 = abs(price - self.ema20_15m.current.value) <= atr * 0.3
    near_ema100 = abs(price - self.ema100_15m.current.value) <= atr * 0.3
    at_extreme = near_ema20 or near_ema100

    return nq_fast and es_fast and nq_valid and es_valid and aligned and at_extreme
```

#### 3d. Entry Conditions (40/40 Club specific)

```python
def check_entry_conditions(self):
    """
    40/40 Club entry: sweep at Fib level + near 20/100 EMA + Antilag + RSI outside 45-55
    """
    # Guard: PDPT hit
    if self.daily_pnl >= self.pdpt_combine:
        return
    # Guard: max re-entries
    if self.re_entry_count >= 3:
        return
    # Guard: already in position (max 25 contracts)
    if self.position_size >= 25:
        return
    # Guard: news blackout (120s after scheduled news)
    if self.in_news_blackout():
        return

    price = self.securities[self.mnq.symbol].price

    # RSI outside neutral zone
    if not (self.rsi_15m.current.value < 45 or self.rsi_15m.current.value > 55):
        return

    # Fib sweep detection (see note below)
    fib_level, direction = self.detect_fib_sweep(price)
    if fib_level is None:
        return

    # Antilag confirmation
    if not self.antilag_fires(self.last_nq_bar, self.last_es_bar):
        return

    # Enter
    self.enter_trade(direction, fib_level)
```

> **Fib sweep detection note:** QC does not have built-in Fib tools.
> Implement as: track recent swing highs/lows over 20-candle lookback, compute
> standard Fib levels (0.236, 0.382, 0.5, 0.618, 0.786), flag when price
> closes beyond a level then reverses (sweep candle pattern).

#### 3e. Position Management

```python
def enter_trade(self, direction, fib_level):
    size = 10  # initial: 10 MNQ
    if self.position_size == 0:
        self.market_order(self.mnq.symbol, size if direction == "long" else -size)
        self.position_size = size
        self.entry_price = self.securities[self.mnq.symbol].price
        self.stop_price = self.compute_initial_stop(direction)
        self.re_entry_count += 1 if self.re_entry_count > 0 else 0

def check_scale_in(self):
    """
    Scale-in: first 1000T candle ≥55% ATR from 100 EMA + overtaking candle.
    +5 micros per scale-in, max 25 (20 after 12:30 ET)
    """
    if self.position_size == 0:
        return
    max_contracts = 20 if self.time.hour >= 12 and self.time.minute >= 30 else 25
    if self.position_size >= max_contracts:
        return

    atr = self.compute_3bar_atr()
    ema100 = self.ema100_15m.current.value
    price = self.securities[self.mnq.symbol].price
    dist_from_ema = abs(price - ema100)

    if dist_from_ema >= atr * 0.55 and self.overtaking_candle_confirmed():
        add = min(5, max_contracts - self.position_size)
        direction = 1 if self.position_size > 0 else -1
        self.market_order(self.mnq.symbol, add * direction)
        self.position_size += add
        self.update_stop_to_breakeven()

def compute_initial_stop(self, direction) -> float:
    """Stop: 3–5 pts below sweep wick (long) / above sweep wick (short)"""
    sweep_wick = self.last_sweep_wick_price  # tracked in detect_fib_sweep
    buffer = 4.0  # 4 pts default, adjust for ATR
    return sweep_wick - buffer if direction == "long" else sweep_wick + buffer
```

#### 3f. PDPT / Exit Logic

```python
def on_end_of_day(self, symbol):
    self.daily_pnl = 0
    self.re_entry_count = 0

def check_pdpt(self):
    if self.trading_mode == "combine":
        if self.daily_pnl >= self.pdpt_combine:
            self.liquidate()
    # funded mode: managed via trailing stop, no hard lockout

def check_tp1(self):
    """TP1: 100 EMA — always takes precedence"""
    price = self.securities[self.mnq.symbol].price
    ema100 = self.ema100_15m.current.value
    if self.position_size > 0 and price >= ema100:
        self.liquidate()
    elif self.position_size < 0 and price <= ema100:
        self.liquidate()
```

#### 3g. Backtest Config

```
Start: 2025-04-02
End: today
Cash: $50,000
Benchmark: SPY
Resolution: Tick
Instrument: /MNQ (front month, auto-rolled)
```

Run via MCP: `run_backtest project_id=<FortyFortyClub> name="Phase1-Baseline"`

---

### Step 4 — Wire Autopilot Execution Loop

Full loop from AI proposal to live order:

```
POST /api/autopilot/generate
  → agent pipeline (pipeline.ts) runs analyst agents
  → LLM outputs trade proposal (symbol, side, size, confidence)
  → proposal created in DB (status: pending)

POST /api/autopilot/acknowledge { decision: "approved" }
  → proposal status → approved

POST /api/autopilot/execute
  → proposal-service.ts → executeProposal()
  → rithmic-service.ts → POST localhost:3002/order/place
  → Python gateway → Rithmic ORDER_PLANT → live fill
  → proposal status → executed
```

**Verify this loop works end-to-end:**
1. Fire `POST /api/autopilot/generate` with test market context
2. Approve via `POST /api/autopilot/acknowledge`
3. Execute via `POST /api/autopilot/execute`
4. Check ProjectX/Rithmic order history for the fill

---

### Step 5 — Autonomous Mode (Optional, Phase I Completion)

Add to `.env` and wire in `proposal-service.ts`:

```bash
AUTOPILOT_MODE=autonomous          # skip acknowledge step
AUTOPILOT_MIN_CONFIDENCE=75        # only auto-execute above this
AUTOPILOT_MAX_DAILY_TRADES=10
AUTOPILOT_DAILY_LOSS_LIMIT=1500
```

When `AUTOPILOT_MODE=autonomous`: after `generate`, if `proposal.confidence >= MIN_CONFIDENCE`, skip acknowledge and call `execute` directly.

---

## Phase II — Prep (Specs Ready, Build Pending)

### Flush Algorithm
- Spec: `docs/quantconnect/STRATEGY-FLUSH.md` — **fully resolved**
- Key differences from 40/40: HTF Fib source (15-min/1H), levels rounded to nearest 25, time-of-day scan gates (soft-bounded), exhaustion pattern prerequisite (3-wick cluster)
- Reuses: Antilag, scale-in, trailing stop, PDPT logic — all identical to 40/40
- QC project name: `Flush`

### Ripper Algorithm
- Spec: `docs/quantconnect/STRATEGY-RIPPER.md` — **mostly resolved, 4 open questions**
- Key differences from Flush: fundamental catalyst required, HTF fib timeframe selected by event severity, price can be 75–100+ pts from fib, pre-staged news entry mode, volatility spike governor (ATR ≥30 → reduce to ≤5 contracts)
- Spec: `docs/quantconnect/PRE-STAGED-NEWS-ENTRY.md` — pre-staged mode
- QC project name: `Ripper`

### Phase II Open Questions (must resolve before building)

**Ripper:**
1. Fib invalidation logic — same as 40/40 or different for macro events?
2. Anchored VWAP specification — catalyst-only anchors resolved? (same 48h rule?)
3. Pulse/OpenClaw catalyst severity classification rules — how does the algo receive `event_severity`?
4. DOM heuristic — confirmed skipped; footprint chart as V2 enhancement

**Antilag:**
1. Exact ATR multiplier for "near EMA extreme" — 0.3× confirmed or needs tuning from backtest?
2. Volume threshold for SIZE confirmation — raw tick count vs relative?
3. Minimum candle body size filter — doji filter implementation

**Resolution:** Resolve with TP before starting Phase II build. Update spec files once confirmed.

---

## Key File Map

```
pulse/
├── rithmic-gateway/
│   ├── gateway.py                  ← Python sidecar (FastAPI + async_rithmic)
│   ├── requirements.txt
│   └── .env.example
├── backend-hono/src/
│   ├── services/
│   │   ├── rithmic-service.ts      ← calls localhost:3002
│   │   ├── trading-service.ts      ← fireTestTrade(), broker routing
│   │   ├── projectx/client.ts      ← placeOrder(), searchContracts()
│   │   ├── agents/pipeline.ts      ← full agent pipeline
│   │   └── autopilot/
│   │       └── proposal-service.ts ← proposal lifecycle + executeProposal()
│   └── routes/
│       ├── trading/                ← POST /test-trade
│       └── autopilot/              ← /generate /acknowledge /execute
├── docs/quantconnect/
│   ├── STRATEGY-40-40-CLUB.md      ← Phase I build — ALL questions resolved
│   ├── STRATEGY-FLUSH.md           ← Phase II build — ALL questions resolved
│   ├── STRATEGY-RIPPER.md          ← Phase II build — 4 open questions remain
│   ├── ANTILAG-SPEC.md             ← shared across all models — 3 open questions
│   ├── PRE-STAGED-NEWS-ENTRY.md    ← Ripper Mode 2
│   ├── VIDEO-ANALYSIS-NOTES.md     ← Antilag + Macro Flush trade clips
│   ├── RITHMIC-GATEWAY.md          ← gateway architecture doc
│   └── AUTOPILOT-IMPLEMENTATION-PHASE-1.md ← status tracker
└── frontend/components/
    ├── mission-control/
    │   └── TestTradeButton.tsx      ← fires POST /api/trading/test-trade
    └── ProposalModal.tsx            ← approve/reject UI
```

---

## QC MCP Usage

The `qc-mcp` MCP server runs via `quantconnect/mcp-server` Docker image (cloud API — no local LEAN needed).
Credentials are baked into `~/.claude.json` and `~/.cursor/mcp.json` as env vars (userId `469596`).

To verify in Claude Code: type `/` → `MCP status` → should show `qc-mcp: connected`.

If not connected: ensure Docker Desktop is running, then restart Claude Code.

Key MCP tools to use:
- `create_project` — create FortyFortyClub, Flush, Ripper projects
- `create_file` / `update_file` — write algorithm code
- `create_compile` — check for syntax errors before backtest
- `create_backtest` — run backtest (returns backtest ID)
- `read_backtest` — poll for results (status, equity curve, trade log)
- `read_backtest_orders` — inspect individual fills

---

## Agents in This Ecosystem

- **Claude Code** (you) — Pulse backend, execution layer, QC algorithm builds
- **Harper** (OpenClaw/CAO) — may have parallel QC work; check `~/.openclaw/workspace/memory/` before modifying shared files
- **Sentinel, Oracle, Charles, Horace** — other pipeline agents

Check `~/.openclaw/workspace/memory/` before making changes that might conflict.

---

## Branch

Current branch: `v7.0.1`
