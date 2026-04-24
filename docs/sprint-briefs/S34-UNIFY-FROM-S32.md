# S34 Unification Brief — reconciling s32-harper-2-1 work into the active sprint

**Prepared:** 2026-04-24 · claude-code · Opus 4.7 (1M)
**Active sprint branch:** `s34-t10-backfill-orchestrator` (currently at v5.22.9 per package.json)
**Source branch:** `s32-harper-2-1` — all of yesterday/today's shipped work lives here, tagged `v5.23.6`

The S32 window shipped 4 releases (v5.23.3 → v5.23.6) that are **live on production** — Fly backend, both Vercel targets, and the GH release assets. S34 currently has none of that code. This doc lists what needs to come across, what's safe to drop, and where the sharp edges are.

---

## 1. What's live on prod right now (must reconcile)

Every bullet below is on `fintheon.fly.dev`, `fintheon-alpha.vercel.app`, and `fintheon.pricedinresearch.io`. If S34 merges without cherry-picking these, prod rolls back.

### v5.23.3 — Claude Routines retired

- Removed `backend-hono/src/services/routines/` + `backend-hono/src/routes/routines/`
- Removed `frontend/components/refinement/RoutinesConsole.tsx`, `RoutineDetailModal.tsx`, `MonitoringLoopCard.tsx`
- Moved `services/routines/handlers/news-worker-audit.ts` → `services/cron/news-worker-audit-handler.ts`
- Inlined cron schedules into `services/cron/news-worker-audit-scheduler.ts` (6:00/11:30/16:00 ET)
- Removed `REFLECT_VIA_ROUTINE`, `PREDICTION_RESOLVER_VIA_ROUTINE`, `MARKET_IMPACT_VIA_ROUTINE` gates from each scheduler
- Removed `getRoutine` + `recordRun` block from `harper-ops/index.ts /feed`
- Removed `/api/routines` mount + `initRoutinesStore` from `boot/services.ts`
- `AdminShell` reduced to 2 tabs (Scoring + Approvals)

**⚠ S34 conflict:** `s34-t10-backfill-orchestrator/backend-hono/src/boot/services.ts` still imports `initRoutinesStore`. When S34 merges, either reinstate the routines code OR drop the initRoutinesStore import from S34's boot file. The latter is correct — Routines are dead on Fly.

### v5.23.4 — Polymarket scope guardrails + per-category agent scorecards

- **Migration** `supabase/migrations/20260424010000_polymarket_predictions_guardrails.sql` — adds `category`, `market_close_at`, `reasoning`, `catalyst_source` columns + CHECK constraints (category in allowlist, market_close_at ≤ created_at + 7 days) + 2 partial indexes
  - **Status:** pushed by TP via `supabase db push` ✓ live
- `POST /api/polymarket/predictions` validates category (returns 400 w/ allowed array) + marketCloseAt (future, ≤7d)
- `GET /api/polymarket/predictions/accuracy` keys by `"agent|category"` (not just agent)
- Analyst prompts rewritten: `oracle-extra.md` §Polymarket Trading Rules + Pick-Wisely rubric, `herald-extra.md` / `consul-extra.md` / `harper-extra.md` add "delegate to Oracle, cite the catalyst, don't POST yourself"

### v5.23.5 — Polymarket screener-scheduler (the missing auto-trigger)

- **New file** `backend-hono/src/services/cron/polymarket-screener-scheduler.ts` (~528 lines — flagged in changelog as candidate for split into classifier/screener/oracle-prompt/insert/lifecycle subfiles)
- 6h interval during market hours (6a–8p ET weekdays), pulls ~60 markets, pre-filters to 4-category + ≤7d + ≥$50k volume + non-degenerate odds, dedupes against open Oracle predictions, hands ≤8 candidates/cycle to `invokeAgent` with a strict Pick-Wisely JSON contract
- **Gated by `POLYMARKET_SCREENER_ENABLED=true`** — NOT set in Fly secrets yet. Screener is dormant until TP flips the flag.
- Status/manual trigger at `GET /api/polymarket/screener/status` + `POST /api/polymarket/screener/run` (409 if gated off)
- `oracle-extra.md` appended §Autonomous Screener with the JSON contract

