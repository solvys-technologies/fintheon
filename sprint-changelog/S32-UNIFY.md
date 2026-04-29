# Sprint Brief: S32 — Unify (single-agent, Wave 3)

## Intent

Merge S32 Wave-2 tracks (T2–T9) onto `s32-harper-2-1`, resolve additive conflicts, wire cross-track ports, run the full validation stack, and leave `s32-harper-2-1` green and ready for `/solvys-deploy`. This is the final step of the Harper sprint.

## Baseline Requirements (preflight)

- [ ] `git branch --show-current` → `s32-harper-2-1`
- [ ] `git log --oneline | head -5` shows T1 Kimi rollback somewhere in history. If NOT present (grep output shows `c4c599ef` or an equivalent rollback commit not in ancestry), either:
  - (a) merge `origin/main` if S30 has landed carrying T1 into main, OR
  - (b) cherry-pick the rollback commit from `s30-performance` (`git cherry-pick c4c599ef`) and resolve conflicts in `App.tsx`, `AuthContext.tsx`, `changelog.ts`, `ai-config.ts`, `ai-types.ts` by keeping rollback's deletions and appending s32 changelog entries
- [ ] Working tree clean: `git status --short` shows no unstaged edits. Stash any remaining WIP first.

## Wave-2 Track Branches to Merge

Merge in this order (additive conflicts resolve cleanly when done sequentially):

1. `s32-t2-harper-vision-refinement`
2. `s32-t3-ollama-hermes-fallback`
3. `s32-t4-consul-control-corners`
4. `s32-t5-streamdown-tv-charts`
5. `s32-t6-psychassist-blindspots`
6. `s32-t7-advisory-calendar-pill`
7. `s32-t8-browser-harness-voice-orb`
8. `s32-t9-predictive-knowledge-graph`

(Actual branch names may vary — confirm via `git branch -l 's32-t*'`.)

For each: `git merge --no-ff <branch> -m "merge: S32-T# <short>"`

## Conflict Resolution Rules (per shared file)

| File                                                                                     | How to resolve                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `backend-hono/src/routes/index.ts`                                                       | Each track appends its own `// [S32-T#] mounts` block. Keep all blocks; order by track number (T2 first → T9 last) for readability.      |
| `shared/index.ts`                                                                        | Every track that appends types (T6 `Blindspot`, T7 `Watchout`, T9 `UsageEvent`+`FeatureProposal`) wins — keep all appends. No deletions. |
| `user_preferences.prefs` JSONB type (in `shared/` or `frontend/lib/user-preferences.ts`) | T6 adds `psychAssistEnabled`, T7 adds `autopilotGuardian`. Keep both. Single merged interface.                                           |
| `/api/diagnostics` response builder                                                      | T2 adds `vision` key, T3 adds `ai` key, T7 adds `autopilot` key. Merge into one object; keep all keys.                                   |
| `backend-hono/src/config/ai-config.ts`                                                   | T1 stripped Kimi; T3 adds `ollama-hermes` provider entry. Both win.                                                                      |
| `.env.example` (root + `backend-hono/`)                                                  | T1 removed `GITHUB_*`; T3 added `OLLAMA_FALLBACK_*` + `HERMES_SIDECAR_URL`. Both win.                                                    |
| `src/lib/changelog.ts`                                                                   | Append one consolidated entry per track, chronological. See "Changelog" below.                                                           |

## Cross-Track Wiring (after merge, before validation)

These are "mock → live" swaps that were deferred during Wave 2:

- [ ] T6's `BlindspotsRow` data fetch → confirm it hits T6's live endpoints (`/api/blindspots/psych` + `/api/blindspots/trading`). If T7 wired this already, just verify.
- [ ] T5's `FuturesDailyHeatmap` + chat slots → confirm no mock-JSON fallbacks remain (`grep -r "__mocks__" frontend/`)
- [ ] T3's provider chain → confirm every agentic call site routes through `generateViaChain`, not direct VProxy client (`grep -rE "vproxy|generateTextViaVProxy|createModelClient" backend-hono/src/` — each hit should be either the chain itself or a flagged exemption)
- [ ] T2's `generateDescriptionAsync` → confirm it calls T3's provider chain (not a direct VProxy call), so Harper Vision descriptions fall back to Ollama when needed

## Validation Stack

```bash
# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Backend build
cd backend-hono && bun run build && cd ..

# Clean frontend build (stale bundle prevention)
rm -rf dist && npx vite build

# Restart launchd backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Glass-residue gate (memory: no backdrop-blur)
grep -rE "backdrop-blur|backdropFilter" frontend/components/harper-vision/ frontend/components/chat/slots/ frontend/components/consul-control/ \
  && echo "FAIL: glass residue" || echo "OK"

# Kimi-residue gate (T1 rollback integrity)
git grep -iE 'kimi|moonshot|github-kimi|githubModels|GITHUB_CLIENT|GITHUB_REDIRECT|setRuntimeGitHubToken|GitHubOAuthCallback|UpdateBanner' \
  -- ':!frontend/src/lib/changelog.ts' \
  && echo "FAIL: Kimi residue" || echo "OK"
```

