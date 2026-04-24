# Sprint Brief: S31-T6 — PsychAssist Gating + Psych & Trading Blindspots + ER Monitor + Over-Trading Nudges

## Context

Sprint 2 (Harper 2.1). Harper must remain **professional and on-demand**. All behavioral coaching sits behind the PsychAssist toggle. With PsychAssist OFF the platform silently records trades but runs zero psych logic — no scoring, no nudges, no blindspot generation.

With PsychAssist ON:

- ER monitor + infraction scoring active during trading hours
- Nightly **psych_blindspots** generation (revenge trades, size escalation, post-loss clustering, etc.)
- Nightly **trading_blindspots** generation — distinct category, covers: over-trading, over-leveraging, high-volatility environments, trading through news, not following plan
- **Only one push-nudge category fires**: over-trading. That's it. No strategy-drift nudges. No generic risk nudges. Over-trading threshold hits → voice nudge via Omi (if active) → "step away from the chart, take a break."

Blindspots generation uses a **template-first** approach: Harper picks from a predefined list of blindspot patterns + recommended actions. Fluid/custom generation is allowed only within the defined category boundaries. No drift outside the allowed list.

## Branch Target

`s31-harper-2-1`

## Scope — Included

### Migration

- [ ] `backend-hono/migrations/036_blindspots.sql`:

  ```sql
  CREATE TABLE IF NOT EXISTS psych_blindspots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    pattern TEXT NOT NULL,                  -- 'revenge_entry' | 'size_escalation' | 'post_loss_cluster' | 'fomo_entry' | ...
    evidence TEXT NOT NULL,                 -- short narrative from observed trades
    corrective_action TEXT NOT NULL,        -- from template
    severity INT CHECK (severity BETWEEN 1 AND 5),
    source TEXT NOT NULL DEFAULT 'template',-- 'template' | 'fluid'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS trading_blindspots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    pattern TEXT NOT NULL,                  -- 'over_trading' | 'over_leverage' | 'high_vol_env' | 'news_trading_early' | 'plan_deviation'
    evidence TEXT NOT NULL,
    corrective_action TEXT NOT NULL,
    severity INT CHECK (severity BETWEEN 1 AND 5),
    source TEXT NOT NULL DEFAULT 'template',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS idx_psych_blindspots_user_date ON psych_blindspots(user_id, date DESC);
  CREATE INDEX IF NOT EXISTS idx_trading_blindspots_user_date ON trading_blindspots(user_id, date DESC);

  ALTER TABLE psych_blindspots ENABLE ROW LEVEL SECURITY;
  ALTER TABLE trading_blindspots ENABLE ROW LEVEL SECURITY;
  CREATE POLICY psych_blindspots_owner ON psych_blindspots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  CREATE POLICY trading_blindspots_owner ON trading_blindspots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  ```

### Blindspot template library

- [ ] New file `backend-hono/src/services/blindspots/templates.ts`:
  - Export `PSYCH_BLINDSPOT_TEMPLATES: BlindspotTemplate[]` — patterns like:
    - `revenge_entry` — "Re-entered same contract within 2 min of a stop-out ≥ 3 times today"
    - `size_escalation` — "Size increased ≥ 2x after ≥ 2 consecutive losses"
    - `post_loss_cluster` — "≥ 4 trades within 5 min after a losing trade"
    - `fomo_entry` — "Entered within 30s of a trigger headline, no pre-planned level"
  - Export `TRADING_BLINDSPOT_TEMPLATES: BlindspotTemplate[]` — patterns:
    - `over_trading` — "≥ N trades today vs your 30-day avg of M"
    - `over_leverage` — "Notional exposure > 2x account limit at any point"
    - `high_vol_env` — "Traded during VIX > Y with no size reduction"
    - `news_trading_early` — "Entered within 5 min before a scheduled high-impact event"
    - `plan_deviation` — "Trade symbol/direction not in today's plan"
  - Each template has: `pattern`, `detect(trades, context): { hit: boolean; evidence: string }`, `correctiveAction: string`, `severity: 1-5`
  - Detection is **pure / deterministic** — no LLM in the detect step
- [ ] New file `backend-hono/src/services/blindspots/generator.ts`:
  - `generateBlindspots(userId, date): Promise<{ psych: Row[]; trading: Row[] }>`
  - Step 1: run every template's `detect()` against the day's trades + session_journal row
  - Step 2: for each hit, write a row with `source='template'` + template's corrective action
  - Step 3 (optional fluid pass): if a specific context doesn't match any template BUT shows anomalous patterns, call Harper via provider-chain (T3) with **strict system prompt** — "Generate a blindspot entry ONLY from these categories: [list]. Refuse if none apply. Return JSON." Write result with `source='fluid'`. Hard-fail closed — if the model drifts outside the list, discard.

### PsychAssist gating

- [ ] Add column to `user_preferences` prefs JSONB: `psychAssistEnabled: boolean` (default false)
- [ ] New helper `backend-hono/src/services/psych/is-psych-assist-on.ts` — single source of truth — returns boolean for a given userId
- [ ] All psych routines check this first:
  - Nightly blindspots Routine skips user if off
  - ER monitor no-ops if off
  - Session journal discipline/emotional_control fields stay nullable — user can still fill manually; Hermes auto-summary skips when off
- [ ] Frontend: new setting toggle `frontend/components/settings/PsychAssistToggle.tsx` (or add to existing settings panel). Writes to `user_preferences.prefs.psychAssistEnabled`.

