# Autopilot Implementation — Phase 1
<!-- claude-code 2026-03-03 | Initial phase 1 doc + Rithmic test-trade endpoint implemented -->

## Scope

Phase 1 establishes the real-money execution path: connecting Pulse → ProjectX (TopstepX/Rithmic) → live market orders. The agent pipeline backend is already built (see AGENT-2-CLAUDE-CODE-TASKS.md Weeks 1–7). Phase 1 closes the final gap between AI proposals and order execution.

**Build order:** Rithmic test trade → QuantConnect 40/40 Club algo → Flush → Ripper

---

## Status

| Layer | File | Status |
|-------|------|--------|
| ProjectX client — `placeOrder()` | `backend-hono/src/services/projectx/client.ts` | **Done** |
| ProjectX client — `searchContracts()` | `backend-hono/src/services/projectx/client.ts` | **Done** |
| Trading service — `fireTestTrade()` | `backend-hono/src/services/trading-service.ts` | **Done** |
| Handler — `handleTestTrade()` | `backend-hono/src/routes/trading/handlers.ts` | **Done** |
| Route — `POST /api/trading/test-trade` | `backend-hono/src/routes/trading/index.ts` | **Done** |
| QuantConnect MCP server config | `~/.claude.json` | **Done** |
| QC algo — 40/40 Club (C#) | `quantconnect/FortyFortyClub.cs` | **Pending** |
| QC algo — Flush (C#) | `quantconnect/Flush.cs` | **Pending** |
| QC algo — Ripper (C#) | `quantconnect/Ripper.cs` | **Pending** |

---

## Test Trade Endpoint

**`POST /api/trading/test-trade`**

Fires a 1-contract market order via ProjectX. Uses the frontend `TestTradeButton` in Mission Control.

**Request:**
```json
{ "accountId": "465", "symbol": "/MNQ", "side": "buy" }
```

**Response:**
```json
{ "success": true, "orderId": 26974, "message": "Order #26974 placed — 1 MNQ BUY @ Market" }
```

**Flow:**
1. Look up ProjectX credentials for user
2. `POST /api/Contract/search` with `searchText: "MNQ"` to get active front-month contract ID
3. `POST /api/Order/place` — type: 2 (Market), size: 1, customTag: `PULSE-TEST-{timestamp}`
4. Return `orderId` + human-readable message

**Requires:** ProjectX credentials configured in Settings (username + API key).

---

## QuantConnect Algo — Phase 1

All 14 strategy questions resolved. Specs ready. See:
- `docs/quantconnect/STRATEGY-40-40-CLUB.md` — build first
- `docs/quantconnect/STRATEGY-FLUSH.md`
- `docs/quantconnect/STRATEGY-RIPPER.md`
- `docs/quantconnect/ANTILAG-SPEC.md`

**QuantConnect MCP:** Configured at `http://localhost:3001/` (requires Local Platform running).
**Backtest start:** April 2, 2025 (Liberation Day).
**Instrument:** MNQ (micro) — $2/pt, 10 contracts initial.

### 40/40 Club Entry Checklist
1. Price sweeps Fib level on 1000T chart
2. Sweep near 20 EMA or 100 EMA extreme
3. Antilag signal fires (tick velocity + volume + NQ/ES alignment)
4. RSI (period 20, 15-min) outside 45–55 neutral zone
5. Enter 10 MNQ @ Market; stop below sweep wick

### Key Parameters
| Param | Value |
|-------|-------|
| Initial contracts | 10 MNQ |
| Max contracts | 25 (20 after 12:30 ET) |
| Scale-in trigger | ≥55% ATR from 100 EMA |
| Stop buffer | 3–5 pts below sweep wick |
| Primary target | 100 EMA (always) |
| BE trigger | Price retests EMA after overtaking, closes above contested |
| PDPT (combine) | $1,550 hard cap |
| PDPT (funded) | $1,500 trailing avg ($1,300–$2,000 range) |
| Re-entries | Max 3 per setup (same thesis + fresh Antilag) |

---

## Next Steps

1. Start QuantConnect Local Platform (for MCP on port 3001)
2. Use QC MCP to create project and run 40/40 Club backtest
3. Verify test trade endpoint with real account (fire 1 MNQ from Mission Control)
4. Connect proposal execution flow: `proposal.approved` → `POST /autopilot/execute` → `POST /trading/test-trade`