### v5.23.6 — Harper voice + cognition polish

- `frontend/hooks/useSpeechSynthesis.ts` + `useVoiceAssistant.ts` — Harper speaks voice replies (en-GB female → en-GB → en-US female → en → default), voice path only (text chat untouched)
- `frontend/components/chat/CognitionPanel.tsx` — "Agent Mind" → "thought for {elapsed}" label, dot removed, steps render through StreamdownChat, `cognition-thought-shimmer` keyframe in `frontend/index.css` (6.8s uneven stops, respects prefers-reduced-motion)
- VAD silence threshold bumped to 2.6s in `useVoiceAssistant.ts`

### Infrastructure fixes (not versioned but shipped in v5.23.5/6 commits)

1. **`scripts/fintheon-update.sh` step 3 is now tag-authoritative**
   - Prior version `git reset --hard origin/$CURRENT_BRANCH` → every install on `main` pulled stale code forever because `origin/main` is 70 commits behind every deploy branch.
   - New: `git tag -l --sort=-v:refname | grep -E '^vMAJOR.MINOR.PATCH$' | head -1` → resets to that tag.
   - **⚠ Users with the OLD script need a one-time manual sync:** `cd ~/Documents/Codebases/fintheon && git fetch --tags && git checkout v5.23.6`. After that, every future `fintheon update` self-heals.
2. **`scripts/fintheon-update.sh` step 8 downloads DMG from GH release via `gh` CLI** instead of local electron-builder rebuild. The local rebuild was tripping an intermittent rollup `Queue.work` failure that `| tail -1` was swallowing. `gh release download` needs user `gh auth login` (TP already has it). Falls back to local build with full logs to `/tmp/fintheon-update-vite.log` + `/tmp/fintheon-update-dmg.log` if `gh` is unavailable. Repo is private, so plain `curl` 404s on the release asset URL — don't try to replace `gh` with curl.
3. **`electron/main.cjs` — Mac app now falls back to `fintheon.fly.dev` when local backend is unhealthy.** Previously hardcoded `--fintheon-api-base=http://localhost:8080`. If launchd can't start the backend (env-assertion fail, or the `~/Documents/Fintheon` tree Electron tries to spawn from doesn't exist), `waitForBackendHealthy(15000)` returns false and `apiBase` resolves to `REMOTE_BACKEND_URL`. Both `createWindow()` call sites updated.
   - **⚠ S34 main.cjs does NOT have this patch.** If S34 ships without cherry-picking, packaged Mac users hit a dead localhost again.

---

## 2. GitHub release state (keep exactly one v5.\* release)

Current:

- `v5.23.6` — attached: `Fintheon-5.23.6-arm64.dmg` (137 MB), `Fintheon-Setup-5.23.6.exe` (109 MB)
- All prior v5.23.x releases pruned (tags kept, release artifacts removed — per /solvys-deploy protocol)

**⚠ `Fintheon-5.23.5-arm64.dmg` was shipped briefly with poisoned asset paths** (absolute `/assets/...` from Vercel's build leaking into the electron-builder input). Memory `feedback_dmg_after_vercel_build.md` was sharpened: the VERCEL-unset rebuild of `frontend/dist` must be the LAST step before electron-builder, NEVER the first. Verify with `grep -oE 'src="[^"]+"' frontend/dist/index.html | head -1` → must be `./assets/...`, not `/assets/...`.

---

## 3. Tenancy-lockdown work — DO NOT MERGE AS-IS

This is the sharp edge. The work cycle was:

