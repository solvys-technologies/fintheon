# Sprint Brief: S42-T1 — Stream Protocol Upgrade

## Context

Fintheon's chat refactor needs richer SSE events so the frontend can render thinking traces, tool-call status pills, citation chips, and message footers (latency/sources/tokens). This track extends `BridgeStreamEvent` with 4 new event types and enriches the existing `complete` event. All changes are **additive and backwards-compatible** — frontend consumers ignore unknown types until T2/T3 wire them up.

This track is backend-only and unblocks every other track. T2/T3/T4/T5 can ship before T1 deploys to prod because they degrade gracefully when the new event types are absent.

## Branch Target

`s42-t1-stream` (cut from worktree `~/Desktop/Codebases/fintheon-s42-chat-sota` off `v5.28.0`)

## Scope — Included

- [ ] Extend `BridgeStreamEvent` discriminated union with new event types
- [ ] Emit new events from `harper-handler.ts` chat handler
- [ ] Enrich existing `complete` event with `latency_ms`, `source_count`, `model`, `prompt_tokens`, `completion_tokens`
- [ ] Update shared types in `frontend/types/bridge-stream.ts`
- [ ] Document new event shapes in inline comments

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/ai/agent-instructions/` (persona prompts)
- `backend-hono/src/services/brief-generator.ts` and any MDB/ADB/PMDB/TWT cron
- `frontend/components/chat/*` — those are T2/T3
- Any frontend rendering of new events — that is T3
- MCP routes at `backend-hono/src/routes/mcp/*` — preserved verbatim
- Supabase migrations
- `.mcp.json`

## Reuse Inventory

- `BridgeStreamEvent` type at `frontend/types/bridge-stream.ts` — extend the union, do not replace it
- `harper-handler.ts` `AsyncGenerator<BridgeStreamEvent>` pattern at `backend-hono/src/services/harper-handler.ts` — keep generator shape, add new yield types
- `buildAquariumContext()` and `buildBoardroomContext()` at `backend-hono/src/services/harper-handler.ts` — surface-context wiring stays unchanged (T6 wires output cards to call sites)
- Existing token streaming pattern (look for `yield { type: "token", ... }`) — emit `thinking` events the same way

## Known Issues to Preserve

- Memory flush every 10 messages — keep behavior; new events count toward the limit
- Persona switching reloads system prompt — do not change; T2 adds slash-command override at the composer layer
- RiskFlow context duplication across turns — known issue, do NOT fix here
- Stream abort handling — do not change behavior; T2 wires `Esc` cancel at the UI layer

## Implementation Steps

1. **Extend type union** at `frontend/types/bridge-stream.ts`. Add to the discriminated union:
   ```typescript
   | { type: "thinking"; token: string }
   | { type: "tool_call"; id: string; name: string; status: "pending" | "running" | "done" | "failed"; duration_ms?: number }
   | { type: "citation"; id: number; source: string; url?: string; snippet?: string }
   | { type: "artifact"; kind: "tradingview" | "browserbase" | "report" | "citation"; payload: Record<string, unknown> }
   ```
2. **Enrich `complete` event** — find existing `{ type: "complete", ... }` shape in the same file and add optional fields:
   ```typescript
   latency_ms?: number;
   source_count?: number;
   model?: string;
   prompt_tokens?: number;
   completion_tokens?: number;
   ```
   Mark all as optional so existing consumers don't break.
3. **Wire emission in `harper-handler.ts`**:
   - Where existing tool calls execute, yield `{ type: "tool_call", id, name, status: "running" }` before invoke and `{ type: "tool_call", id, name, status: "done", duration_ms }` after.
   - Where citations come back from RiskFlow / SEC fetcher / Arbitrum verdicts, yield `{ type: "citation", id, source, url, snippet }`.
   - When the model streams reasoning tokens (only if the underlying provider exposes them — check OpenRouter response shape), yield `{ type: "thinking", token }`.
   - Track `startTime = Date.now()`; on `complete` yield `latency_ms: Date.now() - startTime`. Pull `model` from the request, `prompt_tokens` / `completion_tokens` from the provider response, `source_count` from the citation count this turn.
4. **Wire emission in `routes/harper-chat.ts`** if it does any post-processing of the stream — pass through new event types unchanged.
5. **Inline comment doc** at the top of the type union explaining each new event's purpose and which UI track consumes it (T3 for thinking/tool_call/citation, T4 for artifact).
6. **No new routes.** No new env vars. No new dependencies.

## Acceptance Criteria

- [ ] `BridgeStreamEvent` union compiles in both `frontend/` and `backend-hono/` with the new variants
- [ ] `cd backend-hono && bun run build` clean
- [ ] `cd frontend && npx tsc --noEmit --project tsconfig.json` clean
- [ ] Local curl smoke: send a chat message → SSE stream contains at least one `tool_call` event (if any tool was called) and an enriched `complete` event with `latency_ms`
- [ ] Existing chat works end-to-end on localhost (no regression)
- [ ] No changes to MCP routes, brief generators, or persona prompts (verify via `git diff --stat`)

## Validation Commands

```bash
# Type check
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx tsc --noEmit --project tsconfig.json

# Backend build
cd ~/Desktop/Codebases/fintheon-s42-chat-sota/backend-hono && bun run build

# Restart local backend (memory: launchd-managed)
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke
curl -s http://localhost:8080/api/diagnostics | head -50
curl -N -X POST http://localhost:8080/api/harper/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is the current VIX?","conversationId":"test","history":[]}' | head -100
```

## Commit Format

```
[v5.29.0] feat: T1 extend BridgeStreamEvent with thinking/tool_call/citation/artifact events
```

## Notes

- DO NOT deploy to Fly during this track — backend deploy lands during T9 unification only
- Memory: "Backend deploys must restore prod" — only T9 runs `fly deploy`
- Memory: "no plaintext secrets in changelog strings"