## Smoke Matrix (manual)

- VProxy up + Harper chat → replies via VProxy (`/api/diagnostics` shows `ai.primary.available=true`)
- Kill VProxy → same chat replies via Ollama-Qwen; logs tag `[ai-chain] fallback`
- Harper Vision capture + "what do you see?" → semantic description (not just window title)
- Privacy toggle → no new frames land in `harper_vision_frames`
- Consul Control activate → gold pixel corners animate at four corners
- Emit a `catalyst-card` JSON fenced block from Harper → streamdown renders the card
- Emit a `tv-chart` slot → candle chart renders with user's bullish/bearish colors
- PsychAssist OFF → `BlindspotsRow` shows empty-state CTA; nightly Routine writes zero rows for the user
- PsychAssist ON + manual trigger nightly Routine → rows appear in both `psych_blindspots` + `trading_blindspots`
- 30 rapid trades in 5 min (PsychAssist ON, simulated) → single over-trading nudge fires; rate-limit blocks repeat for 60 min
- Autopilot guardian drawdown trigger → autopilot pauses; resumes after cooldown
- Calendar pill → next event 4 min out → pill fades in with `{name} — 4 min`
- Voice orb single-click → Omi session starts; orb pulses
- Sidebar chat open → Omi quick-chat floater hidden
- Harper asked "look up X online" → `browser_harness` tool fires; `browser_harness_audit` row written
- Emit 50 usage events → run weekly proposer → proposals appear in settings panel (none pushed)

## Migrations (hand to TP)

```
backend-hono/migrations/034_harper_vision_storage.sql   (T2 — if SQL path chosen over dashboard UI)
backend-hono/migrations/035_blindspots.sql              (T6)
backend-hono/migrations/036_watchouts.sql               (T7)
backend-hono/migrations/037_browser_harness_audit.sql   (T8)
backend-hono/migrations/038_usage_telemetry.sql         (T9)
```

Post to TP: "S32 Wave 3 unified — five migrations to push: `034_harper_vision_storage.sql`, `035_blindspots.sql`, `036_watchouts.sql`, `037_browser_harness_audit.sql`, `038_usage_telemetry.sql`. Also set these Fly secrets before Routines fire: `ROUTINE_SECRET` (if not already set), `OLLAMA_FALLBACK_MODEL=qwen3-coder:480b-cloud` (confirm model with TP), `HERMES_SIDECAR_URL=http://localhost:3100`."

## Routines (TP wires via Harper Ops)

- `blindspots-nightly` (T6) — Mon–Sat 3am ET → `POST /api/harper-ops/blindspots-nightly`
- `daily-market-summary` (carried from S30-T3) — Mon–Fri 5pm ET → `POST /api/harper-ops/daily-market-summary`
- `hermes-daily-summary` (carried from S30-T3) — Mon–Fri 5pm ET → `POST /api/harper-ops/hermes-daily-summary`
- `harper-vision-cleanup` (T2) — daily 3am ET → `POST /api/harper-ops/harper-vision-cleanup`
- `feature-proposals-weekly` (T9) — Sun 6pm ET → `POST /api/harper-ops/feature-proposals-weekly`

Each route is gated on `x-routine-secret: $ROUTINE_SECRET`. Route docs live under `docs/routines/`.

## Changelog

Append one consolidated entry to `src/lib/changelog.ts`:

```ts
{
  date: '2026-04-23T23:59:00',
  agent: 'claude-code',
  summary: 'S32 Harper unified — Kimi rollback + Vision refinement + Ollama fallback + Consul Control corners + Streamdown/TV charts + PsychAssist gating + advisory layer + calendar pill + browser-harness tool + predictive knowledge graph',
  files: [ /* the union of all modified/created files across T1–T9 */ ]
}
```

## Commit Format

Unification merge commits follow `merge: S32-T# <short>`. The final post-validation commit (changelog + any small fixups):

```
[v5.23.0] chore: S32 Harper unified — Wave 3 complete
```

## Acceptance Criteria

- [ ] All 8 Wave-2 branches merged into `s32-harper-2-1`
- [ ] Glass-residue gate: OK
- [ ] Kimi-residue gate: OK
- [ ] `bun run build` + `tsc --noEmit` + `rm -rf dist && vite build` all green
- [ ] Local backend restarts cleanly
- [ ] Full smoke matrix passes locally
- [ ] Migration filenames + Fly secrets posted to TP
- [ ] Routine docs exist under `docs/routines/`
- [ ] Consolidated changelog entry added
- [ ] No modified file exceeds 300 lines (flag and extract any that do)

## Do NOT

- Apply migrations yourself (`supabase db push` is TP's)
- `git push` any branch without explicit TP signoff
- Bypass git hooks or auth
- Touch `s30-performance` or `main` — this sprint operates only on `s32-harper-2-1`
- Touch files listed as "preserve" in any individual track brief