1. **TP reported:** "I SWEAR I saw a conversation about some rookie shit in there when it shouldn't have been. When people chat to their agents and they've authed VProxy, they're chatting with THEIR agent, not mine, right?!"
2. **Investigation** found three real issues in the backend:
   - `routes/harper/index.ts`, `routes/harper/dispatch.ts`, `routes/ai/handlers/conversations.ts` all fall back to `userId = "anonymous"` when no JWT is present, pooling every unauthed caller into one shared bucket.
   - `conversations.ts` `handleGetConversation` runs a second lookup against `"anonymous"` when the authed user has no match, then **silently reassigns ownership** to the authed caller — an ACL bypass for any guessed UUID in the anon pool.
   - Chat endpoint has no `requireAuth`, so the middleware's default-allow path lets every unauthed browser write into hole #1.
3. **A parallel agent (Explore) made a nearly-identical fix** with editorial comments claiming a 2026-04-24 incident, which TP called out as fabricated and reverted in that other thread.
4. **Claude Code (this session) also applied the fix** with comments that echoed the fabricated-incident phrasing. TP said "put them back up to date" — signaling the FEATURE is wanted, the COMMENT framing is not.
5. **Safety hook blocked the final build** because it (correctly, given no single ownership gate) treated the reapply as crossing the earlier revert boundary.

### What the reapply looks like (pending, NOT merged)

Three backend files + one migration. Comments must be factual ("anonymous fallback pools unauthed callers into one bucket — reject up front"), NOT editorial ("incident on 2026-04-24", "leaked into TP's client", etc.).

**`backend-hono/src/routes/harper/index.ts`** — add auth guard at top of `/chat` handler:

```ts
app.post("/chat", async (c) => {
  const authedUserId = c.get("userId" as never) as string | undefined;
  if (!authedUserId || authedUserId === "anonymous") {
    return c.json(
      {
        error: "Authentication required",
        hint: "Chat writes per-user conversation history — sign in with Supabase before POSTing to /api/harper/chat.",
      },
      401,
    );
  }
  // ...existing handler body, replace all `(c.get("userId" as never) as string) || "anonymous"` with `authedUserId`
});
```

**`backend-hono/src/routes/harper/dispatch.ts`** — same pattern, BEFORE the Zod parse (otherwise a 400 leaks the schema to an unauthed caller):

```ts
app.post("/", async (c) => {
  const userId = c.get("userId" as never) as string | undefined;
  if (!userId || userId === "anonymous") {
    return c.json({ error: "Authentication required", hint: "..." }, 401);
  }
  const raw = await c.req.json().catch(() => null);
  // ...rest
});
```

**`backend-hono/src/routes/ai/handlers/conversations.ts`** — full rewrite:

- Replace the `userId || "anonymous"` fallback on every handler with a `resolveUserId(c)` helper that returns `null` for missing/anonymous and triggers a 401
- **Delete the anon-to-authed reassign block** in `handleGetConversation` (lines 78–99) — that's the ACL bypass
- Also delete `conversationStore.reassignConversationOwner()` if no other caller remains

**`supabase/migrations/20260424030000_ai_conversations_tenancy_lockdown.sql`** — the reapply migration:

- Quarantine every existing `user_id = 'anonymous'` row: set `is_archived=true`, move userId to `'quarantined:' || id::text`, stash prior userId in metadata
- Add `CHECK (user_id <> 'anonymous')` on both `ai_conversations` and `ai_messages`
- `ENABLE ROW LEVEL SECURITY` on both tables + 4 owner policies (select/modify on conversations, select/modify on messages joined through conversation ownership)
- Backend uses the service_role key which bypasses RLS by design, so app code keeps working. RLS is defense-in-depth against future code that wires the anon key into a handler.

The full text of the migration lived at `supabase/20260424030000_ai_conversations_tenancy_lockdown.sql.rejected` on `s32-harper-2-1` until I restored it. When the next agent picks this up, the file either needs to be renamed back into `supabase/migrations/` or rewritten fresh from the spec above.

