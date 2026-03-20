# Strategy Execution Profile: Ripper
<!-- claude-code 2026-03-03 | Resolved: 120s blackout does NOT apply to reactive mode, added volatility spike risk governor -->
<!-- claude-code 2026-02-28 | Full spec from TP walkthrough session -->

## Overview
Risk event / macro surprise play. A Flush **supercharged by a fundamental catalyst** (CPI, PPI, FOMC, NFP, earnings surprise, geopolitical shock). Same core logic as Flush but with wider parameters, faster execution, and a pre-staged news entry variant.

**Instrument:** /MNQ (execution), /ES (confirmation only)
**Timeframe:** 1000-tick (entry), 15-min / 1H / 4H (HTF context, Fib source)
**Platform:** TopstepX (TradingView-based), Rithmic data/execution

---

## Two Entry Modes

### Mode 1: Reactive (Standard Ripper)
- Same as Flush but during/after a macro catalyst event
- Entry on Antilag confirmation post-sweep
- Standard 10 contracts initial, scale-in logic applies
- Uses the timing of the catalyst rather than fixed session windows
- **120-second blackout does NOT apply** — reactive entries are surprise moves; the blackout is for scheduled news only (Mode 2)

### Mode 2: Pre-Staged News Entry
- Limit order placed at a known Fib level **BEFORE** the data release
- See PRE-STAGED-NEWS-ENTRY.md for full risk management spec

---

## Fibonacci Framework — HTF Anchor Selection

### Key Difference from Flush
- **Fib anchor is manually selectable** from higher timeframes based on event severity
- Event severity determines which timeframe to draw fibs from:

| Event Severity | Fib Timeframe | Examples |
|---------------|---------------|----------|
| Standard | 15-min / 1H | Weekly jobless claims, minor data |
| Significant | 1H / 4H | PPI, retail sales, GDP |
| Major | 4H+ | CPI, FOMC, NFP |

### Distance from Fib Level
- Price **may be 75–100+ points away** from the HTF fib level at entry time
- This is expected — the trade targets the **inevitable bounce at resting-order clusters**
- These bounces are inevitable: whether bearish-first-then-bullish or vice versa

### Trade Character
- **This is a SCALP** — capture the bounce profit, exit before the wick fills back in
- The wick often fills — the edge is being in and out before that happens

---

## Entry Logic (Reactive Mode)

Same as Flush with these modifications:
- **Catalyst must be identified** (Pulse/OpenClaw fundamental detection or manual)
- **Wider initial stop** (next cycle level below entry, not just below sweep wick)
- **No fixed timing windows** — catalyst timing dictates
- Trades may move too fast for standard scale-in — use judgment

---

## Scale-In Logic

- **Same trigger as 40/40 and Flush** (60% ATR from 100 EMA, overtaking candle)
- In practice, Ripper trades often move too fast for scale-in to execute cleanly
- When scale-in IS possible, identical rules apply

---

## Trailing Stop, Exit Logic

Same as 40/40 and Flush — see STRATEGY-40-40-CLUB.md for:
- 4-phase trailing stop
- TP1 (100 EMA) always takes precedence
- Cycle levels
- PDPT hard cap ($1,550)

---

## Re-Entry Rules (Post Stop-Out)

### After News Entry Stop-Out
- Re-enter at **next 25-pt handle** that price sweeps to
- This handle attracts market participants — the sweep there creates a new entry opportunity

### After Scaled-In Entry Stop-Out (Setup Still Intact)
Two options:
1. **Re-enter on retest** of the level
2. **Re-enter when Antilag shows sync** AFTER stop-out but BEFORE EMA overtake (optional)

---

## Volatility Spike Risk Governor (Reactive Mode)

When market volatility spikes unexpectedly during reactive Ripper entries, Harper must dial back exposure:

### Trigger
- **3-candle lookback ATR** (1000T chart) jumps to **≥30–40 points**
- This indicates a volatility regime change — normal position sizing is too aggressive

### Response
- **Reduce contract count** — scale initial position from 10 micros down to 5 or fewer
- **Reduce risk per trade** — tighten the dollar-risk allocation for this trade
- **Do NOT skip the trade** — the setup may still be valid, but size must reflect the volatility
- Governor automatically disengages when 3-candle ATR drops back below 30

### Rationale
The 120-second blackout protects against scheduled news chaos. This governor protects against UNscheduled chaos — surprise moves, flash crashes, geopolitical shocks. Different risk, different tool.

---

## Key Differences from Flush
1. **Fundamental catalyst required** (not just exhaustion)
2. **HTF fib anchor manually selectable** based on event severity
3. **Price can be 75-100+ pts from fib level** at entry
4. **Pre-staged news entry mode** available (see PRE-STAGED-NEWS-ENTRY.md)
5. **Scalp character** — in/out before wick fills
6. **Wider stops** (next cycle level, not just sweep wick)
7. **Re-entry rules** for post-stop-out scenarios
8. **120s blackout does NOT apply** to reactive mode — volatility spike risk governor applies instead

---

## Open Questions (TBD)
- Fib invalidation logic
- Anchored VWAP specification
- DOM heuristic for exits
- Pulse/OpenClaw catalyst severity classification rules
