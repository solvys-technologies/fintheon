# Sprint Brief: S45-T1 — Day Card Data + Brain

## Context

Fintheon is collapsing three feeds (TradingView bars, RiskFlow news, IV scoring matrix) into a single prescriptive Day Card with one trading window, prices of interest, invalidation, profit target, and a Desk Theme message tying the idea to the day's brief catalyst. T1 owns the **server-side brain**: data fetching from TV bars, VWAP / POC / VAH / VAL math, plan generation via Sonnet/VProxy, the 15-min Desk Drift monitor, the green-days-only streak ledger driven off ProjectX balance delta, the day_plan_feedback collection table, and the inline Desk Theme block injected into existing scheduled briefs (MDB / ADB / PMDB / TWT). T2 owns every frontend surface in parallel; this brief stays out of `frontend/**` and `mobile/**` entirely.

## Branch Target

`s45-day-card` (shared with T2)

## Scope — Included

- [ ] **NEW** `backend-hono/src/services/day-plan/day-plan-service.ts` — orchestrates plan generation: pulls TV bars, computes math, generates Desk Theme via Sonnet, writes day_plans row
- [ ] **NEW** `backend-hono/src/services/day-plan/window-scheduler.ts` — weekly pre-population pass laying out trading-window TIMES for Mon–Fri from econ calendar + earnings catalysts
- [ ] **NEW** `backend-hono/src/services/day-plan/desk-theme-generator.ts` — Sonnet prompt composer + caller (claude-sonnet-4-6 via VProxy `http://localhost:8317`)
- [ ] **NEW** `backend-hono/src/services/day-plan/tv-bars-fetcher.ts` — wraps existing `services/skills/tradingview-trade-plan.ts` Claude Computer Use pattern; returns OHLCV bars for /NQ /ES /YM
- [ ] **NEW** `backend-hono/src/services/day-plan/vwap-poc-math.ts` — pure functions: time-anchored VWAP, POC (mode of price-volume histogram), VAH / VAL (70% volume around POC), expected-move (IV% × spot × √(time-to-event/365))
- [ ] **NEW** `backend-hono/src/services/day-plan/price-rounding.ts` — rounds entries to nearest 80- or 20-handle for /NQ, 5- or 10-handle for /ES, etc.
- [ ] **NEW** `backend-hono/src/services/desk-drift/drift-monitor.ts` — 15-min poll: scans `trades.entry_at > last_seen`, cross-checks against active windows, emits drift event if outside
- [ ] **NEW** `backend-hono/src/services/desk-drift/dead-volume-rule.ts` — pure rule: 45 min after last trading window ends = dead-volume zone
- [ ] **NEW** `backend-hono/src/services/desk-drift/drift-messages.ts` — three flavors gated by PsychAssist resonance + intraday P&L
- [ ] **NEW** `backend-hono/src/services/cron/day-plan-cron.ts` — weekday 6:15 ET, runs day-plan-service + writes canonical day_plan
- [ ] **NEW** `backend-hono/src/services/cron/streak-cron.ts` — weekday 16:00 ET, pulls ProjectX balance delta, writes day_plan_streaks row
- [ ] **NEW** `backend-hono/src/services/cron/drift-monitor-cron.ts` — every 15 min weekday session hours (08:00–17:00 ET), invokes drift-monitor
- [ ] **NEW** `backend-hono/src/routes/day-plan/handlers.ts` — `GET /today`, `GET /week`, `GET /streak`, `GET /drift-status`, `POST /feedback`, `GET /feedback?range=week`
- [ ] **NEW** `backend-hono/src/routes/day-plan/index.ts` — route registration
- [ ] **NEW** `backend-hono/src/types/day-plan.ts` — `DayPlan`, `DayPlanWindow`, `DayPlanFeedback`, `DayPlanStreak`, `DriftStatus`, `DriftKind` types — single source of truth, T2 mirrors
- [ ] **NEW** `supabase/migrations/{ts}_day_plan_tables.sql` — 4 tables: `day_plans`, `day_plan_windows`, `day_plan_feedback`, `day_plan_streaks` (filename pattern `YYYYMMDDHHMMSS_*.sql`)
- [ ] **EDIT** `backend-hono/src/services/brief-generator.ts` — splice Desk Theme block at lines 199–207 (after `chamberSection`, before `invokeAgent()`), pre-formatted text
- [ ] **EDIT** `backend-hono/src/services/harper-handler.ts` — CAO override path: detect "redo today's plan" intent, call day-plan-service with override flag, return regenerated plan in chat
- [ ] **EDIT** `backend-hono/src/services/psych-assist/lockout-protocol.ts` — apply -5 non-healing ER score on Drift Alert; log "drifted from desk theme" infraction via `writeAnnotation()` (refinement_annotations)
- [ ] **EDIT** `backend-hono/src/services/projectx-sync.ts` — FIX inserts to include `user_id` (currently NULL — flagged in code)
- [ ] **EDIT** `backend-hono/src/services/autopilot-scheduler.ts` — same `user_id` fix
- [ ] **EDIT** `backend-hono/src/index.ts` — mount `/api/day-plan` routes
- [ ] **EDIT** `src/lib/changelog.ts` — append T1 entry

