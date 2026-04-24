# Sprint Brief: S31-T7 — Harper Advisory Layer + Calendar Countdown Pill + Autopilot Guardian + Blindspots UI Wiring

## Context

Sprint 2 (Harper 2.1). Advisory layer — the passive, non-intrusive side of Harper. No push-nudges here (the one allowed push is over-trading, owned by T6). This track covers:

1. **Calendar countdown pill** in the heading toolbar — static and always-on. Fades in 5 minutes before any econ event with a brief overview ("FOMC — 5 min"). Independent of PsychAssist.
2. **Autopilot guardian** — supervises the autopilot scheduler using **non-psych signals only**: drawdown from high-water mark, stop-loss violations, position-size caps. Pauses autopilot when thresholds trip; resumes after cooldown. Never tied to tilt. Runs regardless of PsychAssist toggle.
3. **Position-size suggestion** — passive, surfaced when user opens the order ticket. Harper computes a suggested size based on recent P&L and account balance; user decides. Never enforced.
4. **Blindspots UI wiring** — connects `BlindspotsRow` (built by S30-T2) to T6's `/api/blindspots/*` endpoints. PsychAssist OFF = empty state "Enable PsychAssist in settings to populate."
5. **"Watchouts" surface** — silent log of strategy-drift observations and calendar-event proximity. No nudges, no interrupts. User reviews on their own time on the Performance tab.

## Branch Target

`s31-harper-2-1`

## Scope — Included

### Calendar countdown pill (heading toolbar)

- [ ] New component `frontend/components/layout/CalendarCountdownPill.tsx`:
  - Mounts in the heading toolbar (find the action cluster in `frontend/components/chat/ChatHeader.tsx` or the app-level header)
  - Polls `/api/calendar/next-event` every 60s (or subscribes to an existing econ calendar SSE if one exists)
  - When next event is ≤ 5 minutes away: fade in over 300ms, show `{eventName} — {minutesRemaining} min` with a brief overview tooltip on hover
  - When event starts (or passes): fade out over 400ms
  - Pill styling: flat `rgba(10,9,5,0.85)` bg, thin `#c79f4a` 1px border, no blur, no box-shadow
  - Pointer-events: auto for hover tooltip; no click action
- [ ] Backend route `backend-hono/src/routes/calendar/next-event.ts`:
  - `GET /api/calendar/next-event?within=300` (seconds)
  - Returns `{ event: { name, time, impact, brief } | null }` or null if nothing within window
  - Sources from existing econ calendar service (grep for `/api/riskflow/*calendar*` or `econ` service — reuse if present, otherwise thin wrapper around existing calendar data)

### Autopilot guardian (non-psych)

- [ ] New service `backend-hono/src/services/autopilot/guardian.ts`:
  - Non-psych supervisor of the autopilot-scheduler
  - Monitors three signals:
    - **Drawdown** — if realized + unrealized P&L drops ≥ configured % below session high-water mark → pause
    - **Stop-loss violation** — if a position held past its defined stop without exit → pause + write an alert
    - **Position-size cap** — if notional > user's configured cap → block the pending autopilot order and pause
  - Cooldown: 10 min after pause, re-check conditions, auto-resume if clear
  - Caps + thresholds read from `user_preferences.prefs.autopilotGuardian: { drawdownPctCap, positionNotionalCap, stopLossToleranceMin }` (add to FusePalette/prefs shape — coordinate with T6 prefs edit)
- [ ] Wire guardian into `autopilot-scheduler.ts` as a pre-order check + post-fill monitor
- [ ] Add route `POST /api/autopilot/guardian/resume` (manual override, auth-gated) for user to resume earlier than cooldown
- [ ] Diagnostics: extend `/api/diagnostics` with `autopilot: { status: 'active' | 'paused' | 'disabled', reason: string | null, resumesAt: iso | null }`

### Position-size suggestion (passive)

- [ ] New service `backend-hono/src/services/advisory/size-suggestion.ts`:
  - Input: user, contract, proposed size, account balance, recent P&L (last 5 trades)
  - Output: `{ suggestedSize: number, reasoning: string }` — reasoning is ONE sentence
  - Rules (deterministic):
    - If last 3 trades are losses: suggest 50% of user's default size
    - If account balance < 80% of yesterday's open: suggest 75% of user's default size
    - Else: suggested = proposed (no downsize)
  - No LLM call; deterministic formula
- [ ] New endpoint `GET /api/advisory/size?contract=ES&proposedSize=2` — returns suggestion
- [ ] Frontend: hook into the order ticket component (grep for the existing ticket/order form). On open, fetch suggestion; if `suggestedSize < proposedSize`, render a passive hint line: "Harper suggests **1 contract** for today — recent drawdown detected." User clicks through or ignores.

