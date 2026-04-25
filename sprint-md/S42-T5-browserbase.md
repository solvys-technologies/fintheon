# Sprint Brief: S42-T5 — Browserbase Agent-Iframe Plugin

## Context

Brotzky (Apr 2026): "I get annoyed when I have to open an app because AI can't complete the flow." Fintheon agents currently scrape the web silently via Playwright (`backend-hono/src/services/browser/`); the user can't see what the agent is doing. This track adds **Browserbase**, a managed remote-browser service, as a user-visible layer. Agents call a new tool `browse_visible(task)` → backend spins a Browserbase session → the live session URL streams back as an `artifact` event → the frontend ArtifactPane (T4) mounts it as a live iframe so the user watches the agent navigate in real time.

Backend Playwright at `services/browser/operator.ts` stays for silent server-side scraping. Browserbase is the **user-visible** path.

## Branch Target

`s42-t5-browserbase` (cut from worktree `~/Desktop/Codebases/fintheon-s42-chat-sota` off `v5.28.0`)

## Scope — Included

### Backend

- [ ] NEW `backend-hono/src/services/browser/browserbase.ts` — session manager wrapping `@browserbasehq/sdk`
- [ ] NEW `backend-hono/src/routes/browserbase.ts` — `POST /api/browserbase/session` issues a live session URL to the frontend
- [ ] NEW agent tool `browse_visible(task: string, ticker?: string)` registered with the agent runtime — returns `{ sessionUrl, status }` and emits an `artifact` BridgeStreamEvent
- [ ] Add `BROWSERBASE_API_KEY` to `backend-hono/.env.example`
- [ ] Fallback: if `BROWSERBASE_API_KEY` is missing, downgrade to backend Playwright (`browser/operator.ts`) and stream screenshots into the artifact pane every 1.5s instead

### Frontend

- [ ] Extend `frontend/components/layout/EmbeddedBrowserFrame.tsx` to accept `mode="browserbase"` prop — same iframe rendering, but adds:
  - `allow="clipboard-read; clipboard-write"` sandbox flag (Browserbase needs it)
  - `onLoad` listener for `postMessage` from Browserbase SDK to stream nav events back into chat as a sub-message
