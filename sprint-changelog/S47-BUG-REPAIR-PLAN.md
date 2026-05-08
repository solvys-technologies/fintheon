# S47 Bug Repair Plan

## Takeover Import

Source archive: `/Users/tifos/Desktop/fintheon-agent-takeover.zip`

Imported state before planning:

- Extracted bundle to `.claude/takeover-import/fintheon-agent-takeover/`.
- Imported bundled Solvys skills into `.claude/skills/`.
- Imported bundled impeccable skills into `.claude/skills/impeccable/` and `/Users/tifos/.claude/skills/impeccable/`.
- Verified Harper, Oracle, Feucht, Consul, and Herald SOUL files in `backend-hono/src/services/ai/soul/` already match the bundle byte-for-byte.

## Open Issues Covered

- #231 Chat Interface Updates
- #232 Arbitrum
- #233 Agentic Forum
- #234 General Backend
- #235 TradingView API needs Further Integration
- #236 RiskFlow

## Executive Priority

1. Data-source correctness first: RiskFlow must stop admitting MSM/general sources, Refinement Engine settings must persist and drive the worker/scorer, and TradingView must become the market-data-first path.
2. Persistence second: calendar saves, Agentic Forum runs, Arbitrum verdicts, PMDB handoff, and prediction-market proposal resolution must survive reloads and surface in history/performance.
3. Rendering third: raw JSON, duplicated labels/cards, gray card backgrounds, stale badges, footer/header clutter, and bad mobile chat response handling are UX failures caused by weak contracts and inconsistent components.
4. Unification last: shared fuses, icons, approval modals, spinner/loader patterns, and source badges should be standardized once backend contracts are stable.

## Track A: RiskFlow Source Integrity and Refinement Persistence

Issues: #236, parts of #232

Primary files:

- `frontend/components/refinement/RefinementEngine.tsx`
- `frontend/components/refinement/SourceAccountsManager.tsx`
- `frontend/components/refinement/CommentatorManager.tsx`
- `frontend/components/refinement/QuickWeightEditor.tsx`
- `frontend/components/refinement/EconFiltersManager.tsx`
- `frontend/lib/scoring-preset-api.ts`
- `backend-hono/src/routes/source-accounts/handlers.ts`
- `backend-hono/src/services/source-accounts/source-accounts-service.ts`
- `backend-hono/src/routes/calibration/handlers.ts`
- `backend-hono/src/routes/scoring/index.ts`
- `backend-hono/src/routes/riskflow/handlers.ts`
- `backend-hono/src/services/riskflow/central-scorer.ts`
- `backend-hono/src/services/riskflow/publisher-blocklist.ts`
- `backend-hono/src/workers/riskflow-worker/sources/index.ts`

Plan:

- Add an explicit save/apply row in Refinement Engine, positioned left of `Re-Score All`, that batches pending source-account, POI ranking, POI list, event-weight, lexicon, filter, and sensitivity edits.
- Split source-account edits into draft state and persisted state so clicking Add Account does not imply the backend accepted it until Save succeeds.
- Extend source accounts with `method` or equivalent polling strategy, with allowed values for X/browser-harness, official RSS, TradingView/econ, and disabled.
- Update the Add Account modal to require source type, method, category, and active status; show validation errors from backend responses instead of swallowing failures.
- Normalize source-account request body casing; current frontend sends both `displayName` and `display_name` depending on path, while `handleAddAccount` only reads `displayName`.
- Route every saved source-account update through the worker source registry and confirm cache TTL is low enough for live changes; current changelog says `getWireHandles` and `getMacroHandles` exist, so verify all active categories are consumed.
- Strip `General` as an accepted feed/category value end-to-end. If legacy rows exist, map them to blocked or archived status, not a visible category.
- Keep only approved X/wire handles and approved official feeds in live RiskFlow. Existing blocklist hardening is recent; preserve it and add tests around non-wire direct MSM leakage.
- Add official RSS feeds for BLS, Federal Reserve, New York Fed, Atlanta Fed, and other tracked econ publishers only when they correspond to events the platform tracks.
- Trigger mandatory rescore after lexicon, weights, sensitivity, source method, source active-state, POI ranking, or event filter changes. This should call persisted rescore when data was saved, not just local preview.
- Surface rescore status and failure reason in footer/toast; no silent catch blocks for admin/source changes.

