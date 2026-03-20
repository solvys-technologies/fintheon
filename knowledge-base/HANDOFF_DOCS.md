# System Handoff Documentation

## Snapshot Date

2026-02-12

## 1) Current Backend Reality

Pulse backend is implemented under `backend-hono/` and is not greenfield.

### Route groups currently mounted

- `/api/market`
- `/api/boardroom`
- `/api/account`
- `/api/notifications`
- `/api/trading`
- `/api/projectx`
- `/api/riskflow`
- `/api/psych`
- `/api/ai`
- `/api/agents`
- `/api/polymarket`

### Not yet mounted

- Autopilot route module exists at `backend-hono/src/routes/autopilot/` but is not registered in `backend-hono/src/routes/index.ts`.

### Auth mode

- `backend-hono/src/middleware/auth.ts` runs local single-user auth context (`local-user`) for protected routes.

## 2) Frontend Integration Reality

Frontend service wrappers live in `frontend/lib/services.ts` and most major domains are wired.

### Actively consumed API domains

- Account, riskflow, market/VIX, ai chat, trading, projectx, notifications, boardroom, agents, polymarket.

### Stubbed or partial service methods

- NTN report generation fallback
- Position seeding fallback
- ProjectX uplink fallback
- ER snapshots / overtrading checks fallback
- Events list/seed fallback

These stubs were intentionally retained while backend parity is still in progress.

## 3) RiskFlow Notes

RiskFlow has route + service implementation, feed polling, and cron-related handling. Known placeholders still in handlers include market-close detection and previous-session score values.

## 4) Boardroom / OpenClaw Notes

Boardroom backend reads/writes local Clawdbot session files and relays intervention messages. This works locally and requires explicit deployment/runtime validation for non-local environments.

## 5) OpenClaw Move-In Critical Tasks

1. Register autopilot routes in main router.
2. Complete real order execution path (proposal -> approval -> broker execution -> persistence).
3. Remove critical frontend service stubs by implementing missing backend parity.
4. Harden production auth path (replace local bypass in production).
5. Add observability baseline for proposal/execution lifecycle traceability.
6. Run full integration certification before production move-in.

## 6) Canonical Audit Reference

Notion source of truth: `Pulse Engineering Audit — 2026-02-12`
