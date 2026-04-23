# Sprint Brief: S31-T3 — Ollama-via-Hermes Fallback for All Agentic Operations

## Context

Sprint 2 (Harper 2.1). TP's parallel thread is reinstating VProxy as the primary AI provider (S31-T1). This track adds a **second-in-chain fallback**: when VProxy is unreachable or rate-limited, every agentic operation automatically routes to **Ollama via the Hermes sidecar**, using **Qwen's latest free cloud model** (confirm exact model ID with TP — recent commit `6a7a2698` references `Qwen3.5:397b-cloud`; the latest free cloud-hosted Qwen on Ollama is likely `qwen3-coder:480b-cloud`; **verify before implementing**).

The fallback is silent — Harper, the brief generator, the Strands agents, desk agents, Harper Vision description calls, everything — when VProxy errors, the request retries once against Ollama and returns the Ollama response without the caller knowing which provider answered. Logs tag the source.

## Branch Target

`s31-harper-2-1` (runs parallel with T2 and T4 after T1 merges)

## Scope — Included

### Provider chain implementation

- [ ] New service `backend-hono/src/services/ai/provider-chain.ts`:
  - Primary: VProxy (`localhost:8317`) via existing `vproxy/anthropic-client.ts`
  - Fallback: Ollama via Hermes sidecar
  - Signature: `generateViaChain(request): Promise<{ response, provider: 'vproxy' | 'ollama-qwen' }>`
  - Retry logic: VProxy timeout/5xx → Ollama (one retry, no exponential backoff)
  - Error handling: if both fail, throw with both errors surfaced
  - Instrument with `console.log` tagged `[ai-chain]` including latency per provider
- [ ] New Ollama client `backend-hono/src/services/ai/ollama-hermes-client.ts`:
  - Talks to Hermes sidecar's `/v1/chat/completions` (OpenAI-compatible) or a dedicated `/v1/ollama` path — grep Hermes sidecar docs or code to find the right endpoint
  - Takes the same input shape as VProxy's client, adapts to Ollama's payload
  - Model ID read from env: `OLLAMA_FALLBACK_MODEL` (default `qwen3-coder:480b-cloud` — confirm with TP)
  - Streaming-capable to match VProxy streaming contract

### Wire the chain into every agentic call site

- [ ] `backend-hono/src/services/harper-handler.ts` — Harper chat (legacy path) → use `generateViaChain`
- [ ] `backend-hono/src/services/strands/agents/harper.ts` — Harper Strands path → same
- [ ] `backend-hono/src/services/strands/agent-factory.ts` — Oracle, Feucht, Consul, Herald all route through the chain
- [ ] `backend-hono/src/services/data/brief-generator.ts` (or wherever `/api/data/brief/generate` lives — grep) → use chain
- [ ] Harper Vision frame description call (from S31-T2) → use chain
- [ ] Any Harper-Ops Routine endpoint that generates text → use chain
- [ ] Audit: `grep -r "vproxy\|generateTextViaVProxy\|createModelClient" backend-hono/src/ --include='*.ts'` — every direct provider call should route through the chain (or be exempted with a clear comment)

### Env + config

- [ ] Add to `.env.example` (root + `backend-hono/`):
  ```
  OLLAMA_FALLBACK_ENABLED=true
  OLLAMA_FALLBACK_MODEL=qwen3-coder:480b-cloud
  HERMES_SIDECAR_URL=http://localhost:3100
  ```
- [ ] Add to `backend-hono/src/config/ai-config.ts`:
  - Provider entry for `ollama-hermes` with the model list
  - Helper `isOllamaFallbackEnabled()`

### Health + observability

- [ ] Extend `GET /api/diagnostics` response with:
  ```json
  { "ai": { "primary": { "provider": "vproxy", "available": true, "latencyMs": 42 },
             "fallback": { "provider": "ollama-hermes", "model": "qwen3-coder:480b-cloud", "available": true, "latencyMs": 210 } } }
  ```
- [ ] Log every fallback fire: `[ai-chain] vproxy failed (${error}), falling back to ollama-qwen for request ${requestId}`
- [ ] Counter metric (in-memory): fallback count per hour; expose at `GET /api/diagnostics/ai-chain-stats`

### Tests / smoke

- [ ] Manual: kill VProxy (`launchctl unload io.solvys.vproxy` if applicable), POST to `/api/harper/chat`, confirm response streams from Ollama and log tags `[ai-chain] fallback`
- [ ] Manual: restart VProxy, repeat, confirm primary path used
- [ ] Verify Harper Vision description call falls back cleanly when VProxy down

### Changelog + headers

- [ ] Changelog entry
- [ ] `// [claude-code 2026-04-23] S31-T3 Ollama fallback chain` atop each modified file

## Scope — Excluded (DO NOT TOUCH)

- Kimi K2 anything — already gone via T1
- GitHub Models integration — gone via T1
- VProxy internals (`vproxy/anthropic-client.ts`) — leave as-is
- OpenRouter BYO (that's S33 per TP's roadmap)
- Hermes sidecar itself — treat as black box, talk over HTTP

## Known Issues to Preserve

- Hermes sidecar STT (`/v1/voice/stt`) is already used by Harper Vision — **do not disturb its current contract**; Ollama LLM routing is a separate path.
- Model ID: confirm with TP. If `qwen3-coder:480b-cloud` isn't current, use whatever Qwen free model TP specifies.
- Fallback MUST be silent at the API level. Callers receive the same response shape regardless of which provider answered. Only logs + `/diagnostics` reveal the source.

## Implementation Steps

1. Grep Hermes sidecar integration points to learn its LLM endpoint (distinct from `/v1/voice/stt`).
2. Confirm Qwen model ID with TP before coding.
3. Write `ollama-hermes-client.ts` with streaming support.
4. Write `provider-chain.ts` with retry + tagging.
5. Refactor each call site to use the chain. Keep diffs minimal — single import swap + function swap per site.
6. Extend `/diagnostics`.
7. Smoke: kill VProxy, exercise Harper chat + brief generation + a Strands agent + Harper Vision description, confirm all fall back cleanly. Restart VProxy, confirm primary path.
8. Changelog + headers.

## Acceptance Criteria

- [ ] VProxy up: every agentic call routes through it; `/diagnostics` shows `primary.available=true`, zero fallback fires in last 5 min
- [ ] VProxy down: every agentic call still succeeds via Ollama-Qwen; responses arrive end-to-end; `/diagnostics` shows `primary.available=false`, `fallback.available=true`; logs tag fallback
- [ ] Both down: 500 with both errors surfaced, not a silent hang
- [ ] Model ID confirmed with TP and matches `.env`
- [ ] Harper Vision description call uses the chain
- [ ] No caller code needs to know which provider answered
- [ ] `bun run build` passes
- [ ] Changelog entry added

## Validation Commands

```bash
cd backend-hono && bun run build
cd ..

# Health with VProxy up
curl -s http://localhost:8080/api/diagnostics | jq '.ai'

# Force fallback
launchctl unload ~/Library/LaunchAgents/io.solvys.vproxy.plist 2>/dev/null
curl -s -X POST http://localhost:8080/api/harper/chat \
  -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"fallback test"}]}' | head -c 400

# Restore
launchctl load ~/Library/LaunchAgents/io.solvys.vproxy.plist
curl -s http://localhost:8080/api/diagnostics | jq '.ai.primary'
```

## Commit Format

```
[v5.23.0] feat: S31-T3 ollama-hermes fallback chain for all agentic operations
```
