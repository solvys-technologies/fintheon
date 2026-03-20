# Handoff Prompt — QuantConnect Strategy Specs
<!-- claude-code 2026-03-03 | All 14 questions resolved, Rithmic API research complete, all specs ready to code -->
<!-- claude-code 2026-02-28 | Updated — 10 of 14 questions resolved, 4 remaining -->

## Context for Next Session

TP completed a multi-session walkthrough with Claude Code documenting three trading models (40/40 Club, Flush, Ripper) plus supporting specs (Antilag signal detection, pre-staged news entry risk management) and frame-by-frame video analysis of two live trade clips. All docs are pushed to `solvys-technologies/pulse` under `docs/quantconnect/`.

These specs are written for **Harper** (CAO / OpenClaw agent) to implement on **QuantConnect** (Lean/C#).

**Build priority:** 40/40 Club first, then Flush and Ripper.
**Backtest start date:** Liberation Day (April 2, 2025) forward.

---

## What's Done

| File | Status |
|------|--------|
| `STRATEGY-40-40-CLUB.md` | **Updated** — all 14 questions resolved, Anchored VWAP spec + footprint chart roadmap added |
| `STRATEGY-FLUSH.md` | **Updated** — soft-bounded timing windows, resolved questions cross-referenced |
| `STRATEGY-RIPPER.md` | **Updated** — 120s blackout clarified, volatility spike risk governor added |
| `ANTILAG-SPEC.md` | Complete — composite signal with pseudocode |
| `PRE-STAGED-NEWS-ENTRY.md` | Complete — 120s blackout, severity mapping, Harper checklist |
| `VIDEO-ANALYSIS-NOTES.md` | Complete — Clip 1 (Antilag) + Clip 2 (Macro Flush) |

---

## Resolved Questions — All 14 Complete

### Batch 1 (from TP — 2026-02-28)

1. ~~Scale-in ATR threshold~~ → **≥55%** (flexed down from 60%)
2. ~~Overtaking candle stop~~ → **3–5 points below the candle's low**
3. ~~BE trigger~~ → **Structure-based:** price retests EMA after overtaking, then closes above contested price
4. ~~Trailing stop buffer~~ → **5–7 points**, chunky moves only (not granular). Stop moves after price clears quarter-price/cycle level AND retests past fib AND overtakes contested price
5. ~~Fib boundary~~ → Exact hits belong to the **zone below**
6. ~~Fib invalidation~~ → Discard on price disrespect or news-driven regime change. Old fib becomes TP target only
7. ~~PDPT behavior~~ → **Combine mode:** $1,550 hard cap. **Funded mode:** trailing, avg ~$1,500/day, range $1,300–$2,000
8. ~~Re-entries~~ → **Max 3 executions per setup** (same thesis). Re-entry needs structure intact + fresh Antilag
9. ~~Build priority~~ → 40/40 Club first, then Flush + Ripper
10. ~~Backtest period~~ → Liberation Day (April 2, 2025) forward

### Batch 2 (from TP — 2026-03-03)

11. ~~Flush timing windows~~ → **Soft-bounded scan gates.** Windows gate when Harper starts scanning, NOT when she can execute. If criteria check off after the window closes, the trade still executes. See STRATEGY-FLUSH.md § Window Behavior
12. ~~Anchored VWAP~~ → **Plain anchored VWAP** (no bands, no smoothing). Anchor exclusively from major fundamental catalysts: hot market-moving commentary, Mag 7 extreme-vol earnings, surprising/disappointing economic prints. **48-hour staleness rule** — discard after 48h. See STRATEGY-40-40-CLUB.md § Anchored VWAP Specification
13. ~~DOM heuristic for exits~~ → **Skipped.** TP's visual DOM reads can't be replicated without real-time order book data. **Future enhancement:** footprint charts from Rithmic tick stream (see Rithmic API Research below and STRATEGY-40-40-CLUB.md § Exit Enhancement)
14. ~~120-second blackout scope~~ → **Does NOT apply to reactive Ripper entries.** Reactive entries are surprise moves; blackout is for scheduled news only (Mode 2). Instead, a **volatility spike risk governor** triggers when 3-candle ATR (1000T) jumps to ≥30–40 pts — reduces contracts from 10 to 5 or fewer. See STRATEGY-RIPPER.md § Volatility Spike Risk Governor

---

## Rithmic API Research — Footprint Chart Feasibility

**Finding:** Rithmic does NOT provide pre-built footprint charts or volume profiles. However, raw tick-by-tick data IS available via the `TICKER_PLANT` WebSocket endpoint.

**What Harper can build from raw tick data:**
1. **Footprint charts** — classify each trade as buyer/seller-initiated via BBO comparison, aggregate delta per price level per bar
2. **Anchored volume profile** — aggregate volume at each price level, anchor to the same VWAP catalyst points

**Library:** `async_rithmic` (Python, MIT license, production-stable) wraps the Protocol Buffer API with async support for tick streaming, BBO, and market depth.

**Bandwidth caveat:** Rithmic standard plans cap at ~40GB/week. DOM/depth data is significantly heavier than price-only feeds.

**Priority:** Post-MVP. Ship 40/40 Club with price-action exits first, add footprint chart data as a V2 enhancement.

---

## How to Resume

```
Pull solvys-technologies/pulse, read docs/quantconnect/*.md.
All 14 questions are resolved — all three specs are ready to code.
Build priority: 40/40 Club first, then Flush + Ripper.
Backtest from Liberation Day (April 2, 2025) forward.
```
