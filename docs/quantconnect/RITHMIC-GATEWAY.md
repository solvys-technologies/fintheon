# Rithmic Gateway — OpenClaw Handoff
<!-- claude-code 2026-03-03 | Full architecture + autonomous mode guide for Harper/OpenClaw -->

## What This Is

A Python microservice (`rithmic-gateway/gateway.py`) that bridges Pulse ↔ Rithmic's execution network. It wraps `async_rithmic` (Python, MIT, production-stable) and exposes a tiny HTTP API that the Hono backend calls for all order execution.

**Port:** `localhost:3002`
**Library:** [async_rithmic](https://github.com/rundef/async_rithmic) — Protocol Buffer WebSocket client for Rithmic's four "plants"
**Plant used:** `ORDER_PLANT` (order submission, fills, cancels)

---

## Quick Start

```bash
cd rithmic-gateway
pip install -r requirements.txt

# Copy and fill in credentials
cp .env.example .env
# Set RITHMIC_USER, RITHMIC_PASSWORD, RITHMIC_SYSTEM_NAME, RITHMIC_URI

# Start the gateway
uvicorn gateway:app --host 0.0.0.0 --port 3002
```

**Verify connection:**
```bash
curl http://localhost:3002/status
# {"connected": true, "system_name": "Rithmic Paper Trading", ...}
```

---

## Credentials Reference

| Env Var | Example | Notes |
|---------|---------|-------|
| `RITHMIC_USER` | `pic_trader` | Rithmic username |
| `RITHMIC_PASSWORD` | `...` | Rithmic password |
| `RITHMIC_SYSTEM_NAME` | `Rithmic Paper Trading` | Or `TopstepX` for live |
| `RITHMIC_URI` | `wss://rituz00100.rithmic.com:443/...` | From Rithmic onboarding |
| `GATEWAY_PORT` | `3002` | Optional, default 3002 |

The Hono backend reads `RITHMIC_GATEWAY_URL` (default: `http://localhost:3002`).

---

## HTTP API

### `GET /status`
Returns connection state. Call before placing orders.
```json
{
  "connected": true,
  "system_name": "Rithmic Paper Trading",
  "user": "pic_trader",
  "message": "Connected to Rithmic ORDER_PLANT"
}
```

### `POST /order/place`
Place a market or limit order.
```json
{
  "symbol": "MNQ",
  "exchange": "CME",
  "side": "buy",
  "quantity": 1,
  "order_type": "market",
  "tag": "PULSE-AUTO-1709500000"
}
```
Response:
```json
{
  "success": true,
  "order_id": "ORD-98765",
  "message": "Order accepted — 1 MNQ BUY @ Market",
  "ts": 1709500000.123
}
```

### `POST /reconnect`
Force a reconnect if the gateway loses its Rithmic connection.

---

## Execution Flow — Full Stack

```
Frontend (TestTradeButton or ProposalModal)
    │
    ▼ POST /api/trading/test-trade  OR  POST /api/autopilot/execute
Hono Backend (trading-service.ts / proposal-service.ts)
    │  PRIMARY_BROKER=rithmic (default)
    ▼ POST http://localhost:3002/order/place
Rithmic Gateway (gateway.py)
    │  async_rithmic → ORDER_PLANT WebSocket
    ▼
Rithmic Network → TopstepX account → MNQ fill
```

---

## Autopilot Modes

Harper can operate Autopilot in two modes. Both use the same execution path — only the approval step differs.

### Mode 1: Semi-Autonomous (Human-in-the-Loop)

```
Agent Pipeline runs (analysts → researchers → debate → trader → risk)
    │
    ▼  POST /api/autopilot/generate
Proposal created (status: "pending", TTL: 5 min)
    │
    ▼  Pulse UI displays ProposalModal to trader
Trader reviews → Approve / Reject
    │  POST /api/autopilot/acknowledge  {decision: "approved"}
    ▼
    POST /api/autopilot/execute
    │
    ▼  Rithmic Gateway places order
```

**Use when:** TP is at the desk, wants final veto on every trade.

### Mode 2: Fully Autonomous

```
Agent Pipeline runs on a schedule or on Antilag signal
    │
    ▼  POST /api/autopilot/generate
Proposal created
    │  Risk assessment passes + confidence ≥ threshold (e.g., 75)
    ▼  Auto-acknowledge: skip ProposalModal
    POST /api/autopilot/execute  (called programmatically)
    │
    ▼  Rithmic Gateway places order → notifies via Pulse feed
```

**Use when:** TP steps away, sets autonomous trading rules in advance.

#### Autonomous Config (planned)
Add to user settings or `.env`:
```
AUTOPILOT_MODE=autonomous
AUTOPILOT_MIN_CONFIDENCE=75     # 0–100, skip proposal review if above
AUTOPILOT_MAX_DAILY_TRADES=10
AUTOPILOT_DAILY_LOSS_LIMIT=1500 # USD — hard stop for the day
```

---

## Harper's Checklist — Integrating Autopilot into QC Algo

The QuantConnect algo (C#, Lean) should coordinate with Pulse rather than place orders independently. Recommended pattern:

1. **QC detects setup** (Antilag fires, Fib level sweep confirmed)
2. **QC calls Pulse** → `POST /api/autopilot/generate` with market context
3. **Pulse agent pipeline** debates and produces a proposal
4. **Mode 1:** Trader approves in UI → `POST /api/autopilot/execute`
   **Mode 2:** Auto-execute if confidence ≥ threshold
5. **Pulse** calls Rithmic Gateway → order placed
6. **QC** monitors fills via Rithmic PNL_PLANT for trailing stop management

QC handles: setup detection, trailing stops, scale-in confirmation
Pulse handles: debate, risk assessment, order placement, proposal history

---

## Files

| File | Purpose |
|------|---------|
| `rithmic-gateway/gateway.py` | FastAPI server — main gateway |
| `rithmic-gateway/requirements.txt` | `async-rithmic`, `fastapi`, `uvicorn` |
| `rithmic-gateway/.env.example` | Credential template |
| `backend-hono/src/services/rithmic-service.ts` | Hono → gateway HTTP client |
| `backend-hono/src/services/trading-service.ts` | `fireTestTrade()` broker routing |
| `backend-hono/src/services/autopilot/proposal-service.ts` | `executeProposal()` → rithmic-service |
| `docs/quantconnect/AUTOPILOT-IMPLEMENTATION-PHASE-1.md` | Phase 1 status tracker |

---

## Production Deployment

Run the gateway as a systemd service or Docker container on the same host as the Hono backend.

```bash
# Dockerfile (minimal)
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY gateway.py .
CMD ["uvicorn", "gateway:app", "--host", "0.0.0.0", "--port", "3002"]
```

Set `RITHMIC_GATEWAY_URL=http://rithmic-gateway:3002` in the Hono backend's Fly.io secrets if deploying separately.

---

## Known Gaps (Phase 2)

- [ ] Bracket orders (stopLoss + takeProfit auto-wired from proposal)
- [ ] Fill confirmation webhook back to Pulse
- [ ] PNL_PLANT connection for live P&L streaming
- [ ] TICKER_PLANT for Antilag signal feed (1000T tick velocity)
- [ ] Footprint chart data (post-MVP, see HANDOFF-PROMPT.md)