### ER monitor + over-trading nudge (PsychAssist ON only)

- [ ] New service `backend-hono/src/services/psych/er-monitor.ts`:
  - Tracks trade velocity, size escalation, stop-out clustering in-memory per user
  - Emits structured events on threshold hit: `{ kind: 'over_trading', userId, evidence, suggestedAction }`
  - **Only the `over_trading` kind emits a push-nudge.** All other observations are logged silently for blindspots generation only.
- [ ] Push-nudge surface: when `over_trading` fires AND (Omi session active OR user has opted into chat toast notifications), deliver a single nudge:
  - Voice: "You've placed 12 trades in the last 30 minutes, well above your average. Step away from the chart for 10 minutes."
  - Chat toast (fallback): short Harper message in the sidebar chat
  - **Rate-limit:** max 1 over-trading nudge per 60 minutes per user
- [ ] No strategy-drift nudges. No calendar-event nudges. Only over-trading.

### Nightly Routine

- [ ] New endpoint `backend-hono/src/routes/harper-ops/blindspots-nightly.ts` — Routine-secret-gated POST
  - Iterates users with `psychAssistEnabled=true`
  - Runs `generateBlindspots` for yesterday
  - Writes rows to both tables
- [ ] Routine doc `docs/routines/blindspots-nightly.md` — Mon–Sat 3am ET (for TP to wire)

### API routes for Performance tab

- [ ] `backend-hono/src/routes/blindspots.ts`:
  - `GET /api/blindspots/psych?date=YYYY-MM-DD` → rows for the user on that date (auth-gated)
  - `GET /api/blindspots/trading?date=YYYY-MM-DD` → same
  - `GET /api/blindspots/latest` → most recent date's rows from both tables
- [ ] Mount in `routes/index.ts` (append, coordinate with other tracks)

### Types

- [ ] Append to `shared/index.ts`:
  ```ts
  export interface Blindspot {
    id: string;
    userId: string;
    date: string;
    pattern: string;
    evidence: string;
    correctiveAction: string;
    severity: 1 | 2 | 3 | 4 | 5;
    source: "template" | "fluid";
    createdAt: string;
  }
  ```

### Changelog + headers

- [ ] Changelog entry
- [ ] `// [claude-code 2026-04-23] S31-T6 psych/trading blindspots + er monitor + over-trading nudges` on modified files

## Scope — Excluded (DO NOT TOUCH)

- `session_journal` table — S30-T3 owns it
- Blindspots row UI on Performance tab — S30-T2 owns the `BlindspotsRow` component; T7 wires it to these endpoints
- Voice orb wiring, Omi sidebar chat — T8 territory
- Autopilot guardian signals — T7 territory (non-psych)
- Calendar countdown pill — T7 territory
- Any strategy-drift logic — explicitly out of scope per user direction

## Known Issues to Preserve

- Memory: `feedback_supabase_migration_filenames.md` — local SQL files only, hand to TP. Do NOT use `apply_migration`.
- Memory: `feedback_no_key_caution_lectures.md` — don't lecture on rotation/exposure.
- Blindspot generation must **stay strictly within the defined pattern list**. If the fluid LLM pass returns anything not in the allowed category list, discard it — no writes. Guard with a server-side allowlist check.
- Rate-limit on over-trading nudge is non-negotiable: max 1 / 60 min / user.
- PsychAssist OFF must be truly silent: no event emission, no counters running, no background inspection of trades.

## Implementation Steps

1. Write migration `036_blindspots.sql`; hand to TP.
2. Build template library with deterministic detect functions + unit-style sanity check in the file.
3. Build generator (template-first, fluid-fallback with strict allowlist).
4. Add `psychAssistEnabled` to prefs + gating helper.
5. Build ER monitor service; wire only over-trading kind to push-nudges via T8's Omi/chat surface (coordinate interface).
6. Build nightly endpoint + routes.
7. Wire Performance tab endpoints.
8. Smoke: toggle PsychAssist off → verify zero events/rows generated; toggle on → run nightly manually, verify template hits appear.
9. Changelog + headers.

## Acceptance Criteria

- [ ] Migration applied; two blindspot tables + RLS live
- [ ] PsychAssist OFF for user → nightly Routine writes zero rows for that user; ER monitor dormant
- [ ] PsychAssist ON → nightly writes template hits; only over-trading nudge category fires push-nudges
- [ ] Rate limit honored (test: trigger 3 over-trading events in 10 min, only first nudges)
- [ ] Fluid-pass guard rejects any blindspot outside the allowed pattern list
- [ ] `GET /api/blindspots/psych?date=` returns user's rows, 401 if unauthenticated
- [ ] `bun run build` passes
- [ ] Changelog entry added

## Validation Commands

```bash
cd backend-hono && bun run build && cd ..
npx tsc --noEmit --project frontend/tsconfig.json

launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# PsychAssist-off sanity
curl -s http://localhost:8080/api/blindspots/psych?date=2026-04-23 | jq .

# Trigger nightly (Routine secret)
curl -s -X POST http://localhost:8080/api/harper-ops/blindspots-nightly \
  -H "x-routine-secret: $ROUTINE_SECRET" | jq .
```

## Commit Format

```
[v5.23.0] feat: S31-T6 psych + trading blindspots + ER monitor + over-trading nudges (PsychAssist-gated)
```