Acceptance:

- Add/edit/toggle/delete source account persists and is visible after reload.
- Source method is honored by worker and backend stats.
- No `General` category appears in new RiskFlow items or filters.
- Updating event weights or lexicon starts a backend rescore automatically and exposes status.
- MSM/general direct sources remain blocked while approved wire relay text is preserved.

## Track B: TradingView-First Data Layer and Econ Intelligence

Issues: #235, #234, #232

Primary files:

- `backend-hono/src/services/tradingview/scanner.ts`
- `backend-hono/src/services/econ/tradingview-coverage.ts`
- `backend-hono/src/services/cron/econ-calendar-populator.ts`
- `backend-hono/src/services/earnings/sources/tradingview-calendar.ts`
- `backend-hono/src/services/skills/tradingview-trade-plan.ts`
- `backend-hono/src/services/iv-scoring/index.ts`
- `backend-hono/src/services/market-data/*`
- `backend-hono/src/services/ai/agent-instructions/*`
- `backend-hono/src/services/ai/soul/*.md`
- `backend-hono/src/services/arbitrum/econ-context.ts`
- `backend-hono/src/services/agent-desk/agent-desk-context.ts`
- `frontend/components/econ/TradingViewCalendar.tsx`
- `frontend/components/econ/EconCalendar.tsx`
- `frontend/components/narrative/SanctumEconIntel.tsx`
- `frontend/components/narrative/econ/EconEventCard.tsx`

Plan:

- Create a single `market-data-router` service contract: TradingView first, browser-harness second, RiskFlow headlines third, Yahoo only as explicit degradation for symbols TradingView cannot serve.
- Move VIX fetching to this router. Evaluate TradingView scanner/support for `TVC:VIX` or equivalent; if latency beats Yahoo, make TradingView primary and preserve Yahoo as fallback.
- Add quote, OHLCV, futures, index, earnings calendar, and econ event methods to the router using existing `tradingview/scanner.ts` and `econ/tradingview-coverage.ts` before adding new clients.
- Research and spike TradingView options availability separately. Do not assume paid private TradingView endpoints exist in this repo until credentials and API surface are verified.
- If options data is available, add normalized option-chain contracts with instrument, expiry, strike, call/put, bid/ask, mark, IV, volume, OI, delta/gamma/theta/vega if present, and timestamp.
- If options data is not available through TradingView, route options through the approved fallback stack and mark it as degraded, not fake-complete.
- Update Arbitrum, Agentic Forum, and CAO chat system prompts/tool instructions to request market data through the router first.
- Add econ synthesis caching keyed by event family, date range, selected prints, and model version. Store raw pulled prints, normalized rows, and AI synthesis so repeated runs reuse context.
- Remove duplicate `Econ Pulse` / `Econ Watch` labels in Sanctum econ UI. Use one top-level `Econ Intel` label and rename the fuse subsection to `Pulse`.
- Replace old dot-aligned fuses in Econ Intel with shared notched `NothingFuse`/score card pattern after data contracts are correct.

Acceptance:

- `/api/diagnostics` reports TradingView data-router health and last successful fetch.
- VIX resolves from TradingView first when supported, with Yahoo fallback reason visible in diagnostics.
- Econ calendar rows are TradingView-sourced or explicitly marked fallback.
- Agent prompts say TradingView/router first, browser second, RiskFlow headlines third.
- Econ event synthesis can be re-opened without spending full context on unchanged prior prints.

## Track C: Calendar Save, Countdown, Toasts, and Developer Tools

Issues: #234, #235

Primary files:

- `frontend/components/econ/TradingViewCalendar.tsx`
- `frontend/components/econ/EconCalendar.tsx`
- `frontend/components/econ/EconCountdownModal.tsx`
- `frontend/components/settings/DeveloperTab.tsx`
- `backend-hono/src/routes/desk-calendar/handlers.ts`
- `backend-hono/src/routes/desk-calendar/ics-parser.ts`
- `electron/main.cjs`
- `frontend/contexts/ToastContext.tsx`

Plan:

- Reproduce the `Add to Calendar` flow in Electron and web. Confirm whether the click downloads `.ics`, opens a TradingView/Google handler, or is swallowed by iframe sandboxing.
- In Electron, verify the `.ics` interceptor still emits `desk-calendar:saving`, `desk-calendar:saved`, and `desk-calendar:failed`; issue #234 says the UI no longer reacts despite S46 claiming it shipped.
- In frontend, subscribe to those IPC events in the active calendar component and show a status line plus bottom-left toast.
- For web, add a fallback upload/drop or URL ingest flow if iframe `.ics` downloads cannot be intercepted outside Electron.
- Verify `desk_calendar_events` table migration exists and RLS allows the authenticated user path used by `handleIngestIcs`.
- Add a developer-settings countdown test button that launches `EconCountdownModal` with a synthetic event and a short countdown.
- Move event weight calibration out of Developer Settings and into Refinement Engine, replacing the old fuse controls.
- Ensure countdown time-to-print uses the backend economic event clock, not local-only mock state.

Acceptance:

- Clicking Add to Calendar stores a row in `desk_calendar_events`.
- UI shows saving, success, and failure states.
- Bottom-left toast fires on success and failure.
- Developer Settings has a test countdown button only; real calibration belongs in Refinement Engine.

## Track D: Arbitrum Logic, Naming, Layout, PMDB, and Trade Ledger

Issues: #232

Primary files:

- `frontend/components/arbitrum/ArbitrumChamber.tsx`
- `frontend/components/arbitrum/VerdictCard.tsx`
- `frontend/components/arbitrum/ArbitrumPeek.tsx`
- `frontend/components/narrative/Sanctum.tsx`
- `frontend/components/narrative/ArbitrumChamberPredictionCards.tsx`
- `frontend/components/narrative/InstrumentCardsRow.tsx`
- `frontend/components/narrative/SanctumEconIntel.tsx`
- `backend-hono/src/services/arbitrum/*`
- `backend-hono/src/services/cron/arbitrum-session-scheduler.ts`
- `backend-hono/src/services/brief-generator.ts`
- `backend-hono/src/services/autopilot/*`
- `frontend/components/proposals/*`
- `frontend/components/performance/*`

Plan:

- Verify all five Arbitrum seats receive persona-specific system prompts and role instructions. Current frontend labels are already partially renamed, but backend seat contract must match.
- Rename visible seats to Harper, Oracle, Feucht, Consul, Herald with subtitles: Lead Analyst, Forecaster, Future PM, Quantitative/Senior PM as approved, and Skeptic for the bear-case role.
- Replace `Neutral` market state copy with `Chop` in Arbitrum-facing summaries where applicable.
- Rename Desk Theme to Desk Plan everywhere visible and backend-adjacent. Preserve table/column names only if migration risk is unnecessary.
- Remove gray backgrounds from Desk Plan cards and Arbitrum hero subcards; preserve Solvys Gold flat/accent language.
- Align Volatility Read and Arbitrum Chamber headers and enforce 50/50 widths in the main hero container.
- Remove duplicate chart rendering when TradingView iframe is off; put analysis under the consensus card, not in a second chart/analysis block.
- Remove upload button from toolbar.
- Replace lightning update icon with a refresh icon plus `Update` label.
- Remove VIX component score explanatory sentence from Volatility Read.
- Convert confidence display from percent to 0.0-10.0 everywhere in agent mini-cards and verdict confidence.
- Replace Crowd Fuse with IV score and Health Fuse with Confidence Rating 0.0-10.0.
- Clarify instrument fuses: document expected move calculation, source of points range, price source, session horizon, and direction/rotation assumptions.
- Fix PMDB freshness handoff by tracing `brief-generator.ts` Chamber Read injection and `arbitrum-session-scheduler.ts` output storage. PMDB should include latest 17:00 session or explain missing state.
- Remove Agent Performance from Arbitrum and move campaign performance to `Performance > Agents`.
- Treat prediction-market trades as proposals. Add/verify approval/denial through Proposals pane, remove `Signals` from that pane, add market-resolve countdown column in Trade Ledger, and write resolved wins/losses to agent performance.
- Remove category pill from Active Narratives.
- Add right-justified `time ago` on related headlines inside Risk Signals.