- [ ] Mobile: same `mode="browserbase"` extension on any mobile equivalent (audit `mobile/components/embed/EmbedPreview.tsx` — likely needs no change since artifact iframes mount via T4's `ArtifactSheet`)

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/browser/operator.ts` — preserved (used as fallback)
- `backend-hono/src/services/browser/harness.ts`, `pool.ts`, `allowlist.ts` — preserved verbatim
- `frontend/components/chat/ArtifactPane.tsx` (T4) — T5 doesn't mount the pane, just provides the URL the pane consumes
- `frontend/components/chat/ArtifactSlot.tsx` (T4) — T5 just guarantees `EmbeddedBrowserFrame` accepts the `mode` prop
- `frontend/components/narrative/SanctumChart.tsx` (memory: TradingView Sanctum chart preserved)
- All other `EmbeddedBrowserFrame` callers (`SanctumChart`, `ConsiliumHub`, `MainLayout` preload, `FluxerEmbed`) — must continue to work unchanged when `mode` is undefined
- T1 stream protocol — T5 emits the new `artifact` event type defined by T1; the type itself is owned by T1
- MCP routes
- Refinement Engine

## Reuse Inventory

- `@browserbasehq/sdk` — official Browserbase Node SDK (verify exact npm name during install; common variants: `@browserbasehq/sdk`, `browserbase`)
- `EmbeddedBrowserFrame` at `frontend/components/layout/EmbeddedBrowserFrame.tsx:28-33` — current iframe/webview switch; extend with `mode` prop, do not fork
- `services/browser/operator.ts` `browseTask()` — fallback path when Browserbase key absent
- `services/browser/pool.ts` Playwright singleton — used by fallback
- BridgeStreamEvent `{type:"artifact", kind:"browserbase", payload:{sessionUrl}}` from T1
- Agent tool registration pattern — search `backend-hono/src/services/` for existing tool definitions (e.g., where the RiskFlow tool is registered) and mirror

## Known Issues to Preserve

- Per-domain circuit breaker in `harness.ts` — does NOT apply to Browserbase (it's a different transport)
- `screenshot-service.ts` Playwright pool sharing — Browserbase uses its own pool, no conflict
- Memory: "no key caution lectures" — wire the env var silently; do not log warnings about exposure or rotation
- Memory: "Fly apps run 24/7" — do not change `min_machines_running`; the new route adds endpoints, not workers

## Implementation Steps

1. **Install SDK**:
   ```bash
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota/backend-hono && bun add @browserbasehq/sdk
   ```
2. **Create `services/browser/browserbase.ts`**:
   - Read `BROWSERBASE_API_KEY` from env; if missing, export a sentinel that says "fallback to Playwright"
   - Function `createSession(task: string): Promise<{ sessionUrl: string, sessionId: string }>` — calls SDK to provision a session, returns the live URL the user iframe will mount
   - Function `closeSession(sessionId: string): Promise<void>` — cleanup
   - Function `runTask(sessionId: string, instruction: string): AsyncGenerator<{event: 'navigated'|'clicked'|'scrolled'|'done', detail: unknown}>` — drives the session via SDK, yields events the agent can describe to the user
3. **Create `routes/browserbase.ts`**:
   - `POST /api/browserbase/session` body `{task: string, conversationId: string}` → returns `{sessionUrl, sessionId}` (or `{fallback: true, mode: 'screenshot-stream'}` if no key)
   - `DELETE /api/browserbase/session/:id` → close
   - Register routes in `backend-hono/src/routes/index.ts`
4. **Register `browse_visible` agent tool**:
   - Find tool-registration pattern in existing agent code (e.g., RiskFlow tool, SEC fetcher) and mirror
   - Tool definition: `{ name: "browse_visible", description: "Drive a visible browser session the user can watch in real time. Use for showing earnings PRs, SEC filings, news articles, or any web research the user benefits from seeing.", inputSchema: { task: string, ticker?: string } }`
   - Tool handler: call `createSession(task)` → emit `{type:"artifact", kind:"browserbase", payload:{sessionUrl}}` BridgeStreamEvent → call `runTask(sessionId, task)` → yield each step as a `{type:"tool_call", status:"running", name:"browse_visible.{event}"}` event so the activity rail (T3) shows progress → emit `{status:"done"}` on completion
5. **Add ENV** to `backend-hono/.env.example`:
   ```
   BROWSERBASE_API_KEY=
   BROWSERBASE_PROJECT_ID=
   ```
6. **Fallback path**: if env missing, `runTask` calls `services/browser/operator.ts` `browseTask()` and screenshots every 1.5s (existing screenshot service); each screenshot is dispatched as `{type:"artifact", kind:"report", payload:{html: <img src=base64 />}}` so the artifact pane shows it
7. **Frontend `EmbeddedBrowserFrame.tsx` extension**:
   - Add prop `mode?: "default" | "browserbase"`
   - When `mode === "browserbase"`, set `allow="clipboard-read; clipboard-write"` on the iframe
   - Add `onLoad` listener that registers `window.addEventListener('message', ...)` filtered by `e.origin === <browserbase-origin>` — relays nav events back via a callback prop
   - Default behavior unchanged when `mode` is undefined

## Acceptance Criteria

- [ ] `POST /api/browserbase/session` returns a session URL when `BROWSERBASE_API_KEY` is set; returns fallback shape when absent
- [ ] Agent calling `browse_visible("show NVDA earnings PR")` emits an `artifact` event with `kind:"browserbase"` and a valid sessionUrl; T4 mounts it in the artifact pane; user sees live navigation
- [ ] Without API key: agent calls `browse_visible(...)` → fallback Playwright fires → screenshots stream as `report` artifacts → user sees a slideshow
- [ ] Existing `EmbeddedBrowserFrame` callers (`SanctumChart`, `ConsiliumHub`, `MainLayout` preload, `FluxerEmbed`) work unchanged
- [ ] Sanctum pinned TradingView chart unchanged
- [ ] `cd backend-hono && bun run build` clean
- [ ] `cd frontend && npx tsc --noEmit --project tsconfig.json` clean
- [ ] `cd mobile && npx tsc --noEmit` clean
- [ ] Local backend smoke: `curl -X POST http://localhost:8080/api/browserbase/session -H 'Content-Type: application/json' -d '{"task":"open google.com","conversationId":"test"}'` returns a session URL or fallback shape
- [ ] Routes registered in `routes/index.ts`; appear in `/api/diagnostics` route list (or wherever routes are enumerated)

## Validation Commands

```bash
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/backend-hono && bun add @browserbasehq/sdk
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/backend-hono && bun run build
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx tsc --noEmit --project tsconfig.json
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx tsc --noEmit

# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke
curl -s http://localhost:8080/api/diagnostics
curl -s -X POST http://localhost:8080/api/browserbase/session \
  -H 'Content-Type: application/json' \
  -d '{"task":"navigate to https://www.sec.gov","conversationId":"test"}'
```

## Banned Ornaments

- No UI from this track other than the iframe extension; no decorative chrome

## Commit Format

```
[v5.29.0] feat: T5 Browserbase agent-iframe plugin + EmbeddedBrowserFrame mode prop
```

## Notes

- DO NOT deploy to Fly during this track — only T9 unification deploys
- Verify the `@browserbasehq/sdk` package name during install; if it's named differently, update both this brief and the import paths
- Memory: "no key caution lectures" — wire `BROWSERBASE_API_KEY` silently; no rotation/exposure warnings
- Memory: "no fabricated incidents in comments" — describe the mechanism, not a narrative
