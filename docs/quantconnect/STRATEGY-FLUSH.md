# Strategy Execution Profile: Flush

<!-- claude-code 2026-03-03 | Resolved: timing windows are soft-bounded scan gates, updated open questions -->
<!-- claude-code 2026-02-28 | Full spec from TP walkthrough session -->

## Overview

Exhaustion reversal at session extremes. Price exhausts at the high/low of a multi-candle cluster, sweeps that level, and reverses. Flush is the **core framework** — all three models (40/40, Flush, Ripper) run the same underlying logic. Time-of-day differentiates which model applies.

**Instrument:** /MNQ (execution), /ES (confirmation only)
**Timeframe:** 1000-tick (entry), 15-min / 1H (HTF context, Fib source)
**Platform:** TopstepX (TradingView-based), Rithmic data/execution

---

## Timing Windows

| Window     | Time (ET)     | Notes                                               |
| ---------- | ------------- | --------------------------------------------------- |
| Morning    | 8:15 – 9:20   | Primary session. Includes pre-market news reactions |
| Blackout   | 9:20 – 9:35   | NO trades unless "undeniable" Antilag signal        |
| Lunch      | 12:00 – 12:45 | Lower volume, wider stops                           |
| Power Hour | 1:40 – 2:05   | End-of-day momentum                                 |

### Window Behavior — Soft-Bounded Scan Gates

- Windows gate **when Harper starts scanning for setups**, NOT when she can execute
- Harper begins looking for Flush setups at the window open time
- If all criteria check off **after** the window closes, the trade **still executes**
- The window is a scan trigger, not an execution cutoff

---

## Setup Identification

### Exhaustion Pattern

1. **3 consecutive fifteen-minute candles** with wicks at a similar level (top or bottom)
2. This creates a **liquidity cluster** — resting orders accumulate at that level
3. Price **leaves** and then **returns to sweep** that cluster
4. The sweep IS the flush — it's the liquidity grab that triggers the reversal

### Antilag Confirmation

- Antilag must fire during or immediately after the sweep (see ANTILAG-SPEC.md)
- Antilag as exhaustion signal: the velocity spike AT the extreme confirms the flush is complete

---

## Entry Logic

### Prerequisites

1. Exhaustion pattern identified (3-wick cluster)
2. Price sweeps the cluster level
3. Antilag fires at the extreme
4. Price is near a **Fibonacci retracement level** (15-min or 1H HTF fibs, **rounded to nearest 25**)
5. RSI (period 20, MA 20, 15-min) outside neutral zone (45-55)

### Entry Execution

- **Initial position:** 10 micro contracts (/MNQ)
- **Entry type:** Market order on Antilag confirmation at sweep
- **Stop:** Below sweep wick (long) / above sweep wick (short)
- **Target (TP1):** 100 EMA — **always takes precedence**

### Fibonacci Framework

- **Fib source:** 15-min or 1H chart (higher timeframe)
- **Nearest zone to current price**, rounded to nearest 25-pt handle
- Same zone classification as 40/40 (Ripper/Strong/Weak) — determines conviction, NOT eligibility
- Fib extensions (-0.756, -0.828, -0.844) are **valid entry points** for Flush in high-vol conditions

---

## Scale-In, Trailing Stop, Exit Logic

**Identical to 40/40 Club** — see STRATEGY-40-40-CLUB.md for:

- Scale-in trigger (60% ATR from 100 EMA, overtaking candle)
- Scale-in sizing (+5 micros, max 25/20 after 12:30)
- Break-even logic
- 4-phase trailing stop
- Cycle levels (25-pt / 50-pt based on ATR)
- TP1 (100 EMA), TP2/TP3 (extensions)
- PDPT hard cap ($1,550)

---

## Key Differences from 40/40 Club

1. **HTF Fib source** (15-min/1H vs 1000T)
2. **Fib levels rounded to nearest 25** (vs exact levels)
3. **Time-of-day gated** to specific windows
4. **Exhaustion pattern prerequisite** (3-wick cluster)
5. **Fib extensions as valid entry points** in high-vol (not just targets)

---

## Resolved

- **Fib invalidation** → see STRATEGY-40-40-CLUB.md § Fib Invalidation (same rules apply)
- **Anchored VWAP** → see STRATEGY-40-40-CLUB.md § Anchored VWAP Specification (catalyst-only, 48h staleness)
- **DOM heuristic** → skipped; footprint chart roadmap item (see STRATEGY-40-40-CLUB.md § Exit Enhancement)