### Blindspots UI wiring

- [ ] Update `frontend/components/journal/BlindspotsRow.tsx` (built by S30-T2) to fetch from T6's endpoints:
  - `GET /api/blindspots/psych?date=today` → left column (psych blindspots)
  - `GET /api/blindspots/trading?date=today` → right column (trading blindspots)
  - Each entry renders: pattern title, one-line evidence, corrective action
  - When PsychAssist is OFF (check `user_preferences.prefs.psychAssistEnabled`): replace both columns with a single empty-state card: "Enable PsychAssist in settings to populate your blindspots."
  - Loading state: skeleton rows, no spinner
  - Empty state (PsychAssist ON, no blindspots today): "No blindspots detected for this session."

### Watchouts surface (silent log)

- [ ] New table `backend-hono/migrations/037_watchouts.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS watchouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ts TIMESTAMPTZ NOT NULL DEFAULT now(),
    kind TEXT NOT NULL,             -- 'calendar_proximity' | 'strategy_drift_observation'
    detail TEXT NOT NULL,
    resolved_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_watchouts_user_ts ON watchouts(user_id, ts DESC);
  ALTER TABLE watchouts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY watchouts_owner ON watchouts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ```
- [ ] Logger service writes `calendar_proximity` entries when a trade fires within 5 min of a high-impact event (no nudge)
- [ ] Logger service writes `strategy_drift_observation` entries when a trade deviates from user's stated plan (no nudge)
- [ ] New route `GET /api/watchouts?from=...` — auth-gated, returns array
- [ ] Performance tab: new compact subsection below BlindspotsRow showing recent watchouts (orchestrator wires in Wave 3 merge if not included in S30-T2's layout)

### Changelog + headers

- [ ] Changelog entry
- [ ] `// [claude-code 2026-04-23] S31-T7 advisory + calendar pill + autopilot guardian + blindspots wire` on modified files

## Scope — Excluded (DO NOT TOUCH)

- PsychAssist toggle itself, blindspot generation, ER monitor, over-trading nudge — T6 owns
- Voice orb / Omi sidebar chat — T8
- Streamdown + TV charts — T5
- Consul Control corners — T4
- Any strategy-drift **push-nudge** — explicitly out of scope (silent log only, via Watchouts)
- Hard order-placement blocking — explicitly out of scope per user direction (autopilot will own this later)

## Known Issues to Preserve

- Calendar pill runs independent of PsychAssist — it's static/always-on per user direction.
- Autopilot guardian is non-psych — no tilt signal wired here. It uses drawdown, stop violations, size caps only.
- Position-size is a **suggestion**, never enforced.
- Watchouts are silent — no push, no toast, no voice.
- Memory: `feedback_supabase_migration_filenames.md` — local SQL files only, hand to TP for `supabase db push`.

## Implementation Steps

1. Build `CalendarCountdownPill.tsx` + its backend route; wire to existing calendar data.
2. Build `guardian.ts`; integrate into autopilot-scheduler; extend diagnostics.
3. Build `size-suggestion.ts` + endpoint; wire order ticket.
4. Migration `037_watchouts.sql`; hand to TP.
5. Build watchouts logger service + route; call logger from existing trade-completion hooks for calendar-proximity and strategy-drift detection (deterministic rules only — no LLM).
6. Wire BlindspotsRow to T6's endpoints with PsychAssist-off empty state.
7. Changelog + headers.

## Acceptance Criteria

- [ ] Calendar pill fades in 5 min before next high-impact event and fades out after; always-on regardless of PsychAssist
- [ ] Autopilot guardian pauses on drawdown/stop/size triggers; auto-resumes after 10 min if clear; manual resume route works
- [ ] Order ticket shows "Harper suggests N contract(s)" line when suggestion differs from proposed
- [ ] BlindspotsRow reads live data with PsychAssist ON; shows empty-state CTA with PsychAssist OFF
- [ ] Watchouts table populates silently with no user-facing nudges
- [ ] `/api/diagnostics` includes `autopilot` status
- [ ] `bun run build` + `vite build` pass
- [ ] Changelog entry added

## Validation Commands

```bash
cd backend-hono && bun run build && cd ..
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build

# Calendar pill + guardian smokes
curl -s http://localhost:8080/api/calendar/next-event?within=300 | jq .
curl -s http://localhost:8080/api/diagnostics | jq '.autopilot'
curl -s "http://localhost:8080/api/advisory/size?contract=ES&proposedSize=2" | jq .
```

## Commit Format

```
[v5.23.0] feat: S31-T7 advisory layer + calendar countdown pill + autopilot guardian + blindspots UI wiring
```