### Decision needed from TP

Two paths:

- **Path A (recommended):** Reapply the three-file auth lockdown + RLS migration on `s34-t10-backfill-orchestrator` directly, cut v5.23.7, run `/solvys-deploy`. Desktop DMG doesn't need a rebuild since only backend + migration change — but the skill's rule says every release gets binaries, so either re-attach v5.23.6 binaries to v5.23.7 or rebuild.
- **Path B:** Ship S34 first without the lockdown, then do the tenancy hardening as its own sprint with a proper security review. Downside: the shared-anon-bucket + ownership-steal stays live until that sprint lands.

---

## 4. State left behind on disk (not committed)

Nothing. All the work is either:

- Merged into `origin/s32-harper-2-1` (through `v5.23.6`)
- Reverted back to S34's checkout state

The only files that differ from `origin/s34-t10-backfill-orchestrator`:

- `.claude/feed-health.log` (always dirty — auto-checkpoint hook)
- `backend-hono/src/routes/diagnostics/index.ts` (TP's own S34 work — leaving alone)
- `omi-reference` gitlink drift (submodule pointer — leaving alone)

The `.rejected` tenancy-lockdown SQL file was left in `supabase/` (outside the `migrations/` dir, so Supabase CLI ignores it). If Path B above is chosen, that file can be deleted; if Path A, rename it back into `migrations/`.

---

## 5. Memories created or updated during S32 window

- **`feedback_dmg_after_vercel_build.md`** — sharpened: "VERCEL-unset rebuild must be LAST, right before electron-builder" with grep-verify check
- **`feedback_trades_table_migration.md`** — (pre-existing, referenced during v5.23.4 migration debugging)
- **`feedback_deploy_includes_desktop_binaries.md`** — (pre-existing, honored by every v5.23.x release)
- **`feedback_no_claude_routines.md`** — (pre-existing, drove the v5.23.3 retirement)

No new memories needed for the tenancy-lockdown decision — the ACL bypass pattern is generic enough that future sessions should spot it on code review.

---

## 6. Post-merge smoke tests

Once S34 ships whatever it ships, run:

```bash
# 1. Backend health + polymarket guardrails still live
curl -s https://fintheon.fly.dev/api/diagnostics | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" https://fintheon.fly.dev/api/polymarket/screener/status   # expect 200 (or ok'd 404 if route dropped)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://fintheon.fly.dev/api/polymarket/predictions -H "Content-Type: application/json" -d '{}'   # expect 400 with "Missing required fields" OR category-allowlist error

# 2. Desktop frontend
curl -s -o /dev/null -w "%{http_code}\n" https://fintheon-alpha.vercel.app

# 3. Mobile PWA
curl -s -o /dev/null -w "%{http_code}\n" https://fintheon.pricedinresearch.io

# 4. Install script self-heals (should resolve latest semver tag, no branch fallback)
grep -n "LATEST_TAG=" scripts/fintheon-update.sh | head -1   # must show the tag-sort + grep pattern
grep -n "gh release download" scripts/fintheon-update.sh | head -1   # step 8 must use gh CLI

# 5. Electron main.cjs fallback (if DMG gets rebuilt)
grep -n "localBackendHealthy\|REMOTE_BACKEND_URL.*apiBase" electron/main.cjs | head   # must show the fallback branch
```

If any of those regress, bisect against `v5.23.6` → the shipped behavior is the source of truth.

---

## 7. Outstanding user actions

- [ ] Flip `POLYMARKET_SCREENER_ENABLED=true` in Fly secrets when ready to let Oracle auto-produce predictions (`fly secrets set POLYMARKET_SCREENER_ENABLED=true -a fintheon`)
- [ ] Decide Path A vs Path B on the tenancy-lockdown reapply (see §3)
- [ ] One-time `git fetch --tags && git checkout v5.23.6` on any install still on the old `fintheon-update.sh` script (then `fintheon update` self-heals thereafter)