## Scope — Excluded (DO NOT TOUCH)

- All of `frontend/**`
- All of `mobile/**`
- `frontend/components/narrative/Sanctum.tsx`
- `frontend/components/StickyBulletin.tsx`
- `frontend/components/journal/*`
- `mobile/components/bulletin/*`

## Reuse Inventory (existing code to call, not reinvent)

- `backend-hono/src/services/skills/tradingview-trade-plan.ts` — **established** Claude Computer Use TV bars pattern. Wrap it with `tv-bars-fetcher.ts`; do not duplicate the session-spawn logic.
- `backend-hono/src/services/iv-scoring/computation.ts:53–92` — `getVIXMultiplier()`, `continuousVIXMultiplier()`. Feed into expected-move math (`expectedMove = spot × IV% × VIXMultiplier × √(timeToEvent / 365)`).
- `backend-hono/src/services/market-data/orb-price-service.ts` — adjacent module; structurally similar. Use `getIntradayBars()` import pattern. Yahoo fallback path is here if TV Computer Use ever fails — wire as backstop only.
- `backend-hono/src/services/strands/index.ts` `invokeAgent()` — VProxy gateway path. Pass `model: "claude-sonnet-4-6"`, `baseURL: "http://localhost:8317"`. desk-theme-generator calls this.
- `backend-hono/src/services/supabase-service.ts:1511–1534` — `writeAnnotation(ann)`. Use for "drifted from desk theme" infraction. Set `flawTag: "desk-drift"`, `comment: "<short context>"`, `createdBy: "system"`.
- `backend-hono/src/types/calibration.ts:14–31` — `RefinementAnnotation` interface. Reuse, don't redefine.
- `backend-hono/src/routes/projectx/trades.ts:29–62` — read pattern for trades polling. Use the same SELECT shape in drift-monitor.
- `backend-hono/src/services/cron/arbitrum-session-scheduler.ts:17` — cron registration pattern (`"0 17 * * 1-5"`). Mirror for day-plan (`"15 6 * * 1-5"`), streak (`"0 16 * * 1-5"`), drift (`"*/15 8-17 * * 1-5"`).
- `backend-hono/src/services/riskflow/handlers.ts` — `/api/riskflow/iv-aggregate` endpoint. Use as catalyst weighting input to window-scheduler.
- `supabase/migrations/20260421000000_trades_base.sql` — current `trades` schema. Reference for FK if needed; do not modify.

## Known Issues to Preserve

- `projectx-sync.ts` and `autopilot-scheduler.ts` currently insert into `trades` with **NULL `user_id`** (code comment: "needs fixing"). T1 fixes forward. **Historical rows** stay NULL; orchestrator runs a one-time backfill script at unification — do NOT attempt the backfill from inside this track.
- `arbitrum/types.ts` carries a `calibration_watermark` field. Stored but never consumed. Leave it alone — out of scope.
- `arbitrum/gates.ts` has a comment about "calibration service (S27/S28) expected to overwrite." That work is permanently shelved (see plan file). Do not implement S27/S28.
- Recent changelog entries (last 14 days) reflect intentional S43/S44 work — no rollback or "cleanup" passes inside files those sprints touched.

## Implementation Steps

