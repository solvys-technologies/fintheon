# PULSE Codebase Summary (Updated)

## Project Overview

PULSE is an integrated trading workspace with:

- React 19 + Vite frontend (`frontend/`)
- Hono backend API (`backend-hono/`)
- Neon/Postgres persistence
- OpenClaw/boardroom integration paths

## Current Backend Reality

Primary backend is `backend-hono/`, not Encore.

### Mounted API domains

- Market
- Boardroom
- Account
- Notifications
- Trading
- ProjectX
- RiskFlow
- Psych
- AI
- Agents
- Polymarket

### Important gap

- Autopilot route module exists but is not currently mounted in route registration.

## Current Frontend Reality

- State-driven tabbed workspace (`feed`, `analysis`, `news`, `executive`, `chatroom`, `notion`, `settings`)
- Service wrappers in `frontend/lib/services.ts`
- API client in `frontend/lib/apiClient.ts` uses `VITE_API_URL` (default `http://localhost:8080`)

## Known Gaps

- Simulated execution remains in parts of proposal/trading lifecycle.
- Auth middleware is local single-user mode for now.
- A set of frontend service methods are still stubs pending endpoint parity.

## Deployment Model

- Frontend: Vercel
- Backend: Fly.io

## Working Files to Know

- `backend-hono/src/index.ts`
- `backend-hono/src/routes/index.ts`
- `backend-hono/src/middleware/auth.ts`
- `backend-hono/src/services/autopilot/proposal-service.ts`
- `backend-hono/src/services/trading-service.ts`
- `frontend/components/layout/MainLayout.tsx`
- `frontend/lib/apiClient.ts`
- `frontend/lib/services.ts`

## Canonical Status Reference

- Notion: `Pulse Engineering Audit — 2026-02-12`
- Local: `docs/OpenClaw Move-In Sprint Plan.md`
