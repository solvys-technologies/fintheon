# Pre-Staged News Entry — Risk Management Specification

<!-- claude-code 2026-02-28 | Confirmed by TP with all 4 recommendations approved -->

## Overview

Pre-staged news entries are limit orders placed at known Fib levels BEFORE a scheduled economic data release. The trade targets the **inevitable bounce** at resting-order clusters, capturing scalp profit before the wick fills back in.

---

## Position Sizing

- **Fixed 10 contracts** — NO scaling
- Rationale: News volatility makes scale-in timing impossible (too fast for human or algo to read scale-in setups)
- This is a hard rule, not discretionary

---

## Fib Anchor Selection

- **Manually selectable** from higher timeframes based on event severity
- The algo should expose a parameter for HTF fib source selection

| Event Severity | Fib Timeframe | Examples                              |
| -------------- | ------------- | ------------------------------------- |
| Standard       | 15-min / 1H   | Weekly claims, minor PMI              |
| Significant    | 1H / 4H       | PPI, retail sales, GDP revision       |
| Major          | 4H+           | CPI, FOMC, NFP, surprise geopolitical |

### Distance Expectation

- Price may be **75–100+ points away** from the HTF fib level at fill time
- This is normal — the trade targets the bounce at that level, not proximity

---

## Entry Mechanics

1. **Identify the Fib level** from the appropriate HTF chart
2. **Place limit buy/sell** at that level before the data release
3. **Wait for fill** — the news reaction drives price to the level
4. If no fill → no trade (the level wasn't reached)

---

## Stop Loss

- **Next cycle level below entry** (wider than standard models)
- Cycle levels: 25-pt increments (ATR ≤ 15) or 50-pt (ATR > 15)
- Example: Entry at 24,825, stop at 24,800 (one 25-pt cycle level below)

---

## 120-Second News Volatility Blackout

- After fill, **NO stop movement for 120 seconds**
- No trailing, no tightening, no adjustment of any kind
- Rationale: News volatility in first 2 minutes creates false signals — any stop movement risks premature exit

### After Blackout Expires

- **Immediately move stop to breakeven** — not gradual, immediate
- This is different from standard models where BE requires scale-in + DCA clearance
- From breakeven, normal trailing phases resume (Phase 3: 20 EMA − 7pts, Phase 4: 100 EMA trail)

---

## Trade Character

- **This is a SCALP**
- Capture the bounce profit, get out before the wick fills back in
- The wick often fills — the edge is speed of entry and exit
- TP1 (100 EMA) still takes precedence as primary target
- Do NOT hold for TP2/TP3 extensions on news entries

---

## Re-Entry After Stop-Out

### If stopped out of news entry:

- Re-enter at **next 25-pt handle that price sweeps to**
- These handles attract market participants — the sweep creates a new micro-setup
- Same 10 contracts, same risk management rules apply to re-entry

### If stopped out of a scaled-in position (standard Ripper, not pre-staged):

- Re-enter on **retest of the level**
- OR when **Antilag shows sync** AFTER stop-out but BEFORE EMA overtake (optional)

---

## Example: PPI Trade (from macro flush example.mov)

- **Date:** Trade day with PPI print at 8:30 AM ET
- **Setup:** Limit buy placed at ~24,826 (weak Fib from 4H chart) before PPI release
- **Fill:** +10 @ 24,824.06 on PPI reaction
- **Bracket:** Stop 24,809.50, Limit 24,918.50
- **Peak UPnL:** ~$1,041 at 24,878.25 (Frame 9, 36 seconds after fill)
- **120-second blackout:** No stop movement despite 30-pt pullback from peak
- **Outcome:** Trade held through volatility, eventually captured ~77 points

---

## Checklist for Harper Implementation

- [ ] Fixed 10 contracts (no addContractCount or scale-in logic)
- [ ] HTF fib source parameter (selectable: 15m, 1H, 4H)
- [ ] Limit order placement before scheduled event
- [ ] 120-second timer starts on fill (no stop movement during)
- [ ] Immediate BE after 120s expires
- [ ] Normal trailing phases from BE forward
- [ ] Re-entry logic: next 25-pt handle sweep
- [ ] PDPT check before and during trade
