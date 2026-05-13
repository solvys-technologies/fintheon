# Sprint Brief: T1 — TV Scanner & Desk Plan Engine

## Context

The Desk Plan generates daily trading plans with entry/exit points, profit targets, and invalidation levels. Currently prices come from Yahoo Finance OHLCV bars which are stale/delayed, causing agents to call for 200-point profit targets in a 15-45 minute window and misread futures notation (200.00 vs 2000.0). This track replaces Yahoo Finance with the TradingView scanner for live price data, fixes profit target clamping, adds the White House Pool Call scraper for event sourcing, expands the window scheduler for speeches/summits/cross-border macro events, and updates the day-plan service to use these new data sources.

## Branch Target

`sprint/S64`

## Scope — Included

- [ ] `backend-hono/src/services/day-plan/tv-bars-fetcher.ts` — Replace Yahoo Finance (`NQ=F`, `ES=F`, `YM=F`) with TradingView scanner for live OHLCV bars
- [ ] `backend-hono/src/services/day-plan/price-rounding.ts` — Add profit target clamping (max 80 points for 15-45min window), fix entry point rounding accuracy
- [ ] `backend-hono/src/services/iv-scoring/instrument.ts` — Remove hardcoded `currentPrice` fallbacks from `INSTRUMENT_BETAS`; refresh from TV scanner on each plan generation
- [ ] `backend-hono/src/services/fiscal-sources/wh-pool-call.ts` [NEW] — Scraper for White House Press Pool RSS feed, modeled after `trump-schedule.ts`
- [ ] `backend-hono/src/services/cron/fiscal-speaker-populator.ts` — Add WH Pool Call ingestion alongside existing Fed/Bessent/Trump speech ingestion
- [ ] `backend-hono/src/services/day-plan/window-scheduler.ts` — Expand to include speeches, summits, WH Pool Call events, and cross-border macro (AU, NZ, JP, KR, CN, EU, UK data with USD sensitivity). Support multiple trading windows per day.
- [ ] `backend-hono/src/services/day-plan/day-plan-service.ts` — Wire new event sources into generation pipeline. Preserve existing auto-lockout line (line ~174).
- [ ] `backend-hono/src/services/desk-planner.ts` — Integrate TWT-triggered weekly planning (import from brief-generator)
- [ ] `backend-hono/src/services/brief-generator.ts` — Trigger Desk Plan generation on TWT publish
- [ ] `backend-hono/src/services/day-plan/desk-theme-generator.ts` — Update to use TV-sourced prices, realistic target bands
- [ ] `backend-hono/src/services/day-plan/vwap-poc-math.ts` — No changes expected, preserve as-is

## Scope — Excluded (DO NOT TOUCH)

- Any RiskFlow service file (`backend-hono/src/services/riskflow/`)
- Frontend UI components (`frontend/components/`) — handled by T2
- Lockout service or routes (`lockout.ts`, `routes/lockout/`) — handled by T3
- Agent instruction files (`harper.md`, `shared-beliefs.ts`) — handled by T4

## Reuse Inventory (existing code to call, not reinvent)

- `getTradingViewBars()` at `backend-hono/src/services/day-plan/tv-bars-fetcher.ts:current` — TV scanner is already partially wired; finish the NQ=F/ES=F/YM=F paths
- `addDaysToCalendar()` / `planned_window_type_for_event()` at `backend-hono/src/services/day-plan/window-scheduler.ts:current` — reuse for new event types
- `fetchTrumpSchedule()` at `backend-hono/src/services/fiscal-sources/trump-schedule.ts` — model structure for wh-pool-call.ts
- `fetchFedSpeeches()` at `backend-hono/src/services/fiscal-sources/fed-speeches.ts` — model structure
- `formatDeskThemeBlock()` at `backend-hono/src/services/brief-generator.ts:search` — injected into MDB/ADB/PMDB/TWT prompts

## Known Issues to Preserve

- `day-plan-service.ts` line 174 auto-lockout: `setLockout("default", true, 30 * 60 * 1000)` — DO NOT remove; T3 will extend this later
- `instrument.ts` hardcoded prices are intentional fallbacks — replace them with a function that refreshes from TV scanner on call, but keep a static fallback value (documented) for when scanner is unavailable

## Implementation Steps

1. **tv-bars-fetcher.ts**: Replace Yahoo Finance UDF with TradingView scanner real-time bars. The scanner endpoint already exists in the codebase — find it with `rg "tradingview-scanner"` or grep for "tv scanner". Wire it for NQ=F, ES=F, YM=F.
2. **price-rounding.ts**: Add `MAX_PROFIT_POINTS = 80` constant. Modify `roundTo25multiple()` to clamp at `MAX_PROFIT_POINTS`. Verify `invalidationOffset` stays reasonable (< 40 points).
3. **instrument.ts**: Replace hardcoded `currentPrice` with a `refreshFromTVScanner()` call. Import the TV scanner service. Keep a static fallback for when scanner is unreachable.
4. **wh-pool-call.ts [NEW]**: Create scraper for WH Press Pool RSS. Follow the pattern in `trump-schedule.ts`. Return `EconomicEvent[]` shape (see `fiscal-sources/types.ts`).
5. **fiscal-speaker-populator.ts**: Add `import { fetchPoolCallEvents } from "../fiscal-sources/wh-pool-call.js"`. Call it alongside fed/trump/bessent fetchers.
6. **window-scheduler.ts**: Extend `planned_window_type_for_event()` to handle new categories: `speech`, `summit`, `pool_call`, `cross_border_macro`. Add `isCrossBorderMacro()` classifier that identifies AU/NZ/JP/KR/CN/EU/UK econ data with USD sensitivity. Support generating multiple windows per day.
7. **day-plan-service.ts**: Wire new event sources (speeches, summits, pool call, cross-border macro) into `generateDayPlan()`. The function already fetches econ events from Supabase — ensure the new categories are tagged correctly.
8. **desk-planner.ts**: Modify to trigger from TWT publish signal rather than standalone cron. The trigger hook is in `brief-generator.ts` — add a call to `generateDayPlan()` after TWT is published.
9. **brief-generator.ts**: After TWT generation completes, call `import { generateDayPlan } from "../day-plan/day-plan-service.js"` with the week's window schedule.
10. **desk-theme-generator.ts**: Update to use `getTvBars()` prices instead of Yahoo Finance prices in its theme calculations.

## Acceptance Criteria

- [ ] Desk Plan prices come from TV scanner, not Yahoo Finance
- [ ] Profit targets never exceed 80 points for a 15-45 minute window
- [ ] Entry points round to the nearest 0.5-1.0 point (no 200.00 vs 2000.0 confusion)
- [ ] WH Pool Call events appear in `economic_events` table
- [ ] Window scheduler generates multiple windows per day from all event categories
- [ ] Cross-border macro classifier correctly identifies AU/NZ/JP/KR/CN/EU/UK events
- [ ] Desk Plan auto-generates after TWT is published
- [ ] `instrument.ts` returns live prices from TV scanner with documented fallback

## Validation Commands

```bash
# Backend type-check + build
cd backend-hono && bun run build

# Frontend type-check (imports may change)
cd .. && npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

## Commit Format

```
[v.6.13.1] feat: T1 TV scanner pricing + WH Pool Call + window scheduler expansion
```
