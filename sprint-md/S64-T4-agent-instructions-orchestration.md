# Sprint Brief: T4 — Agent Instructions & CAO Orchestration

## Context

The Desk Plan overhaul and lockout features need corresponding agent instruction updates. The CAO (Harper) must be instructed to generate the weekly Desk Plan when TWT is published, perform a 5 PM daily review (Sun-Thu) for the next Asian and US morning sessions, and account for cross-border macro event sensitivity. All agents need updated shared beliefs about pricing literacy (max 80pt profit targets, TV scanner as authoritative data source, futures notation). The Trade Ledger needs confidence scoring and MEGACAP-only filtering. The Cross-Border Macro Sensitivity classifier lives in agent instructions so agents identify USD-sensitive events from AU/NZ/JP/KR/CN/EU/UK data. A new cron triggers the CAO's evening review. A new route handler processes CAO review updates to the Desk Plan.

## Branch Target

`sprint/S64`

## Scope — Included

- [ ] `backend-hono/src/services/ai/soul/harper.md` — Add instructions for: weekly Desk Plan generation on TWT publish, 5 PM daily review (Sun-Thu) scanning for pool calls/fed speeches/econ revisions/geopol summits/cross-border macro, updating (not replacing) existing windows with higher-volatility event discovery, adding Asian session windows when catalysts exist (19:00-20:00 ET)
- [ ] `backend-hono/src/services/ai/soul/harper-extra.md` — Cross-reference pricing literacy rules, profit target constraints, TV scanner authority
- [ ] `backend-hono/src/services/ai/agent-instructions/shared-beliefs.ts` — Add "FINTHEON FUTURES PRICING REALITY" section: (1) max 80pt profit target for 15-45min window, (2) TV scanner is authoritative price source (not Yahoo Finance), (3) futures notation: NQ = ~18000 not 180.00, ES = ~5500, YM = ~38000, (4) cross-border macro events are primary window candidates
- [ ] `backend-hono/src/services/skills/evening-review-instructions.ts` [NEW] — Harper's skill script for handling `[SKILL:EVENING_REVIEW]` tag: what to search for, how to format the update, which endpoint to call
- [ ] `backend-hono/src/services/cron/cao-evening-review-scheduler.ts` [NEW] — Cron job that fires at 5 PM ET (17:00) Sun-Thu. Sends `[SKILL:EVENING_REVIEW]` tag to Harper via the chat pipeline, triggering the review workflow. Does NOT call the day-plan endpoint directly — Harper handles that.
- [ ] `backend-hono/src/routes/day-plan/handlers.ts` — Add `handlePostCaoEveningReview()`: accepts update payload from Harper, merges with existing day plan, returns updated plan. Route: `POST /api/day-plan/cao-evening-review`
- [ ] `backend-hono/src/routes/day-plan/index.ts` — Register the new route
- [ ] `frontend/components/narrative/ConsolidatedTradeLedger.tsx` — Update to: filter for MEGACAP stocks only, add confidence score display, use scored predictions endpoint, integrate polymarket predictions with TV price context
- [ ] `frontend/components/narrative/ArbitrumChamberPredictionCards.tsx` — Update to use new Market Heat data shape from T1/TV scanner (if T1 ships its heat engine), or keep current behavior if not (T4 should be resilient to T1 being incomplete)
- [ ] `backend-hono/src/services/agent-desk/agent-desk-briefing.ts` — Update `heatInterpretation()` to use per-instrument heat scores from TV scanner data (correlation-aware: NQ+ES, GC sparingly, CL with geopolitics, YM with broad sentiment)

## Scope — Excluded (DO NOT TOUCH)

- TV scanner pricing services (`tv-bars-fetcher.ts`, `price-rounding.ts`, `instrument.ts`) — handled by T1
- Lockout service or routes — handled by T3
- DayCard/Mobile UI — handled by T2
- Any RiskFlow files — off-limits per sprint constraint

## Reuse Inventory (existing code to call, not reinvent)

- `harper.md` at `backend-hono/src/services/ai/soul/harper.md` — current instructions are the base to extend; read first, then append new sections
- `shared-beliefs.ts` at `backend-hono/src/services/ai/agent-instructions/shared-beliefs.ts` — append new sections at the end; do not modify existing beliefs
- `formatDeskThemeBlock()` at `backend-hono/src/services/brief-generator.ts` — injects desk plan data into brief prompts; T4 should reference this in Harper's instructions so she knows it exists
- `ConsolidatedTradeLedger.tsx` at `frontend/components/narrative/ConsolidatedTradeLedger.tsx` — currently shows all polymarket predictions; T4 adds MEGACAP filter + confidence scoring
- `handlePostDayPlan()` or similar handler pattern in `backend-hono/src/routes/day-plan/handlers.ts` — follow existing handler patterns for the new `cao-evening-review` endpoint

## Known Issues to Preserve

