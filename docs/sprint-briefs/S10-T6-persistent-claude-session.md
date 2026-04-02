# Task Brief: Persistent Claude CLI Session
**Date:** 2026-03-30
**Scope:** Replace per-request `claude --print` spawns with a single long-lived Claude Code session that persists across requests and refreshes daily at 6PM ET.
**Estimated files:** 4

## Context
Currently every chat message and brief generation spawns a fresh `claude --print` process. Each spawn loads a full context window (~200K tokens), which burns Max subscription usage and adds 3-5s cold-start latency. A persistent session would reuse one Claude process for all inference, dramatically reducing token overhead and response time. The session should refresh daily at 6PM ET to clear accumulated context.

## Files to Read First
- `backend-hono/src/services/claude-sdk/process-manager.ts` — Current spawner: `spawnClaudeProcess()`, `generateTextViaClaude()`, concurrency gate (`acquireSlot/releaseSlot`), config defaults
- `backend-hono/src/services/claude-sdk/bridge.ts` — Chat bridge: `bridgeChat()`, prompt building, stream parser. This is what the chat handler calls for streaming responses
- `backend-hono/src/routes/ai/handlers/chat.ts` — Chat handler PATH 0 (lines 268-380): calls `bridgeChat()` for all chat, streams via `createUIMessageStreamResponse`
- `backend-hono/src/services/brief-generator.ts` — Brief generator: calls `generateTextViaClaude()` for MDB/ADB/PMDB/WT generation
- `backend-hono/src/services/hermes-handler.ts` — Hermes handler: calls `generateTextViaClaude()` as primary, OpenRouter as fallback

## What to Build/Change

### 1. Persistent Session Manager
- **Path:** `backend-hono/src/services/claude-sdk/session-manager.ts`
- **Action:** Create
- **Spec:**
  - Spawns a single `claude` process using `--chat` mode (interactive, not `--print`)
  - Accepts prompts via stdin, reads responses from stdout (stream-json format)
  - Maintains a request queue — one prompt at a time, FIFO
  - Exposes `sendPrompt(prompt: string): AsyncGenerator<ClaudeStreamEvent>` for streaming
  - Exposes `sendPromptSync(prompt: string): Promise<string>` for non-streaming (brief gen)
  - Auto-restarts if the process dies unexpectedly
  - Scheduled refresh: kills and respawns at 6PM ET daily (via `node-cron` or `setInterval` with ET check)
  - Health check: `isSessionAlive(): boolean`
  - Startup: called from `boot/index.ts` alongside existing `initClaudeSDK()`
  - Falls back to per-request `spawnClaudeProcess` if session is unhealthy
- **Max lines:** 250

### 2. Update process-manager.ts
- **Path:** `backend-hono/src/services/claude-sdk/process-manager.ts`
- **Action:** Modify
- **Spec:**
  - Add `getSessionManager()` export that returns the singleton session instance
  - `generateTextViaClaude()` should try session first, fall back to per-request spawn
  - Keep `spawnClaudeProcess()` intact as fallback — don't delete it
  - Remove or reduce `MAX_CONCURRENT` since the session handles serialization
- **Max lines:** Keep under current length + 20

### 3. Update bridge.ts
- **Path:** `backend-hono/src/services/claude-sdk/bridge.ts`
- **Action:** Modify
- **Spec:**
  - `bridgeChat()` should route through the persistent session's `sendPrompt()` when available
  - Fall back to existing `spawnClaudeProcess()` if session is down
  - Prompt building (`buildPrompt()`) stays the same
  - Stream parser may need adjustment if `--chat` mode emits different JSON events than `--print`
- **Max lines:** Keep under current length + 30

### 4. Boot integration
- **Path:** `backend-hono/src/boot/index.ts`
- **Action:** Modify
- **Spec:**
  - Import and call `startPersistentSession()` after `initClaudeSDK()` health check passes
  - Log session start status
- **Max lines:** +5 lines

## Key Rules
- The `--chat` mode of Claude CLI reads prompts from stdin line by line and writes stream-json responses to stdout. Test this manually first: `echo "hello" | claude --chat --output-format stream-json`
- If `--chat` doesn't exist or behaves differently, use `--print` with a long-lived wrapper that reuses the same conversation via `--conversation-id`
- The session MUST be serialized — only one prompt in-flight at a time. Use an async queue (simple array + promise chain)
- The 6PM ET refresh should: (1) wait for any in-flight request to complete, (2) kill the process, (3) spawn fresh
- Environment vars to respect: `CLAUDE_BINARY_PATH`, `CLAUDE_SDK_MODEL`, `CLAUDE_SDK_TIMEOUT_MS`
- New env var: `CLAUDE_SESSION_REFRESH_HOUR_ET=18` (default 6PM)

## DO NOT
- Delete or break the existing per-request `spawnClaudeProcess()` — it must remain as fallback
- Change the chat handler routing logic in `chat.ts` — it already routes through bridge.ts
- Touch any frontend files
- Modify the brief generator's prompt construction
- Add new npm dependencies — use Node stdlib (`child_process`, `readline`)

## Verification
```bash
# Build
cd backend-hono && bun run build

# Start backend and check session is alive
nohup node dist/index.js > /tmp/fintheon-backend.log 2>&1 &
sleep 5
grep "Session.*alive\|Session.*started\|Persistent" /tmp/fintheon-backend.log

# Test chat goes through session (not per-request spawn)
curl -s -X POST "http://localhost:8080/api/ai/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"ping","conversationId":"test-session"}'
# Check logs — should see "session" not "Spawning: claude --print"
grep -i "session\|spawn" /tmp/fintheon-backend.log | tail -5

# Test brief generation through session
curl -s -X POST "http://localhost:8080/api/data/brief/generate"
grep "session\|Claude CLI generated" /tmp/fintheon-backend.log | tail -3
```

## Changelog Entry
```typescript
{
  date: '2026-03-31T00:00:00',
  agent: 'claude-code',
  summary: 'Persistent Claude CLI session — single long-lived process replaces per-request spawns, 6PM ET daily refresh',
  files: ['backend-hono/src/services/claude-sdk/session-manager.ts', 'backend-hono/src/services/claude-sdk/process-manager.ts', 'backend-hono/src/services/claude-sdk/bridge.ts', 'backend-hono/src/boot/index.ts']
}
```