Acceptance:

- Arbitrum seat output is persona-specific and stored with role metadata.
- UI uses Desk Plan, Harper/Oracle/Feucht/Consul/Herald, Skeptic, and Chop consistently.
- Hero layout is 50/50 at desktop and usable at mobile widths.
- PMDB includes a fresh Chamber Read after the scheduled Arbitrum run.
- Trade proposals resolve into agent performance records.

## Track E: Agentic Forum Run UX, Plan Mode, and Persistence

Issues: #233

Primary files:

- `frontend/components/consilium/AgentChattr.tsx`
- `frontend/components/consilium/BoardroomAgentPanel.tsx`
- `frontend/components/consilium/DeliberationKPIOverlay.tsx`
- `frontend/components/consilium/DAGProgressBar.tsx`
- `frontend/lib/agentStreamParser.ts`
- `frontend/lib/boardroomThreadStore.ts`
- `frontend/hooks/useBoardroomDAG.ts`
- `backend-hono/src/services/boardroom-store.ts`
- `backend-hono/src/services/boardroom-spawner.ts`
- `backend-hono/src/services/agent-bus/dag-scheduler.ts`
- `backend-hono/src/routes/index.ts`

Plan:

- Activity panel must default closed. Move Harper Ops activity affordance into Refinement Engine as a right-justified button beside scoring/approval controls.
- In Agentic Forum, remove search bar, refresh icon, activity button, and thinking button from chat input.
- Replace activity button with run-history button.
- Replace online/offline copy with running progress while active and persisted thought-time duration after completion.
- Stop auto-collapsing analyst panels when Harper starts. Issue #233 says completed synthesis disappears; preserve completed runs as expandable cards.
- Use `parseAgentText` as a safety net but fix prompts/contracts so agents stream prose plus structured metadata, not raw JSON as primary output.
- Add per-agent KPI/fuse widgets during deliberation: blended IV score, confidence 0.0-10.0, bias, and risk posture. Use same notched fuse anatomy as Arbitrum.
- Build final expandable run card with rendered Markdown/rich text, no raw JSON, proper ampersand rendering, and per-agent `read their work` sections.
- Persist every DAG run as a run record, not just boardroom transcript. Include prompt, selected purpose, plan, agent outputs, extracted KPIs, elapsed time, status, and timestamps.
- Add run history sidebar/popover that can reopen old runs like chat history.
- Add pre-run plan-mode modal: multiple-choice questions for run type and reason, CAO-generated markdown plan in right popover, CTAs `Send to desk` and `Keep editing`.
- Remove emojis in `boardroom-spawner.ts` output strings. They conflict with current global project rules and surface as UI noise.

Acceptance:

- A run can be started, watched, completed, expanded, reloaded, and reopened from history.
- No raw JSON is displayed to the user during or after deliberation.
- Agent cards show readable work and score fuses.
- The Forum is quieter: no search, refresh, activity, or thinking button clutter.

## Track F: Chat Interface, Connectors, Attachments, Mobile Response, and Approvals

Issues: #231

Primary files:

