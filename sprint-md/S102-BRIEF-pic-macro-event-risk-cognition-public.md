# Sprint Brief: S102 -- PIC Macro Event-Risk Cognition + Public V1 (single-agent)

## Intent

Fintheon should stop behaving like it is restating an econ calendar and start behaving like PIC's internal macro event-risk desk. Every trading window added to a Desk Plan must receive a PIC internal forecast, miss/beat probabilities, confidence, data-cycle logic, and second-order market read. Public.com is integrated from V1 as a first-class data source for real-time quotes, bars, option chains, option Greeks, and Streamdown instrument widgets. NarrativeFlow must also stop silently injecting long opener prompts into chat on session start, because that path can trigger React error #185 and crash the workspace.

## Branch Target

`codex/next-2026-05-27`

## Scope -- Included

- [ ] Add a source-of-truth doctrine for PIC as an agentic macro event-risk desk, including the Fed/data-cycle model and trader commandments as active forecast guardrails.
- [ ] Wire the doctrine into Harper, Oracle, Feucht, Consul, Herald, Arbitrum, Agentic Desk, Desk Plan, and Daily Brief prompt/context paths.
- [ ] Replace the Desk Plan rows between `Trading Window` and `Thesis` with the new PIC forecast system: internal forecast, miss probability, beat probability, confidence, delta vs consensus, data-cycle stage, second-order read, confirmation, and invalidation.
- [ ] Treat calendar consensus as a baseline/obstacle only. It must never be displayed as Fintheon's forecast.
- [ ] Integrate Public.com as a V1 market-data provider for real-time quotes, bars, option chains, option Greeks, and source-attributed 5D/1W Streamdown instrument widgets where supported.
- [ ] Register Public in the MCP connector metadata so agent surfaces can recognize the Public MCP/tooling path.
- [ ] Create a GEPA/Refinement Engine proposal path for macro-event forecast review after events and sessions. GEPA proposes updates; it does not silently mutate doctrine.
- [ ] Fix the NarrativeFlow long-prompt injection crash path: session openers may create sessions and visible user messages only when user-sent, but must not auto-inject a long hidden prompt into the first chat turn.

## Scope -- Excluded (OUT OF BOUNDS)

- Public order placement, preflight, account trading, or autonomous execution.
- Full basis-adjusted GEX aggregation claims. V1 may ingest option chains/Greeks and expose the fields needed for a later validated GEX model.
- Per-team bespoke forecasting-model onboarding. Document as roadmap context only; PIC remains the first canonical team model.
- Reworking unrelated Desk Plan layout, DayCard header chrome, queue controls, sprint map, or recent v7 release/package work.

## Known Issues to Preserve

- Recent Desk Plan polish moved the window cycler into the DayCard/Desk Plan header and changed miss/beat display from probability percentages to agentic print forecasts. Preserve the window cycling behavior and only replace the forecast row band requested here.
- Current macro watchlist/Streamdown ticker widgets already use `backend-hono/src/services/market-data/macro-watchlist.ts` plus `MarketTickerCard`/`MarketTickerStripSlot`; extend this path instead of replacing the Streamdown slot system.
- React minified error #185 is "Maximum update depth exceeded" per official React docs. Treat NarrativeFlow startup auto-send loops as a crash-class blocker, not a cosmetic bug.

## Design Pass

### Layout / Interaction

The visible Desk Plan card should keep the existing `Event`, `Trading Window`, and `Thesis` row positions. The rows between `Trading Window` and `Thesis` become the PIC forecast band:

- `PIC Forecast` shows the internal desk forecast value or tone.
- `Miss` shows probability and agentic print/tone.
- `Beat` shows probability and agentic print/tone.
- `Confidence` shows the confidence score.
- `Cycle` or `2nd Order` opens/toggles compact detail for data-cycle stage, Fed milestone anchor, cross-asset transmission, confirmation, and invalidation.

Use compact row labels, tabular numerals, dotted leaders, and existing DayCard expanded-row behavior. Do not add cards inside the DayCard. Public-backed instrument widgets should reuse the existing Streamdown ticker card, add a 5D/1W selector or explicit span label, and show source attribution such as `Public` or fallback source.

### API / Service Shape

Extend the existing day-plan/econ-forecast contract rather than inventing a parallel route. The forecast object should distinguish:

```ts
calendarConsensus: string | null
picInternalForecast: string
missProbability: number
beatProbability: number
confidenceScore: number
forecastDeltaVsConsensus: string
dataCycleStage: string
fedMilestoneAnchor: string
secondOrderRead: string
crossAssetTransmission: string
whatConfirms: string
whatInvalidates: string
commandmentChecks: string[]
```

Public integration should live behind the backend market-data service boundary with graceful fallback when `PUBLIC_API_KEY` or equivalent auth is missing. Do not call Public directly from React components. Register Public metadata in the MCP connector registry and include a disabled/missing-key state.

### Data / Agent Shape

Add `knowledge-base/source-of-truth/macro-event-risk-cognition.md` and make it the canonical doctrine for this sprint. It must include:

- PIC as a boutique macro event-risk desk.
- Daily participation as the baseline assumption.
- Consensus forecast as baseline/obstacle.
- Fed decision/presser as the active interpretive lens.
- Jobs week, PMIs, PCE/spending, CPI/PPI, GDP, earnings, and quarterly structure.
- Trader commandments as forecast guardrails, not trade avoidance.