1. **Migration first.** Write `supabase/migrations/{YYYYMMDDHHMMSS}_day_plan_tables.sql`. Tables:
   - `day_plans (id uuid pk, team_id text default 'pic', date date, event_name text, desk_theme text, generated_by text, generated_at timestamptz, source_brief_id uuid)`
   - `day_plan_windows (id uuid pk, day_plan_id uuid fk, window_index int, start_time time, end_time time, prices_of_interest numeric[], invalidation numeric, profit_target numeric, expected_move_pct numeric)`
   - `day_plan_feedback (id uuid pk, window_id uuid fk, user_id uuid, action text check (action in ('followed','faded','sat_out')), reason_code text, reason_text text, fill_price numeric, outcome_pnl numeric, created_at timestamptz default now())`
   - `day_plan_streaks (id uuid pk, user_id uuid, date date, daily_pnl numeric, daily_color text check (daily_color in ('green','red','flat')), streak_at_close int, created_at timestamptz default now(), unique(user_id, date))`
   - RLS: service_role full; users SELECT own (`auth.uid() = user_id`).
   - Run via `supabase db push` from main worktree (NEVER MCP apply).
2. **Types.** Write `backend-hono/src/types/day-plan.ts` exporting all interfaces. T2 mirrors verbatim.
3. **Math module.** `vwap-poc-math.ts` pure functions; unit-testable. Export: `timeAnchoredVWAP(bars, anchorTs)`, `pointOfControl(bars)`, `valueArea(bars, threshold=0.7)`, `expectedMove(spot, ivPct, daysToEvent, vixMultiplier)`.
4. **TV bars fetcher.** `tv-bars-fetcher.ts` wraps `services/skills/tradingview-trade-plan.ts`. Single Claude Computer Use session pulls bars for /NQ, /ES, /YM in one shot (cost optimization). Returns `{ symbol, bars: OHLCV[] }[]`.
5. **Desk Theme generator.** `desk-theme-generator.ts` builds prompt with: top RiskFlow catalyst, IV score, computed window + prices. Calls Sonnet via VProxy. Returns 1-sentence theme message.
6. **Day-plan service.** `day-plan-service.ts` orchestrator: window-scheduler → tv-bars-fetcher → vwap-poc-math → price-rounding → desk-theme-generator → write day_plan + day_plan_windows. Idempotent on `(team_id, date)`.
7. **Cron registrations.** Register the 3 crons in the same place existing crons live (`backend-hono/src/index.ts` or a cron-bootstrap module — check existing pattern).
8. **Drift monitor.** `drift-monitor.ts` SELECT trades `WHERE entry_at > last_seen`. For each, classify against active day_plan_windows + dead-volume-rule. Compute resonance (call PsychAssist `evaluateLockout()`). Pick message flavor. Persist last-seen watermark in a small `desk_drift_state` Redis key OR append-only Supabase row.
9. **PsychAssist hook.** `lockout-protocol.ts` extension: when drift fires, apply -5 non-healing ER offset (store as a `er_drift_offset` column or in-memory map keyed by user/date), AND `writeAnnotation({ flawTag: "desk-drift", comment, createdBy: "system" })`.
10. **ProjectX user_id fix.** Both `projectx-sync.ts` and `autopilot-scheduler.ts`: pull `user_id` from session/auth context, include in INSERT. If no user context (autopilot), fall back to a `SYSTEM_USER_ID` env-configured constant.
11. **Streak cron.** `streak-cron.ts` 16:00 ET: for each PIC user, fetch ProjectX `accountBalance` start-of-day vs end-of-day. Delta > 0 → green, < 0 → red, 0 → flat. UPSERT day_plan_streaks. Recompute `streak_at_close = previous_streak + 1` if green else `0`. Flat = preserve previous streak.
12. **Routes.** `routes/day-plan/handlers.ts`:
    - `GET /api/day-plan/today` → today's day_plan + windows for caller's team
    - `GET /api/day-plan/week` → next 5 weekday window-times from window-scheduler
    - `GET /api/day-plan/streak` → caller's current streak + last 30 days color array
    - `GET /api/day-plan/drift-status` → `{ in_window: bool, kind: "drift_alert"|"tilt_stop"|"dead_volume"|null, fired_at, message }`
    - `POST /api/day-plan/feedback` → INSERT day_plan_feedback (Zod validate body)
    - `GET /api/day-plan/feedback?range=week` → caller's feedback rows last 7 days