- `frontend/components/ChatInterface.tsx`
- `frontend/components/chat/FintheonComposer.tsx`
- `frontend/components/chat/FintheonThread.tsx`
- `frontend/components/chat/ChatGreeting.tsx`
- `frontend/components/chat/ChatHeader.tsx`
- `frontend/components/chat/ChatMessageBubble.tsx`
- `frontend/components/chat/HeadlinePickerPopover.tsx`
- `frontend/components/ui/chatgpt-prompt-input.tsx`
- `frontend/components/layout/ChatPanel.tsx`
- `frontend/components/feed/RiskFlowDetailCard.tsx`
- `frontend/components/narrative/*`
- `frontend/components/refinement/*`
- `mobile/components/**/chat*`
- `backend-hono/src/services/harper-handler.ts`
- `backend-hono/src/routes/harper-*`
- `backend-hono/src/routes/mcp/index.ts`

Plan:

- Fix greeting/suggestion chips reappearing after a send. Greeting should only show for empty thread/initial state.
- Purge visible Omi references and connector entries. Rename allowed residual voice/backend references to Harper Voice/Harper only when safe; DB column migrations can remain pending if coordinated separately.
- Connectors list should only show VProxy/Hermes/MCP/API tools that actually work plus RiskFlow. Remove dead entries.
- Fix jump-to-bottom false positive when attach modal is open. The button must account for modal bounds and disabled state.
- Add document attachments for PDF and `.md` only. Reject all other files client-side and server-side.
- Add CAO document parsing route or reuse VProxy parsing if already present. Store parsed text with file metadata and pass summarized context into Harper.
- Diagnose mobile chat response bottleneck after thinking. Trace stream completion in mobile chat hook, response body parsing, and final message append path.
- Add approval modal for tool approvals and add/edit approvals for Narratives, Catalyst Watch/Bulletin, and Refinement Engine edits. Gate with Admin Access password modal and smooth fade/stream-down transition.
- Replace RiskFlow Chat CTA raw JSON injection with an iOS-style preview card containing headline, notched fuse, and time ago, then pass structured context to the user side of chat.
- Resize chat input bar to match persona selector height.
- Replace think-harder icon with Deep Research Skill trigger that starts an Arbitrum-powered Agentic Forum run and inserts a preview card linking to the run.
- Add SOTA todos to desktop chat interfaces only; exclude mobile.
- Loader/spinner work should be one shared component. Use the requested circular braille/radar language while honoring the project ban on decorative AI-sparkle effects.
- Text thinking phrase animation should use the project-approved transition token language. If interpreted as prohibited shimmer, implement a subtle Solvys Gold sweep under `/solvys-transitions` naming rather than a generic sparkle shimmer.
- Evaluate whether dispatch can be retired in favor of direct VProxy API calls through Fintheon with shared chat history. Do this as a proposal after mobile response is fixed, not inside the same patch.

Acceptance:

- Desktop chat sends without greeting reset.
- Mobile chat receives and renders final assistant response.
- Attachments accept only PDF and Markdown and provide parsed context to Harper.
- Chat CTAs render cards, not JSON.
- Connector list contains no Omi or dead connector references.

## Track G: Shared Visual System and Fuse/Icon Cleanup

Issues: #231, #232, #233, #236

Primary files:

- `frontend/components/shared/NothingFuse.tsx`
- `frontend/components/shared/DigitGroup.tsx`
- `frontend/components/icons/*`
- `frontend/index.css`
- `frontend/components/feed/RiskFlowDetailCard.tsx`
- `frontend/components/RiskFlowMini.tsx`
- `frontend/components/narrative/econ/EconKpiFuses.tsx`
- `frontend/components/refinement/NotchedFuse.tsx`
- `frontend/components/consilium/BoardroomAgentPanel.tsx`
- `frontend/components/arbitrum/*`

Plan:

- Define a single fuse spec: horizontal and vertical, 10 notches by default, Doto numerals, value scale documented as either 0-1 or 0-10 at API boundaries.
- Audit all fuses in Arbitrum, Econ Pulse, instrument cards, RiskFlow cards, Agentic Forum, and Refinement Engine and migrate to shared spec.
- Add icon variants for X, globe, social network, and official source. Use simple line icons; no emoji glyphs.
- Remove borders around priority/severity tags where issue #236 calls them out.
- Make expanded RiskFlow cards transparent/consistent with parent card, removing the current discoloration between collapsed and expanded sections.
- Remove footer/header clutter in RiskFlow card expanded state so the hierarchy matches the X screenshot reference: source, headline, time, severity, then detail body.
- Ensure all new motion uses `solvys-transitions` tokens and respects reduced-motion.

