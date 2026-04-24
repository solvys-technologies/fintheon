# Sprint Brief: S31 — Kimi Rollback + VProxy Reinstate (single-agent)

## Intent

TP opens any Fintheon surface — Harper chat, mobile PWA, brief generation, Strands agent runs — and the AI layer is routed back through the local VProxy gateway (`localhost:8317`) exactly as it was before the weekend Kimi experiment. No GitHub OAuth popup on launch, no Kimi-K2 option anywhere, no in-app "Update available" banner that shipped alongside Kimi. Provider dropdown keeps its three choices (VProxy / Nous / ORouter); default is VProxy. Every response Harper streams arrives via Claude Opus 4.6 through VProxy again.

Context: weekend experiment (SHA `98332f5d`, 2026-03-06) bolted Kimi K2 via GitHub Models + full GitHub OAuth + UpdateBanner onto the existing VProxy stack. Kimi underperformed; reverting to pre-Kimi state (SHA `74df8248`). VProxy plumbing is fully intact — this rollback is purely subtractive.

This is brief 1 of a 3-brief arc. **S32** will integrate VProxy into the new agentic system (pending TP's conflict list). **S33** will repurpose auth scaffolding into OpenRouter BYO (OAuth PKCE + paste-key, mobile-only) for users without a desktop account. Both are OUT OF SCOPE for S31.

## Branch Target

`rollback/kimi-reinstate-vproxy`

## Scope — Included

- [ ] Strip Kimi-K2 model config + GitHub Models provider from `backend-hono/src/config/ai-config.ts`
- [ ] Strip runtime GitHub token plumbing from `backend-hono/src/services/ai/model-selector.ts`
- [ ] Remove `setRuntimeGitHubToken` wiring from `backend-hono/src/routes/ai/handlers/chat.ts`
- [ ] Delete GitHub OAuth routes under `backend-hono/src/routes/auth/` + unregister in route index
- [ ] Delete `frontend/components/GitHubOAuthCallback.tsx`
- [ ] Delete `frontend/components/UpdateBanner.tsx`
- [ ] Strip GitHub token state + handlers from `frontend/contexts/AuthContext.tsx`
- [ ] Remove `UpdateBanner` mount + GitHub OAuth provider init from `frontend/App.tsx`
- [ ] Remove `UpdateBanner` + GitHub auth UI bindings from `frontend/components/chat/ChatHeader.tsx`
- [ ] Strip `GITHUB_REDIRECT_URI` / OAuth URL config from `electron/main.cjs`
- [ ] Restore pre-Kimi `.env.example` state (root + `backend-hono/`): `AI_PRIMARY_PROVIDER=anthropic-vproxy`, `USE_VPROXY_ANTHROPIC=true`, `VPROXY_BASE_URL=http://localhost:8317`; remove `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`
- [ ] Confirm no `kimi`/`moonshot`/`GITHUB_*`/`github-kimi`/`githubModels` string remains outside of `frontend/src/lib/changelog.ts` historical entries
- [ ] Verify VProxy consumers still compile and route: `strands/agent-factory.ts`, `strands/provider.ts`, `claude-sdk/bridge.ts`

## Scope — Excluded (OUT OF BOUNDS)

- Any refactor of VProxy itself (`backend-hono/src/services/vproxy/anthropic-client.ts`) — leave as-is
- New agentic-system integration — deferred to S32
- OpenRouter BYO / "Login with OpenRouter" / mobile-only auth flows — deferred to S33
- UpdateBanner-style version-check feature — deleted with Kimi, no replacement in this sprint
- Regime Tracker (mission control, dashboard card, modal) — MUST stay intact
- ThemeContext + theme system CSS variables — MUST stay intact
- `frontend/components/chat/ProviderDropdown.tsx` — already correct (local/nous/orouter), do not edit
- Any `GlassEffect`/`backdrop-blur` removal work — separate hygiene pass, not this brief

## Known Issues to Preserve

- Changelog entries in `frontend/src/lib/changelog.ts` dated before `2026-03-06` are intentional; do not rewrite history.
- `backend-hono/src/services/vproxy/anthropic-client.ts` top-of-file `[claude-code ...]` comments from `2026-04-10`, `2026-04-04`, `2026-04-03` are intentional and must survive.
- Pre-existing backdrop-blur in `ProviderDropdown.tsx` is a separate issue tracked elsewhere — leave alone.
- Do not revert via `git revert 98332f5d` — that commit also introduced Regime Tracker + Theme system, which must stay. Apply subtractive edits by hand, guided by the file list above.

## Design Pass

### Layout / Interaction

No new UI. After rollback:

- App launches without a GitHub OAuth prompt / popup.
- Chat header renders without `UpdateBanner` and without GitHub-auth UI; the provider dropdown remains, defaulting to "VProxy / Local".
- Harper chat streams tokens from Claude Opus 4.6 via `localhost:8317`, identical to the pre-Kimi experience.
- No toast, no modal, no GitHub-auth side-effect on any entry point.

### API / Service Shape

- VProxy consumers keep their current contracts. No new routes.
- `/api/auth/github/*` routes are removed — calls to them should 404. If any frontend code still references them post-rollback, delete the reference.
- `POST /api/harper/chat`, `POST /api/ai/chat`, `POST /api/data/brief/generate` all continue to honor their existing response shapes; only their model-selection branch changes (GitHub Models path is deleted).
- Fallback behavior: with `USE_VPROXY_ANTHROPIC=true` and VProxy down, existing code already falls back to OpenRouter (`generateTextViaVProxy` in `process-manager.ts:288-298`). Do not change that.

### Data / Agent Shape

No Supabase schema change. No agent-instruction edits. This is a pure code+config rollback.

### Aesthetic Rules

- Flat surfaces, thin `#c79f4a` border where separation is needed
- No gradients, no emojis, no glass blur, no Kanban borders, no box-shadows
- Typography and spacing per `/solvys-feels`

## Development Flow

1. **Config layer first** — edit `.env.example` (root + `backend-hono/`) and any `fly.toml` secrets references. Remove `GITHUB_*`. Set `AI_PRIMARY_PROVIDER=anthropic-vproxy`, `USE_VPROXY_ANTHROPIC=true`, `VPROXY_BASE_URL=http://localhost:8317`.
2. **Backend service layer** — strip Kimi from `backend-hono/src/config/ai-config.ts` (kill `github-kimi-k2` model, `githubModels` provider block at lines ~78, ~108, ~376, ~491, and `isGitHubModelsModel()` helper). Then `backend-hono/src/services/ai/model-selector.ts` (remove `_runtimeGitHubToken`, `setRuntimeGitHubToken()` export, GitHub Models branch in `createModelClient()`).
3. **Backend API layer** — `backend-hono/src/routes/ai/handlers/chat.ts` (drop `setRuntimeGitHubToken` import + call + logging). Delete GitHub auth under `backend-hono/src/routes/auth/` (files added in `98332f5d`) and unregister the router in `backend-hono/src/routes/index.ts`.
4. **Electron layer** — `electron/main.cjs`: remove `GITHUB_REDIRECT_URI`, any `auth/github/*` URL allowlist additions, OAuth intent handlers.
5. **Frontend data/context** — `frontend/contexts/AuthContext.tsx`: strip all `github*` token state/handlers/persistence added in the Kimi commit.
6. **Frontend UI** — DELETE `frontend/components/GitHubOAuthCallback.tsx` and `frontend/components/UpdateBanner.tsx`. Edit `frontend/App.tsx` (remove `<UpdateBanner />` + GitHub OAuth provider init + router entry for `/auth/github/callback`). Edit `frontend/components/chat/ChatHeader.tsx` (remove UpdateBanner usage, any GitHub-auth login/logout buttons added in the Kimi commit).
7. **Validation** — run the grep gate FIRST (below) so residual Kimi references surface before you burn time on builds. Then type-check + builds. Restart launchd backend. Curl diagnostics and confirm VProxy healthy. Smoke-test Harper chat via `POST /api/harper/chat`.
8. **Changelog + headers** — append entry to `frontend/src/lib/changelog.ts`: `{ date: '2026-04-23T...', agent: 'claude-code', summary: 'Rolled back Kimi K2 / GitHub Models experiment; reinstated VProxy (localhost:8317) as primary AI provider', files: [...] }`. Add `// [claude-code 2026-04-23] Kimi rollback: reinstate VProxy` at top of each substantially modified file.

## Acceptance Criteria

- [ ] `git grep -iE 'kimi|moonshot|github-kimi|githubModels|GITHUB_CLIENT|GITHUB_REDIRECT|setRuntimeGitHubToken|GitHubOAuthCallback|UpdateBanner'` returns 0 matches outside `frontend/src/lib/changelog.ts` history
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] Local backend restart succeeds (launchctl unload/load `io.solvys.fintheon-backend.plist`)
- [ ] `curl -s http://localhost:8080/api/diagnostics` returns healthy; VProxy section reports `available: true` against `localhost:8317`
- [ ] `curl -s -X POST http://localhost:8080/api/harper/chat -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"ping"}]}'` streams a Claude Opus response via VProxy
- [ ] Launching desktop app shows no GitHub OAuth popup and no UpdateBanner
- [ ] Regime Tracker (mission control card + modal) still renders identically to pre-rollback
- [ ] Theme system still toggles themes identically to pre-rollback
- [ ] Provider dropdown still shows VProxy / Nous / ORouter; default = VProxy
- [ ] Changelog entry added to `frontend/src/lib/changelog.ts`
- [ ] `// [claude-code 2026-04-23]` header added to each substantially modified file

## Validation Commands

```bash
# Grep gate — run FIRST, before any build
git grep -iE 'kimi|moonshot|github-kimi|githubModels|GITHUB_CLIENT|GITHUB_REDIRECT|setRuntimeGitHubToken|GitHubOAuthCallback|UpdateBanner' -- ':!frontend/src/lib/changelog.ts'

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Restart launchd-managed backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Live endpoint smoke tests
curl -s http://localhost:8080/api/diagnostics | jq '.vproxy, .ai'
curl -s -X POST http://localhost:8080/api/harper/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"ping"}]}' | head -c 400
```

## Commit Format

```
[v.04.23.1] fix: S31 roll back Kimi K2 experiment, reinstate VProxy as primary AI provider
```