13. **Brief splice.** `brief-generator.ts:199–207`: pull today's day_plan, format the Desk Theme block (titles left, values right, monospace gutter), append to `chamberSection || ""` before `invokeAgent()`. Single function, pre-formatted text.
14. **Harper override.** `harper-handler.ts`: in the intent classifier (find existing one), add intent `regenerate_plan`. On match, call `day-plan-service.regenerate({ override_reason })`, format response, send back to chat.
15. **Mount routes.** `backend-hono/src/index.ts`: `app.route('/api/day-plan', dayPlanRoutes)`.
16. **Changelog entry.** Append to `src/lib/changelog.ts` (NOT `backend-hono/.../changelog`):
    ```ts
    { date: '2026-04-26THH:mm:ss', agent: 'claude-code', summary: 'S45-T1: day-plan-service + Desk Drift + streak ledger + Desk Theme brief block', files: ['backend-hono/src/services/day-plan/*', 'backend-hono/src/services/desk-drift/*', 'backend-hono/src/routes/day-plan/*', 'supabase/migrations/...', 'backend-hono/src/services/brief-generator.ts', 'backend-hono/src/services/harper-handler.ts'] }
    ```

## Acceptance Criteria

- [ ] `supabase db push` clean — 4 new tables, RLS in place
- [ ] `GET /api/day-plan/today` returns full day_plan with at least one window populated (after 6:15 ET cron has run)
- [ ] `GET /api/day-plan/week` returns 5 weekday entries with `{day, ivScore, windowCount, eventName}`
- [ ] `POST /api/day-plan/feedback` writes row, returns 200 with row id
- [ ] `GET /api/day-plan/streak` returns `{streak_at_close, last_30: [{date, color}]}`
- [ ] `GET /api/day-plan/drift-status` returns null when in-window, populated drift object otherwise
- [ ] 15-min drift cron fires Drift Alert when fill outside window; Tilt-stop when ER score unhealthy; Dead Volume Warning when stable + green + 45min after window
- [ ] PsychAssist applies -5 non-healing ER offset on drift; `refinement_annotations` row exists with `flawTag: "desk-drift"`
- [ ] 16:00 ET streak cron writes day_plan_streaks row using ProjectX balance delta
- [ ] Brief generator inline Desk Theme block appears in MDB / ADB / PMDB / TWT prompts (verify via test invocation)
- [ ] Harper-chat: prompt "redo today's plan because CPI got pushed" returns a regenerated day_plan
- [ ] `projectx-sync.ts` + `autopilot-scheduler.ts` insert `trades.user_id` correctly (verify with new fill)
- [ ] `cd backend-hono && bun run build` clean
- [ ] All curl smokes return 200 + valid JSON

## Validation Commands

```bash
# Type check
cd backend-hono && npx tsc --noEmit

# Backend build
cd backend-hono && bun run build

# Start backend (launchd-managed; restart after deploy)
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Curl smoke
curl -s localhost:8080/api/day-plan/today | jq .
curl -s localhost:8080/api/day-plan/week | jq .
curl -s localhost:8080/api/day-plan/streak | jq .
curl -s localhost:8080/api/day-plan/drift-status | jq .
curl -s -X POST localhost:8080/api/day-plan/feedback \
  -H 'Content-Type: application/json' \
  -d '{"window_id":"<uuid>","action":"followed"}' | jq .

# Migration (run from main worktree, NOT MCP)
cd ~/Documents/Codebases/fintheon && supabase db push
```

## Commit Format

```
[v5.31.0] feat: S45-T1 day-plan service + Desk Drift + streak ledger + Desk Theme brief block
```

## Banned ornaments

No emojis. No AI sparkles. No gradients-as-fills (the visual rule is enforced in T2; T1 outputs are data, not pixels — but Desk Theme messages from Sonnet must be plain text, no decorative glyphs).

## Open Questions (non-blocking)

- ProjectX API auth shape for streak-cron — confirm session token pattern with existing `projectx-sync.ts`
- TV Computer Use cost ceiling — propose monitoring envelope to TP at unification
- `trades.user_id` historical backfill — orchestrator runs at Wave 2, not in-track