- The CAO evening review cron MUST NOT call the day-plan API directly — it sends a skill tag to Harper in chat, and Harper drafts the proposal. This changed from the original plan (which had auto-execution). The user explicitly wants Harper to propose and the user to approve via the chat interface.
- `shared-beliefs.ts` existing content must NOT be removed — only append new sections
- Cross-border macro sensitivity: AU data (CPI, employment, RBA), NZ data (CPI, employment, RBNZ), JP data (CPI, Tankan, BoJ), KR data (CPI, exports, BoK), CN data (CPI, PMI, PBoC), EU data (CPI, GDP, ECB), UK data (CPI, employment, BoE). Any of these can move USD pairs and create afterhours US equity windows.

## Implementation Steps

1. **shared-beliefs.ts**: Append new section `FINTHEON FUTURES PRICING REALITY` at end of file with:
   - Authoritative price source: TV Scanner (not Yahoo Finance)
   - Realistic profit targets: max 80 points in 15-45 minute windows
   - Futures notation guide: NQ ≈ 18000–20000, ES ≈ 5000–6000, YM ≈ 35000–45000
   - Cross-border macro events are primary window candidates (especially outside US RTH)

2. **harper.md**: Append sections for:
   - Weekly Desk Plan: "When TWT is published, call generateDayPlan() to create the week's Desk Plan"
   - 5 PM Evening Review: "At 5PM ET Sun-Thu, scan [sources] for new events that outdo existing windows. Call POST /api/day-plan/cao-evening-review with findings."
   - Cross-border macro: "Watch for USD-sensitive data from AU, NZ, JP, KR, CN, EU, UK. These create afterhours trading windows."

3. **harper-extra.md**: Add cross-reference to pricing literacy rules in shared-beliefs.ts.

4. **evening-review-instructions.ts [NEW]**: Export a string constant `EVENING_REVIEW_SKILL_INSTRUCTIONS` that tells Harper what to do when she gets `[SKILL:EVENING_REVIEW]`:
   - Check economic_events for new items since last plan generation
   - Check WH Pool Call feed for unscheduled events
   - Check Fed/Bessent/Trump speech schedule for additions
   - Scan for cross-border macro events with USD sensitivity
   - Call `POST /api/day-plan/cao-evening-review` with the update payload
   - Format the response as a chat message proposing the changes

5. **cao-evening-review-scheduler.ts [NEW]**:
   - Schedule running at 17:00 ET Sun-Thu (use cron-parser or node-cron)
   - On trigger: inject `[SKILL:EVENING_REVIEW]` into the Harper chat pipeline
   - Do NOT call day-plan API directly — Harper handles that from chat

6. **day-plan/handlers.ts**: Add `handlePostCaoEveningReview()`:
   - Accepts `{ windows: TradingWindowUpdate[], reason: string }`
   - Validates with Zod
   - Merges updates into existing day plan (adds new windows, does NOT replace existing ones)
   - Returns updated `DayPlan`
   - Route: `POST /api/day-plan/cao-evening-review`

7. **day-plan/index.ts**: Register new route: `router.post('/cao-evening-review', handlePostCaoEveningReview)`

8. **ConsolidatedTradeLedger.tsx**:
   - Add filter: only show predictions for MEGACAP stocks (Apple, Microsoft, Nvidia, Amazon, Meta, Google, Tesla, Berkshire, Broadcom, Visa, JPMorgan, etc.)
   - Add confidence score column/gauge (0-100%)
   - Use a new `GET /api/trade-ledger/scored` endpoint or add scoring to existing polymarket predictions fetch
   - Filter out crypto predictions

9. **agent-desk-briefing.ts**: Update `heatInterpretation()` to accept per-instrument scores and correlation multipliers:
   - NQ + ES: 0.8 correlation weight
   - GC: independent analysis (inflation/geopol)
   - CL: geopolitical tension overlay
   - YM: broad sentiment weight (0.5)
   - Briefing should state per-instrument thesis + composite heat

## Acceptance Criteria

- [ ] Harper's instructions include weekly Desk Plan generation on TWT publish
- [ ] Harper's instructions include 5 PM evening review protocol (Sun-Thu)
- [ ] `shared-beliefs.ts` contains pricing literacy section (max 80pt, TV authority, futures notation)
- [ ] Evening review cron fires at 17:00 ET Sun-Thu
- [ ] `POST /api/day-plan/cao-evening-review` route accepts and merges Harper's updates
- [ ] Trade Ledger shows only MEGACAP stocks with confidence scores
- [ ] heatInterpretation() produces per-instrument heat scores with correlation logic
- [ ] No RiskFlow files were touched

## Validation Commands

```bash
# Backend type-check + build
cd backend-hono && bun run build

# Frontend type-check
cd .. && npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build
```

## Commit Format

```
[v.6.13.1] feat: T4 agent instructions + CAO orchestration + Trade Ledger scoring
```