Agents should reason by role: Oracle quantifies the forecast gap, Consul maps econ-cycle transmission, Herald checks positioning/headline traps, Feucht checks tape/levels/invalidation, and Harper synthesizes the desk read.

### React 185 / NarrativeFlow Guardrail

Inspect `NarrativeCanvas`, `ChatInterface`, `useHermesChat`, and related initial-message handlers. Remove or guard any path that turns a session opener/system prompt into an automatic hidden chat send. Session creation can store the user-visible opener in the session, but chat should not auto-append long prompt text on mount, remount, conversation reset, or workspace switch. Any remaining initial message path needs an idempotent guard and max-length/type check so it cannot loop through `clearConversationId`, `setQueuedInitialMessage`, `runtime.append`, and hydration.

### Aesthetic Rules

- Flat warm near-black surfaces with thin low-opacity `#c79f4a` borders.
- No gradients, emojis, Kanban borders, AI sparkles, generic shadows, or new blur.
- Use existing DayCard row rhythm and Streamdown slot surfaces.
- Values may use bullish/bearish colors; labels and containers stay restrained.

### External Reference Boundaries

- Public official API docs confirm market-data endpoints for quotes, option expirations, option chains, bars, and option Greeks, plus Claude MCP/CLI/Python/OpenClaw tooling. Use these docs to implement the provider and connector metadata; do not copy code, enable order placement, or bypass Fintheon's backend service boundary.
- Howard Marks, Annie Duke, and Reminiscences are doctrine references only. Convert their ideas into PIC-native rules; do not quote or embed copyrighted text.

## Development Flow

1. **Discovery and crash triage** -- Reproduce or locally inspect the NarrativeFlow React 185 path. Trace session opener creation through `NarrativeCanvas`, `ChatInterface`, and chat hydration. Confirm which prompt is silently inserted before editing.
2. **Doctrine layer** -- Add `macro-event-risk-cognition.md`; update shared beliefs, philosophy blocks, and desk dossiers so agents inherit the PIC macro-event model and commandments.
3. **Forecast contract** -- Extend backend/frontend day-plan forecast types to carry PIC internal forecast, miss/beat probabilities, confidence, consensus baseline, second-order read, confirmation, and invalidation.
4. **Forecast generation** -- Update econ forecast and redeliberation prompts/services so the model generates PIC internal forecasts from data-cycle context instead of echoing calendar consensus.
5. **Desk Plan UI** -- Replace the `Forecast`, `Miss`, `Beat`, and optional `Notable` rows between `Trading Window` and `Thesis` in `DayCard` with the new PIC forecast rows while preserving thesis expansion and window cycling.
6. **Public provider** -- Add a Public market-data provider module behind the existing backend market-data layer, expose Public-backed quotes/bars/option Greeks where credentials exist, and degrade to existing providers when missing.
7. **Streamdown widgets** -- Extend macro watchlist data and ticker schemas/components for Public-backed 5D/1W sparklines, source labels, and clean unavailable states.
8. **MCP metadata** -- Add Public to MCP connector metadata with category `trading` or `data`, API-key state, and no order-placement capability in this sprint.
9. **GEPA proposal loop** -- Add a macro-event review proposal path that compares PIC forecast, consensus, actual print, tape reaction, and missed second-order chains, then writes proposals to the Refinement Engine/GEPA surface for review.
10. **Validation and changelog** -- Build, typecheck, smoke the relevant endpoints, verify NarrativeFlow no longer crashes from opener injection, and update `src/lib/changelog.ts`.

## Acceptance Criteria

- [ ] A new source-of-truth doctrine file defines PIC macro event-risk cognition, the econ cycle, and commandment usage.
- [ ] Desk Plan forecast rows between `Trading Window` and `Thesis` show PIC internal forecast data, not calendar consensus as the forecast.
- [ ] Every Desk Plan trading window has a forecast object with internal forecast, miss probability, beat probability, and confidence.
- [ ] Arbitrum, Harper, Agentic Desk, and brief generation receive the macro-event cognition layer.
- [ ] Public.com is available as a backend market-data provider and connector metadata entry.
- [ ] Streamdown market ticker widgets can show Public-backed 5D and 1W data with source attribution and nonblank fallback states.
- [ ] Public missing credentials do not break Desk Plan, chat, Arbitrum, or market-scan endpoints.
- [ ] NarrativeFlow session creation/opening does not silently inject a long hidden prompt into the first chat turn.
- [ ] React error #185 is not reproducible from NarrativeFlow session creation/opening/reset flows.
- [ ] GEPA creates proposed macro-event cognition updates for Refinement Engine review rather than mutating doctrine automatically.
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- [ ] `rm -rf dist && npx vite build` passes.
- [ ] `cd backend-hono && bun run build` passes.
- [ ] Live endpoint tested via curl for day-plan and market-scan/Public-backed data paths.
- [ ] UI manually or Playwright-verified for Desk Plan row band, Streamdown ticker card, and NarrativeFlow opener flow.
- [ ] Changelog entry added to `src/lib/changelog.ts`.
- [ ] File header `// [Codex 2026-05-27]` added to substantially modified files.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Desk Plan smoke
curl -s http://localhost:8080/api/day-plan/today | head -c 600

# Market scan / ticker data smoke
curl -s http://localhost:8080/api/market-scan/macro-watchlist | head -c 600

# MCP registry smoke
curl -s http://localhost:8080/api/mcp | head -c 600
```

## Commit Format

```bash
[v7.0.5] feat: S102 macro event cognition and Public data
```
