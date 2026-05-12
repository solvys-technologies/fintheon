# S62-ORCH — Parity and Ship Hygiene

- **Parent sprint branch**: `sprint/S62`
- **Cycle**: Cycle 7 (Pre-Release)
- **Due**: May 16
- **Owner**: Shashank

## What this covers

Backend-side parity checks and hygiene fixes for the Closed Beta release. Covers smoketesting parity endpoints, brief generation parity in the frontend, guarding the empty predictions stub surface, and route logging hygiene across chat, riskflow, and data brief routes.

## Codebase map

### Brief generation

- `backend-hono/src/services/brief-generator.ts` — Brief generation service (MDB, ADB, PMDB, TWT)
- `backend-hono/src/routes/data/index.ts` — Data routes (brief generation endpoint)
- `frontend/lib/services/voice.ts` — Generic frontend service layer (brief API calls)
- `sprint-md/S43-T7-component-extraction.md` — Context for frontend brief display

### Parity endpoints

- `backend-hono/src/routes/index.ts` — Master route registry. Key routes:
  - `POST /api/data/brief/generate` — Trigger brief generation
  - `GET /api/data/brief/latest?type=X` — Fetch latest brief
  - `GET /api/riskflow/feed` — Scored news feed
  - `GET /api/harper/chat` — CAO chat
  - `GET /api/arbitrum/verdicts/:id` — Arbitrum verdict
  - `GET /api/diagnostics` — Service health check
  - `GET /api/journal/entries`, `/api/journal/summary` — Journal endpoints

### Predictions surface

- `frontend/components/narrative/ArbitrumChamberPredictionCards.tsx` — Prediction cards display
- `frontend/components/narrative/PolymarketPredictionCards.tsx` — Polymarket prediction cards
- `frontend/components/arbitrum/ChamberSeats.tsx` — Chamber seat predictions
- `frontend/components/narrative/ConsolidatedTradeLedger.tsx` — Trade ledger

### Route logging

- `backend-hono/src/routes/` — All route handlers (need logging audit)
- `backend-hono/src/services/` — All services (need logging audit)

## Child tickets

### SOL-74 — S62-T26: Cleanup + smoke coverage for parity endpoints

Branch: `sprint/S62`

**What to do**: Add smoke test coverage for all key API endpoints. Create a smoke test script or add to existing tests that hits each major endpoint and verifies a 200 response. Endpoints to cover:

- `GET /api/diagnostics` — Health check
- `GET /api/riskflow/feed` — RiskFlow feed
- `GET /api/data/brief/latest?type=MDB|ADB|PMDB|TWT` — Brief endpoints
- `GET /api/arbitrum/latest` — Arbitrum latest verdict
- `GET /api/harper/chat` (with appropriate auth) — Harper chat
- `GET /api/journal/entries` — Journal entries
- `GET /api/journal/summary` — Journal summary

Clean up any dead or commented-out endpoint handlers found during the audit.

**Key files**: `backend-hono/src/routes/`, `backend-hono/src/services/`, `backend-hono/tests/` (or create `backend-hono/src/smoke/` if no test framework)

**Validation**: Each endpoint returns 200 with expected shape. No 500 errors for basic requests.

### SOL-75 — S62-T27: Brief generation parity: MDB/ADB/PMDB/TWT in frontend

Branch: `sprint/S62`

**What to do**: Verify all four brief types (MDB, ADB, PMDB, TWT) can be triggered and displayed correctly in the frontend. Check:

- `POST /api/data/brief/generate` with `type` parameter works for each brief type
- `GET /api/data/brief/latest?type=X` returns appropriate content
- Frontend brief display components render each brief type correctly
- Brief generation respects schedule (MDB 6:30AM, ADB 10:45AM, PMDB 5:15PM, TWT 4:30PM Sunday)
- Add UI controls to trigger briefs if missing

**Key files**: `backend-hono/src/services/brief-generator.ts`, `backend-hono/src/routes/data/index.ts`, frontend components that display briefs

**Validation**: Generate each brief type. Verify content is well-formed. Check frontend display.

### SOL-76 — S62-T28: Guard/disable empty stub predictions surface

Branch: `sprint/S62`

**What to do**: The predictions surface shows stub/empty content when no predictions data is available. Guard this: add a null/empty check before rendering prediction components. If no data, show nothing or a minimal "No predictions yet" indicator instead of broken UI. Check:

- `ArbitrumChamberPredictionCards.tsx` — guard empty state
- `PolymarketPredictionCards.tsx` — guard empty state
- `ChamberSeats.tsx` — guard empty seats
- `ConsolidatedTradeLedger.tsx` — guard empty ledger

**Key files**: `frontend/components/narrative/ArbitrumChamberPredictionCards.tsx`, `frontend/components/narrative/PolymarketPredictionCards.tsx`, `frontend/components/arbitrum/ChamberSeats.tsx`, `frontend/components/narrative/ConsolidatedTradeLedger.tsx`

**Validation**: Load app with no predictions data. Verify no broken UI elements. Predictions sections are either hidden or show "No data" state.

### SOL-77 — S62-T29: Route logging hygiene: chat, riskflow, data brief alias

Branch: `sprint/S62`

**What to do**: Audit logging across backend route handlers. Ensure:

- Every route handler logs entry and exit (or error)
- Log messages use structured logging via `createLogger` from `backend-hono/src/lib/logger.js`
- No `console.log` / `console.error` in route handlers (should use logger)
- RiskFlow, chat, and data brief routes have consistent log patterns
- Sensitive data (auth tokens, passwords) is NEVER logged

**Key files**: `backend-hono/src/routes/chat/*`, `backend-hono/src/routes/riskflow/*`, `backend-hono/src/routes/data/*`, `backend-hono/src/services/`

**Validation**: `rg "console\.(log|warn|error)" backend-hono/src/routes/` shows zero hits (or only justified cases). Log file review shows consistent format.

## Execution order (wave sequence)

### Wave 1 (parallel)

- SOL-74 — Parity smoke tests (independent, creates test infrastructure)
- SOL-77 — Route logging hygiene (pure audit/fix, independent)

### Wave 2 (parallel)

- SOL-75 — Brief gen parity (depends on routes being clean from SOL-77)
- SOL-76 — Predictions guard (independent)

## Validation

- [ ] All parity endpoints return 200 with correct shapes
- [ ] All 4 brief types generate and display correctly
- [ ] Predictions surface guards empty data gracefully
- [ ] No `console.log` in route handlers (uses structured logger)
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx vite build` passes
- [ ] Add changelog entry
