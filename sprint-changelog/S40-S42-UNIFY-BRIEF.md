# Sprint Brief: S40↔S42 Unification (single-agent, turnkey)

## Intent

Two sprints both tagged for `v5.29.0` are now sitting in parallel worktrees with overlapping touch points. Ship one unified `s40-s42-unified` branch that contains every S40 deliverable AND every S42 deliverable, builds clean on backend + frontend + mobile, and is the actual thing `/solvys-deploy` runs against. After this brief lands, the deploy worktree changes from `~/Desktop/Codebases/fintheon-s40-ttp-realtime` to `~/Desktop/Codebases/fintheon-s40-s42-unified`.

## Branch Target

Fresh worktree at `~/Desktop/Codebases/fintheon-s40-s42-unified` cut from `s40-ttp-realtime` (which already includes S40 + the s35-unified mobile-chat / Bug #2 fixes ported in this morning). Branch name: `s40-s42-unified`. Do NOT work in either of the source worktrees — `~/Desktop/Codebases/fintheon-s40-ttp-realtime` and `~/Desktop/Codebases/fintheon-s42-unify` stay parked as the source of truth for their respective sides until this brief succeeds.

## Source-of-truth matrix

| Branch             | Worktree                                        | What it contains                                                                                                                                                                                         | Status                                                           |
| ------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `s40-ttp-realtime` | `~/Desktop/Codebases/fintheon-s40-ttp-realtime` | S40 9 pillars + S35-unified Bug #1 (relay-bridge close/error listeners) + Bug #2 (electron close attribution loggers). package.json bumped to 5.29.0                                                     | Builds clean. Parked. Not pushed.                                |
| `s42-chat-sota`    | `~/Desktop/Codebases/fintheon-s42-unify`        | S42 T1-T8 already merged via T9 unify. Chat SOTA: streamdown, ComposerPrimitive, cmdk, MessageQueue, ArtifactPane, AskAboutThis, browserbase iframe, Nothing-design fuses+spinners+Doto, mount-time perf | Tagged `[v5.29.0]` per commit subjects but no actual git tag yet |

## Conflict zones (read before merging)

These files exist on BOTH branches with different shapes — pre-decide the resolution rule per file rather than letting `git merge` punt to you:

### Backend

- **`backend-hono/src/routes/index.ts`** — both add new route mounts.
  - S40 adds: `app.get("/api/voice/sample", ...)`, `/api/time-to-print`, `/api/browserbase` (auth-gated, dir-style `createBrowserbaseRoutes()` from `./browserbase/index.js`).
  - S42 adds: `/api/browserbase` (its own flat-file router from `./browserbase.js`), plus possibly other chat-stream routes.
  - **RESOLUTION**: keep BOTH route mount lines but reconcile the browserbase mount to a single one. See "Browserbase reconciliation" below.

- **`backend-hono/src/services/strands/harper-tools.ts`** — both edit `AUTO_APPROVED_TOOLS` and tool registrations.
  - S40 adds: `consul_browser` to AUTO_APPROVED_TOOLS + a `consul_browser` Strands tool that calls `services/browserbase/session-manager.ts`.
  - S42 likely changes Harper's tool list for chat SOTA (Ask About This / artifact handlers / etc.).
  - **RESOLUTION**: union of `AUTO_APPROVED_TOOLS` entries. Union of tool registrations. If both define `consul_browser`, S40's version wins (it has the audit + dispatcher wiring).

- **`backend-hono/src/services/strands/stream-adapter.ts`** — S42-only file. Take from S42 verbatim.

- **`backend-hono/src/services/strands/agents/harper.ts`** — S42-only edits. Take from S42.

- **`backend-hono/src/services/claude-sdk/bridge.ts`** — S42-only edits. Take from S42.

- **`backend-hono/src/services/browser/browserbase.ts`** (S42) vs **`backend-hono/src/services/browserbase/{client,session-manager,sse}.ts`** (S40) — two different file layouts for the same SDK. See "Browserbase reconciliation" below.

- **`backend-hono/.env.example`, `backend-hono/package.json`, `backend-hono/bun.lock`** — S42 adds `@browserbasehq/sdk` as a real dep + env vars. S40 used a dynamic optional import with a string specifier (so tsc didn't trip on a missing module). Once the dep is in package.json the dynamic-specifier hack is unnecessary; KEEP the dynamic import anyway so the service degrades cleanly when env keys are missing — only the resolver path becomes static. After accepting S42's package.json + bun.lock, run `cd backend-hono && bun install` to materialize node_modules.

- **`backend-hono/scripts/smoke-browserbase-route.mjs`** — S42-only. Take verbatim. Sanity that the unified route still passes after merge.

### Frontend

- **`frontend/components/ChatInterface.tsx`** — both edit.
  - S40 adds: `<ConsulBrowserPaneSlot />` between the chat column and the existing right-rail Preview pane, plus a `ConsulBrowserPaneSlot` function defined at file bottom that reads `useConsulBrowser()` and conditionally mounts `<ConsulBrowserPane className="h-full" />`.
  - S42 likely refactors the chat surface for ArtifactPane / streamdown rendering / cmdk palette wiring.
  - **RESOLUTION**: take S42's refactor as the structural baseline, then re-apply S40's `<ConsulBrowserPaneSlot />` insertion AS A SIBLING of S42's ArtifactPane inside the same flex row. Both panes are 50%-ish split-shrink siblings; they can coexist. If the user has both Consul Browser + an ArtifactPane open at the same time, the chat column squeezes — that's acceptable (mark it WONT-FIX in a follow-on note rather than designing a 3-pane layout right now).

- **`frontend/components/chat/FintheonComposer.tsx`** — both edit.
  - S40 adds: `Globe` icon import, `useConsulBrowser` import, `ConsulBrowserButton` function above the main `FintheonComposer` export, and the button is rendered inside the toolsSlot row (NOT in dropdown — explicit per S40 brief).
  - S42 adds: `ComposerPrimitive` migration + cmdk palette + MessageQueue.
  - **RESOLUTION**: rebase S40's Globe button addition onto S42's ComposerPrimitive shape. Keep the button in the toolsSlot row; if S42's primitive has a different slot name, mount it in whatever S42 calls the "tools cluster". Globe button must stay 32×32 with the active-state ring per S40 brief.

- **`frontend/components/chat/CommandPalette.tsx`** — S42-only. Take verbatim. Check whether it has a "Consul Browser: Open" entry — if not, add one that calls `useConsulBrowser().open()`. That's a small post-merge addition the unifier should make.

- **`frontend/components/chat/MessagePrimitive.tsx`, `StreamdownText.tsx`, `MessageFooter.tsx`, `CitationChip.tsx`, `AgentActivityRail.tsx`, `ArtifactPane.tsx`, `ArtifactSlot.tsx`, `AskAboutThis.tsx`, `artifactTypes.ts`, `parts/MessagePartRenderer.tsx`, `parts/TextPart.tsx`, `HistorySkeletonList.tsx`** — all S42-only. Take verbatim.

- **`frontend/components/layout/EmbeddedBrowserFrame.tsx`** — S42 adds an `agent-iframe` mode. S40's `ConsulBrowserPane.tsx` uses its own iframe/webview directly without going through EmbeddedBrowserFrame. Keep both: S42's mode is for in-thread iframe artifacts, S40's pane is for the always-on Consul Browser session. Don't try to merge them into one component — they have different lifecycle owners.

- **`frontend/components/layout/MainLayout.tsx`** — per memory `feedback_peer_roll_forward.md` and the S40 brief's safe-zones note, peers own MainLayout. If S42 modified MainLayout, take S42's edits as-is; do NOT layer S40 changes on top (S40 explicitly skipped MainLayout).

- **`frontend/components/shared/NothingFuse.tsx`, `frontend/components/icon-bank/UnicodeSpinners.tsx`, `frontend/components/ui/ai-loader.tsx`, `frontend/components/ui/chatgpt-prompt-input.tsx`, `frontend/index.css`** — S42-only (T8 Nothing-design refresh). Take verbatim.

- **`frontend/lib/mountTelemetry.ts`** — S42-only. Take verbatim.

- **`frontend/types/bridge-stream.ts`** — S42-only (T1 stream events). Take verbatim.

- **`frontend/components/feed/RiskFlowDetailCard.tsx`, `frontend/components/narrative/*.tsx`, `frontend/components/proposals/TradePlanCard.tsx`, `frontend/components/journal/KPICard.tsx`, `frontend/components/dashboard/RegimeCard.tsx`, `frontend/components/mission-control/MissionControlPanel.tsx`, `frontend/components/AccountSummary.tsx`, `frontend/components/SessionStatusBar.tsx`, `frontend/components/arbitrum/ArbitrumChamber.tsx`, `frontend/components/consilium/ConsiliumMessage.tsx`** — S42-only (T6 Ask About This entry points + T8 Nothing-design wiring). Take verbatim.

- **`frontend/contexts/ConsulBrowserContext.tsx`, `frontend/components/strategium/{ConsulBrowserPane,StrategiumTimeToPrintSlot,TimeToPrintDockable}.tsx`, `frontend/components/primitives/CountryFlag.tsx`, `frontend/components/refinement-engine/CountryToggle.tsx`, `frontend/hooks/useTimeToPrint.ts`, `frontend/components/layout/DualPaneShell.tsx`** — S40-only. Take verbatim.

- **`frontend/styles/transitions.css`** — S40 adds `ttp-pulse`, `t-pane-slide-in`, `t-pane-retract`. S42 may have edited the same file for chat-related transitions. UNION the keyframes; both groups are scoped enough that there should be no real collision.

- **`frontend/App.tsx`** — S40 wraps the provider stack with `<ConsulBrowserProvider>`. If S42 added more providers, layer them in alongside; keep the order ConsulBrowserProvider INSIDE `<VoiceProvider>` and OUTSIDE `<ERProvider>` per the S40 edit.

### Mobile

- **`mobile/components/chat/{ChatInput,ChatMessage,ChatPage}.tsx`** — both edit. S42 is the dominant rewrite (streamdown, MessageQueue, MobileCommandPalette, ArtifactSheet, AskAboutThis). Take S42's versions VERBATIM; the s35-unified Bug #1 fix already lives in `mobile/components/chat/ChatPage.tsx:336-388` per the user's report and is preserved by S42's merge (verify by grepping for `HARPER SILENT` and `[ERROR:` in the S42 ChatPage.tsx — both should still be there).

- **`mobile/lib/mountTelemetry.ts`** — S42-only. Take verbatim.

- All other `mobile/components/**` S42 changes — take verbatim.

### Cross-cutting

- **`src/lib/changelog.ts`** — both have v5.29.0 entries. Two entries for the same version is fine and idiomatic in this repo (one per major surface). UNION both entries. Order: keep S40's first (older timestamp) so the auto-checkpoint hook's chronological sort still puts the most recent at the top.

- **`package.json`** — S40 bumped to 5.29.0. S42 commits also reference 5.29.0. No conflict; verify the unified file shows `"version": "5.29.0"` once and nowhere else.

- **`supabase/migrations/20260425194950_s40_data_layer.sql`, `supabase/migrations/20260425200000_s40_seed_macro_handles.sql`** — S40-only. Take verbatim. S42 doesn't touch the schema.

## Browserbase reconciliation (the one real merge thinking)

Both sprints did Browserbase but at different abstraction levels:

- **S40 (Consul Browser)**: full session lifecycle. `services/browserbase/{client,session-manager,sse}.ts`, `routes/browserbase/{index,handlers}.ts`, `consul_browser` Strands tool, frontend `ConsulBrowserContext` + `ConsulBrowserPane` rendering the liveURL in iframe/webview, day cap + idle TTL + audit. The model is: "Harper or the user opens a long-lived session; the user watches it live in a side pane."

- **S42 T5 (browserbase iframe)**: in-thread artifact. `services/browser/browserbase.ts` (single file), `routes/browserbase.ts` (flat file), `EmbeddedBrowserFrame` gains an `agent-iframe` mode. The model is: "Harper opens a transient iframe inline in a chat message bubble as a citation artifact, no persistent session."

These are NOT the same feature. Both should ship.

**RULE**:

1. Keep S40's `services/browserbase/` directory + `routes/browserbase/` directory as the canonical Consul Browser stack.
2. Move S42's flat-file `services/browser/browserbase.ts` to `services/browserbase/agent-iframe.ts` — same module, just normalized into the same dir.
3. Move S42's `routes/browserbase.ts` route definitions INTO `routes/browserbase/index.ts` so there's a single mount point. The existing S40 routes (POST/DELETE/GET on /sessions/_, /stream) keep their paths; S42's iframe routes get new paths under `/api/browserbase/iframe/_` to disambiguate.
4. Update `routes/index.ts` to a single `app.route("/api/browserbase", createBrowserbaseRoutes())` with the auth middleware S40 added kept in place.
5. Run S42's `scripts/smoke-browserbase-route.mjs` after the merge — it should still pass against the unified router. If S42's smoke uses an old path, update the smoke script to the new paths and note it in the commit message.

## Development Flow

1. **Worktree creation**:

   ```
   cd ~/Documents/Codebases/fintheon
   git worktree add -b s40-s42-unified ~/Desktop/Codebases/fintheon-s40-s42-unified s40-ttp-realtime
   cd ~/Desktop/Codebases/fintheon-s40-s42-unified
   ln -sfn ~/Documents/Codebases/fintheon/node_modules node_modules
   ln -sfn ~/Documents/Codebases/fintheon/backend-hono/node_modules backend-hono/node_modules
   ln -sfn ~/Documents/Codebases/fintheon/frontend/node_modules frontend/node_modules
   ```

2. **Merge S42**:

   ```
   git merge s42-chat-sota --no-ff -m "merge: s42-chat-sota into s40-ttp-realtime — chat SOTA + Consul Browser unify"
   ```

   Expect conflicts on the files in the matrix above. Resolve PER FILE per the rules. Do NOT auto-resolve with `--theirs` or `--ours` — every conflict in the matrix has a manual rule.

3. **Browserbase reconciliation** as written above. This is its own commit:

   ```
   git commit -m "refactor: unify S40 Consul Browser + S42 agent-iframe under services/browserbase/"
   ```

4. **Sanity grep** the s35-unified Bug #1 fix is still in mobile ChatPage.tsx:

   ```
   grep -n "local_offline\|HARPER SILENT\|\[ERROR:" mobile/components/chat/ChatPage.tsx
   ```

   If the markers vanished during merge, restore them from `~/Desktop/Codebases/fintheon-s40-ttp-realtime/mobile/components/chat/ChatPage.tsx`.

5. **Install + build**:

   ```
   cd backend-hono && bun install && bun run build
   cd ../frontend && rm -rf dist && ./node_modules/.bin/vite build --mode production
   cd ../mobile && rm -rf dist && ./node_modules/.bin/vite build --mode production
   ```

   Frontend's `streamdown` package lives in `frontend/node_modules` (verified during S40 build). If vite trips on it, re-symlink frontend/node_modules.

6. **Restart local backend** + smoke:

   ```
   launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
   launchctl load   ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
   curl -s http://localhost:8080/api/diagnostics
   curl -s http://localhost:8080/api/riskflow/health
   curl -s 'http://localhost:8080/api/voice/sample?voice=cori&text=Good+morning' | head -c 200
   curl -s http://localhost:8080/api/time-to-print/next | head -c 400
   curl -s 'http://localhost:8080/api/earnings/upcoming?days=7' | head -c 400
   bun run backend-hono/scripts/smoke-browserbase-route.mjs
   ```

7. **Hand back to TP** with the worktree parked, NO commit beyond the two merge commits, NO push, NO tag. /solvys-deploy will handle the rest.

## Acceptance Criteria

- [ ] `~/Desktop/Codebases/fintheon-s40-s42-unified` exists, branch `s40-s42-unified`, parent commit is the S40 head
- [ ] Two merge commits land: the S42 merge + the browserbase reconciliation refactor
- [ ] `cd backend-hono && bun run build` exits 0
- [ ] `cd frontend && rm -rf dist && vite build` exits 0
- [ ] `cd mobile && rm -rf dist && vite build` exits 0
- [ ] All 5 curl smokes against `localhost:8080` return non-empty JSON / audio
- [ ] `bun run backend-hono/scripts/smoke-browserbase-route.mjs` passes (or its update is committed in the same merge commit)
- [ ] `grep -n "local_offline" mobile/components/chat/ChatPage.tsx` finds at least one match (Bug #1 fix preserved)
- [ ] `grep -n "closeReason" electron/main.cjs` finds matches in both the app-quit handlers AND the per-window close listener (Bug #2 instrumentation preserved)
- [ ] `frontend/components/strategium/ConsulBrowserPane.tsx` AND `frontend/components/chat/ArtifactPane.tsx` both exist as separate files (S40 + S42 both shipped)
- [ ] `frontend/components/chat/FintheonComposer.tsx` contains `Globe` icon import AND ComposerPrimitive references (both surfaces wired)
- [ ] `package.json` shows `"version": "5.29.0"` exactly once
- [ ] `src/lib/changelog.ts` contains BOTH the S40 v5.29.0 entry and the S42 v5.29.0 entry
- [ ] No commits pushed to origin; no git tags created. /solvys-deploy is the only thing that ships.

## Operator Notes

- **Time budget**: ~90 minutes for an experienced merger; ~3 hours if the conflicts are messy. If you exceed 4 hours, stop and write a status note in `sprint-md/S40-S42-UNIFY-STATUS.md` listing what merged cleanly vs what's stuck — don't push half-resolved conflicts.
- **The auto-checkpoint hook** will commit your in-progress state every ~5 minutes as `auto: Claude Code task checkpoint [HH:MM]`. That's fine — git history during a merge is allowed to be noisy. Squash later only if TP asks.
- **DO NOT touch S41**. There is no S41 branch in tree right now. If one appears mid-merge, leave it alone and flag it to TP.
- **DO NOT bump the version**. 5.29.0 stays. The whole point is unifying both sprints under one ship tag.
- **DO NOT push to origin**. The push is /solvys-deploy's job; pushing here would tag both sprint branches before deploy validates them.
