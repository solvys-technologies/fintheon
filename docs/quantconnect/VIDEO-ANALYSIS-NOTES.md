# Video Analysis Notes — Trade Reconstruction

<!-- claude-code 2026-02-28 | Frame-by-frame analysis from TP walkthrough session -->

## Clip 1: Antilag example.mov (23 Frames)

### Trade Summary

- **Model:** 40/40 Club
- **Entry:** +15 @ 24,803 (market, Antilag confirmation at Fib sweep)
- **Bracket:** Stop 24,786.75 / Limit 24,826.75
- **Peak UPnL:** ~$1,041 (at 24,878 area, Frame 12)
- **Exit:** -15 Limit @ 24,826.75
- **GPnL:** $1,554.80
- **Outcome:** PDPT lockout ($1,550 cap hit)

### Key Frames

| Frame | Time (ET) | Price Area | Event                                                    |
| ----- | --------- | ---------- | -------------------------------------------------------- |
| 1     | ~8:43:00  | 24,800     | Chart context — 1000T NQ, 500T ES side-by-side           |
| 3     | ~8:43:10  | 24,803     | Entry +15 contracts visible in position panel            |
| 5     | ~8:43:20  | 24,808     | Price begins moving off entry, initial bounce forming    |
| 8     | ~8:43:30  | 24,812     | Steady upward movement, bracket visible                  |
| 12    | 8:43:39   | 24,818.25  | **ANTILAG SPIKE** — 10 pts in ~5 seconds, SIZE 24 on T&S |
| 14    | ~8:43:45  | 24,822     | Momentum continuing post-Antilag, approaching TP1        |
| 17    | ~8:43:55  | 24,826     | Limit fill triggered, position closing                   |
| 20    | ~8:44:10  | 24,826.75  | Exit confirmed — GPnL $1,554.80                          |
| 23    | ~8:44:30  | --         | PDPT lockout — no more trades                            |

### Antilag Signal Anatomy (Frame 12)

- **NQ 1000T candles:** Completing in rapid succession (~3-5 seconds each)
- **ES 500T candles:** Confirming same direction (bullish)
- **Tick velocity:** ≥2× faster than preceding candles
- **Volume:** SIZE 24 visible on Time & Sales (large institutional order)
- **Context:** At 20 EMA after pullback — contrarian exhaustion signal
- **Result:** 15-pt move to 100 EMA in next ~45 seconds

### Observations

- Trade executed cleanly within the 40/40 Club framework
- Antilag fired at the 20 EMA extreme — contrarian read confirmed
- GPnL exceeded PDPT by ~$5 (rounding on fill) — lockout triggered
- Scale-in was NOT needed — the initial 15 contracts captured the full move to TP1

---

## Clip 2: Macro flush example.mov (64 Frames, 24 Analyzed)

### Trade Summary

- **Model:** Ripper (Pre-Staged News Entry)
- **Catalyst:** PPI print at 8:30 AM ET
- **Entry:** +10 @ 24,824.06 (limit fill on PPI reaction)
- **Bracket:** Stop 24,809.50 / Limit 24,918.50
- **Peak UPnL:** ~$1,041 at 24,878.25 (Frame 9, 36 seconds after fill)
- **120-Second Blackout:** Active — no stop movement despite 30-pt pullback from peak
- **Outcome:** Held through volatility, captured ~77 points

### Key Frames

| Frame | Time (ET) | Price Area | Event                                                      |
| ----- | --------- | ---------- | ---------------------------------------------------------- |
| 1     | ~8:29:30  | 24,826     | Pre-PPI — limit order resting at weak Fib from 4H chart    |
| 3     | 8:30:00   | 24,824     | **PPI PRINTS** — immediate volatility spike                |
| 5     | ~8:30:06  | 24,824.06  | Limit fill confirmed: +10 @ 24,824.06                      |
| 7     | ~8:30:15  | 24,850     | Rapid upward move, 25+ pts from entry                      |
| 9     | ~8:30:36  | 24,878.25  | **PEAK UPnL ~$1,041** — 54 pts from entry                  |
| 11    | ~8:30:50  | 24,855     | Pullback begins — 23 pts off peak                          |
| 13    | ~8:31:10  | 24,848     | Pullback deepens — 30 pts off peak. **Blackout holds.**    |
| 15    | ~8:31:30  | 24,852     | Price stabilizing, still in blackout period                |
| 18    | ~8:32:06  | 24,860     | **120s BLACKOUT EXPIRES** — stop moves to breakeven        |
| 20    | ~8:32:30  | 24,870     | Price recovering, normal trailing phases resume            |
| 22    | ~8:33:00  | 24,890     | Continued upward movement toward limit                     |
| 24    | ~8:33:30  | 24,901     | Last analyzed frame — trade still active, ~77 pts captured |

**Frames 25-64:** Per TP: "None of the other frames matter in that trade." Skipped.

### Pre-Staged News Entry Mechanics Demonstrated

1. **Fib selection:** Weak Fib from 4H chart (appropriate for PPI — "Significant" severity)
2. **Distance:** Price was near the Fib level at order time (unlike CPI/FOMC where it could be 75-100+ pts away)
3. **Fixed 10 contracts:** No scale-in attempted (correct per spec — news moves too fast)
4. **120-second blackout:** Stop held firm despite 30-pt adverse move from peak (Frame 13)
5. **Immediate BE after blackout:** At 8:32:06, stop moved to breakeven
6. **Scalp character:** Capture bounce profit, exit before wick fills

### HTF Context

- DeepSeek label visible on chart — irrelevant to this trade (higher timeframe context marker only)
- 4H Fib levels were the anchor for this PPI trade
- The "inevitable bounce at resting-order clusters" played out as expected

---

## Cross-Clip Observations

### What Both Clips Demonstrate

1. **TP1 (100 EMA) precedence** — both trades targeted the 100 EMA as primary exit
2. **PDPT awareness** — Clip 1 triggered lockout at $1,554.80 (~$5 over the $1,550 cap)
3. **Antilag validity** — Clip 1 shows textbook Antilag signal; Clip 2 shows why Antilag is unreliable during news (120s blackout period)
4. **Speed of execution** — both trades completed in under 4 minutes from entry to exit/analysis

### Key Differences

| Aspect          | Clip 1 (Antilag)         | Clip 2 (Macro Flush)         |
| --------------- | ------------------------ | ---------------------------- |
| Model           | 40/40 Club               | Ripper (Pre-Staged)          |
| Contracts       | 15                       | 10 (fixed, no scale-in)      |
| Entry type      | Market (Antilag confirm) | Limit (pre-placed)           |
| Stop management | Standard trailing        | 120s blackout → immediate BE |
| Fib source      | 1000T (exact levels)     | 4H (event severity)          |
| Scale-in        | Not needed (clean move)  | Not allowed (news entry)     |

### TP's "Overtaking Candle" Observation

From Clip 1: The engulfing candle crossing the 20 EMA represents the "overtaking candle at a contested price." This is the scale-in trigger point:

- Entry for additional contracts: **right below the bottom of the overtaking candle**
- Stop for scale-in: **loosely below the bottom of the overtaking candle**
- In this specific trade, scale-in wasn't needed, but the candle pattern demonstrated the concept

---

## Implementation Notes for Harper

These video reconstructions provide concrete examples for:

- Antilag signal detection thresholds (SIZE 24, 10pts/5s, 2× velocity)
- 120-second blackout timer behavior under real market conditions
- PDPT lockout mechanics (trigger at cap, no further trades)
- Pre-staged limit order fill behavior during news events
- The practical difference between 40/40 Club and Ripper execution
