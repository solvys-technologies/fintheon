# Sprint Brief: T5 -- Risk Signal Freshness and Expanded Card Polish

## Context

The user is seeing Risk Signals that look stale. Live discovery confirms `/api/riskflow/risk-signals` returned `{"signals":[]}` at `2026-05-14T01:58:44Z`, while `/api/diagnostics/feed-health` reported `poller_stopped`, `scorerRunning: true`, `unscoredBacklog: 326`, `cacheSize: 500`, and newest feed data at `2026-05-14T01:41:41Z`. The broader feed has fresh data, but risk-signal generation can return empty or cached cards when the current 24h/12h inputs do not satisfy its narrow source thresholds. This track fixes freshness visibility and rounds out the hover/expanded background polish shown in the user's screenshot.

## Branch Target

`sprint/S65`

## Scope -- Included

- [ ] Update `backend-hono/src/services/riskflow/risk-signal-generator.ts` so risk signals refresh daily and do not silently return stale cached signals without freshness metadata.
- [ ] Update `backend-hono/src/routes/riskflow/handlers.ts` only if the `/api/riskflow/risk-signals` response needs additional metadata.
- [ ] Add lightweight diagnostics for risk-signal generation state if needed, preferably in the existing response or diagnostics feed-health surface.
- [ ] Update `frontend/components/narrative/RiskSignalCards.tsx` to show stale/empty states honestly and to avoid making days-old localStorage data look current.
- [ ] Round the highlighted/hovered/expanded Risk Signal row backgrounds so expanded cards and hover states look polished.
- [ ] Preserve the chevron-row anatomy and fading rulers.

## Scope -- Excluded (DO NOT TOUCH)

- Do not alter the RiskFlow worker scheduler unless code evidence proves the scheduler is the direct issue. Scheduler inspection shows intended tiers: FinancialJuice 5s, Unified X 60s RTH/600s AH, Standard 5min in `backend-hono/src/workers/riskflow-worker/scheduler.ts:32`.
- Do not deploy/restart Fly worker in this track.
- Do not touch settings/lockout, header/sidebar, terminal/updater, or Peer Chat files.
- Do not modify `.claude/feed-health.log`; it contains runtime output and conflict-marker noise outside this track.

## Reuse Inventory

- `RiskSignalCards` localStorage cache key at `frontend/components/narrative/RiskSignalCards.tsx:8`.
- Risk signal frontend fetch at `frontend/components/narrative/RiskSignalCards.tsx:65`.
- Existing hover background is square-edged at `frontend/components/narrative/RiskSignalCards.tsx:151`.
- Expanded content starts at `frontend/components/narrative/RiskSignalCards.tsx:185`.
- Backend generator cache TTL is `CACHE_TTL_MS = 10 * 60 * 1000` at `backend-hono/src/services/riskflow/risk-signal-generator.ts:23`.
- Backend generator looks back 24h for bulletins at `risk-signal-generator.ts:35` and 12h for high-severity catalysts at `risk-signal-generator.ts:50`.
- Backend generator returns old cache when generation is empty at `risk-signal-generator.ts:195`.
- Route handler is `handleGetRiskSignals` at `backend-hono/src/routes/riskflow/handlers.ts:1841`.
- Live check on 2026-05-14 showed `/api/riskflow/risk-signals` empty while feed-health newest item was fresh.

## Known Issues to Preserve

- Do not broaden ingestion filters in a way that reintroduces blocked publisher/MSM leakage.
- FinancialJuice ad/promo filtering must remain source-specific and narrow.
- Keep Solvys UI constraints: no gradients, no emojis, no Kanban borders, no AI sparkles.
- RiskFlow worker polling may report `poller_stopped` locally while worker-fed rows are still fresh; distinguish UI signal freshness from worker availability.

## Implementation Steps

1. In `risk-signal-generator.ts`, change the return shape or add helper metadata so callers can know `generatedAt`, `sourceWindow`, `inputCounts`, and whether the result is cached.
2. Stop returning cached signals indefinitely when fresh generation returns empty. Either expire cache after a daily boundary or return `{ signals: [], staleSignals: [...], stale: true }` style metadata so frontend can label it honestly.
3. Broaden signal input criteria carefully. Prefer using recent high-IV/high-macro `scored_riskflow_items` from the last 24h, not only `macro_level >= 3` from the last 12h. Keep a hard cap and approved feed-service/source-policy boundaries.
4. Add a deterministic fallback signal builder when the LLM fails or returns no JSON but recent high-severity items exist. This prevents empty UI when there is clear fresh risk context.
5. In `handleGetRiskSignals`, return metadata such as `generatedAt`, `stale`, `cached`, `inputCounts`, and `freshnessStatus` without breaking existing `signals` consumers.
6. In `RiskSignalCards.tsx`, store localStorage cache with metadata, not only an array. If cached generatedAt is older than a daily threshold, render a subdued stale state instead of pretending it is current.
7. Add visible but compact stale copy such as `No fresh risk signals` or `Last generated Xh ago`, without adding tutorial text.
8. Round hover and expanded backgrounds. Preferred: apply `rounded-md` to the row button and an inner rounded expanded body/background. Keep fading rulers between rows.
9. Ensure expanded/hovered row background does not bleed square corners, especially around the left edge shown in the screenshot.
10. Re-run the live endpoint locally after changes and capture whether it returns fresh signals, honest empty state, or stale metadata.

## Acceptance Criteria

- [ ] Risk signal endpoint returns freshness metadata.
- [ ] Frontend no longer displays days-old cached risk signals as if current.
- [ ] Empty state distinguishes "no fresh signals" from loading failure.
- [ ] Recent feed data can produce risk signals or a deterministic fallback without waiting on bulletins only.
- [ ] Expanded and hovered Risk Signal rows have rounded backgrounds matching the screenshot feedback.
- [ ] `poller_stopped` or stale worker signals are surfaced as diagnostic context, not hidden.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Local endpoint checks
curl -sS http://localhost:8080/api/riskflow/risk-signals | head -c 2000
curl -sS http://localhost:8080/api/diagnostics/feed-health | head -c 2000
```

## Commit Format

```text
[v6.1.0] fix: S65-T5 risk signal freshness and card polish
```