Acceptance:

- Fuses look consistent app-wide.
- RiskFlow expanded cards do not have mismatched background blocks or bordered severity tags.
- Source icons distinguish X/social, official web/RSS, and generic web where allowed.

## Track H: Backend Hygiene, Tests, and Deployment Gates

Issues: #234 plus all tracks

Primary files:

- `backend-hono/src/routes/admin/riskflow-bulk.ts`
- `backend-hono/src/routes/*`
- `backend-hono/src/services/*`
- `supabase/migrations/*`
- `src/lib/changelog.ts`
- `frontend/**/*`
- `mobile/**/*`

Plan:

- Split `backend-hono/src/routes/admin/riskflow-bulk.ts`; changelog already flags it over 300 lines.
- Add route-level tests for source account create/update casing, riskflow rescore trigger, desk calendar ingest, and TradingView data-router fallback.
- Add UI smoke tests for Chat send, RiskFlow expanded card, Agentic Forum run card persistence, and calendar add status.
- Add diagnostics sections for TradingView router, source-account worker cache, latest Arbitrum PMDB handoff, and desk calendar ingest.
- Before implementation starts, capture screenshots for each issue area in the desktop app. Issue #234 explicitly requires screenshots with reproduction.
- After each track: run `npx tsc --noEmit --project frontend/tsconfig.json`; for backend tracks run `cd backend-hono && bun run build`; for frontend build run `rm -rf dist && npx vite build`; never start Vite dev server.
- Final validation must include backend diagnostics, RiskFlow feed, IV aggregate, latest Arbitrum, latest PMDB, desk calendar queue, and a mobile chat response check.

Acceptance:

- Backend build and frontend typecheck/build pass.
- Diagnostics expose the new health surfaces.
- No source file introduced or substantially modified remains over 300 lines.
- Changelog entry lands with changed files for each implementation pass.

## Recommended Execution Waves

Wave 1, parallel:

- Track A: RiskFlow Source Integrity and Refinement Persistence
- Track B: TradingView-First Data Layer and Econ Intelligence
- Track C: Calendar Save, Countdown, Toasts, and Developer Tools

Wave 2, parallel after Wave 1 contracts stabilize:

- Track D: Arbitrum Logic, Naming, Layout, PMDB, and Trade Ledger
- Track E: Agentic Forum Run UX, Plan Mode, and Persistence
- Track F: Chat Interface, Connectors, Attachments, Mobile Response, and Approvals

Wave 3, sequential unification:

- Track G: Shared Visual System and Fuse/Icon Cleanup
- Track H: Backend Hygiene, Tests, and Deployment Gates

## Reproduction Checklist Before Coding

- Desktop RiskFlow expanded card screenshot before/after.
- Refinement Engine source-account add/edit/save/rescore screen recording or screenshot sequence.
- Economic Calendar Add to Calendar click with backend/network logs.
- Developer Settings countdown test absence screenshot.
- Arbitrum hero layout and duplicate chart screenshot.
- PMDB latest fetch compared to latest Arbitrum verdict timestamp.
- Agentic Forum DAG run showing raw JSON and collapsed Harper card.
- Chat send showing greeting reset.
- Mobile chat request showing thinking completes but response does not render.

## Non-Regression Gates

- CAO chat must keep streaming and persisted conversation history.
- RiskFlow feed must keep approved X/wire items and official government/econ items.
- MDB/ADB/PMDB/TWT generation must not lose brief routes.
- Supabase JWT and super-admin gates must not be bypassed.
- Desktop install/update flow must not be touched outside explicit deploy work.
- No OpenRouter, DashScope, FMP, broad MSM, or Exa reintroduction.
- No emojis, gradients, Kanban borders, or AI-sparkle ornamentation in new UI.
