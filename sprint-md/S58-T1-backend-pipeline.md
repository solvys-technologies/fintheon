# Sprint Brief: T1 -- Backend Provider Pipeline + API Key Infrastructure

## Context

Fintheon currently routes AI calls through a multi-provider chain with VProxy (Claude Opus) as primary, Nous Research/OpenRouter as fallbacks, and a partial DeepSeek migration from 2026-04-29 that only covers sub-agent tasks. S58 shifts the entire platform to DeepSeek v4 Pro using the app's existing canonical model name, `deepseek-reasoner`, as the primary provider. It supports two DeepSeek paths: `DeepSeek (Direct)` via DeepSeek's OpenAI-compatible API and `DeepSeek (OC API)` via the OpenCode Go/Hermes agent API. VProxy becomes the 3rd fallback globally. The sprint also adds server-side encrypted API key storage so users can bring their own DeepSeek key and have it available across all devices.

This track handles the **backend half**: provider pipeline refactor, encrypted key storage, API key management endpoints, and agent instruction review for DeepSeek compatibility.

## Branch Target

`s58-deepseek-primary` (shared branch with T2)

## Scope -- Included

- [ ] `backend-hono/src/services/ai/routing.ts` — update ROUTING_TABLE: `deepseek-reasoner` primary for ALL agents, VProxy → 3rd fallback
- [ ] `backend-hono/src/services/hermes-service.ts` — update HERMES_TASK_MODEL_MAP: all tasks → `deepseek-reasoner`, resolveProvider mapping
- [ ] `backend-hono/src/services/ai/provider-chain.ts` — new fallback order: DeepSeek → OpenRouter → VProxy
- [ ] `backend-hono/src/services/ai/ollama-hermes-client.ts` — keep default model as `deepseek-reasoner`, rename refs from ollama→deepseek where appropriate
- [ ] `backend-hono/src/services/strands/provider.ts` — add `deepseek-direct` provider variant with DeepSeek API compat and `deepseek-oc-api` provider variant for OpenCode Go/Hermes API
- [ ] `backend-hono/src/services/strands/agent-factory.ts` — add `deepseek-direct` and `deepseek-oc-api` cases in createAgent() switch
- [ ] `backend-hono/src/services/strands/agents/harper.ts` — update Harper agent to use DeepSeek primary (VProxy as fallback)
- [ ] `backend-hono/src/services/ai/budget.ts` — update cost tracking for DeepSeek v4 Pro pricing
- [ ] `backend-hono/src/services/ai/agent-instructions/` — review all system prompts for DeepSeek compatibility (keep persona voices intact — this is the one thing that must NOT regress)
- [ ] `backend-hono/src/routes/harper/index.ts` — minor update for new provider routing
- [ ] `backend-hono/src/routes/arbitrum/index.ts` — update Arbitrum diagnostics to check DeepSeek health
- [ ] `backend-hono/src/routes/diagnostics/index.ts` — update AI provider health check for DeepSeek primary
- [ ] **NEW**: `backend-hono/src/services/ai/api-key-crypto.ts` — encrypt/decrypt API keys using aes-256-gcm with env-derived key
- [ ] **NEW**: `backend-hono/src/routes/settings/ai-keys.ts` — GET/POST/DELETE endpoints for user DeepSeek API key management
- [ ] **NEW**: `supabase/migrations/20260503_s58_user_api_keys.sql` — `user_api_keys` table (user_id uuid FK, provider text, encrypted_key text, key_label text, created_at, updated_at; RLS: user can only CRUD own keys)
- [ ] `backend-hono/src/boot/index.ts` — register new API key routes

## Scope -- Excluded (DO NOT TOUCH)

- Any frontend files (belongs to T2)
- Electron main/preload (belongs to T2)
- Mobile PWA code (belongs to T2)
- RiskFlow worker code (separate process, not part of this sprint)
- `backend-hono/src/services/claude-sdk/` (the old Claude CLI bridge — keep it but don't wire it as primary)

## Reuse Inventory (existing code to call, not reinvent)

- `HERMES_TASK_MODEL_MAP` at `backend-hono/src/services/hermes-service.ts:139` — task-to-model mapping table to update
- `resolveProvider()` at `backend-hono/src/services/hermes-service.ts:171` — provider resolution function
- `ARBITRUM_MODEL_PROVIDER_MAP` at `backend-hono/src/services/hermes-service.ts:165` — model→provider map
- `generateViaChain()` at `backend-hono/src/services/ai/provider-chain.ts:104` — non-streaming chain to reorder
- `streamViaChain()` at `backend-hono/src/services/ai/provider-chain.ts:197` — streaming chain to reorder
- `createVProxyModel()` at `backend-hono/src/services/strands/provider.ts:82` — pattern to follow for new DeepSeek provider
- `createAgent()` at `backend-hono/src/services/strands/agent-factory.ts:76` — provider switch to extend
- `createHarperAgent()` at `backend-hono/src/services/strands/agents/harper.ts:50` — primary agent to update
- `ROUTING_TABLE` at `backend-hono/src/services/ai/routing.ts:71` — routing rules to update
- `selectModel()` at `backend-hono/src/services/ai/routing.ts:143` — model selection logic
- `getAuthHeaders()` at `backend-hono/src/services/ai/ollama-hermes-client.ts:16` — auth pattern for API key
- Conversation store at `backend-hono/src/services/ai/conversation-store.ts` — thread bank (do not modify, only verify compatibility)
- Existing Rettiwt key management in `backend-hono/src/routes/settings/` — follow same pattern for AI keys route
- `src/lib/changelog.ts` — add entry after completion

## Known Issues to Preserve

- The old Claude CLI bridge (`backend-hono/src/services/claude-sdk/bridge.ts`) is intentionally kept as a legacy path — do not delete it, just stop routing to it by default
- Harper-CAO's agent persona and tool-calling loop must work identically after the provider change
- The `deepseek-reasoner` model ID from the April 29 migration is the canonical app naming for DeepSeek v4 Pro; do not invent `deepseek-v4-pro` unless DeepSeek's API docs require it later
- Budget/degrade logic in `backend-hono/src/services/ai/budget.ts` uses hardcoded per-model costs — must be updated for DeepSeek v4 Pro pricing
- Environment variables: keep `DEEPSEEK_API_KEY` as the existing server-side DeepSeek key, add `OPENCODE_GO_API_URL` and `OPENCODE_GO_API_KEY` for the `DeepSeek (OC API)` path if no existing env names are already present

## Implementation Steps

1. **Create Supabase migration** for `user_api_keys` table with RLS (can run early, no code dependency)
2. **Create `api-key-crypto.ts`** — encrypt/decrypt with `crypto` module, key derived from `ENCRYPTION_SECRET` env var
3. **Create `routes/settings/ai-keys.ts`** — GET (list masked keys), POST (add key), DELETE (remove key). Protect with Supabase JWT auth.
4. **Update `ollama-hermes-client.ts`** — keep DEFAULT_MODEL as `deepseek-reasoner`, update naming/comments away from Ollama where appropriate, verify auth header format
5. **Update `routing.ts`** — change all ROUTING_TABLE entries to use `deepseek-reasoner` as model, `deepseek-direct` as provider by default. Only VProxy remains as the 3rd fallback. Update `selectModel()` to prefer DeepSeek.
6. **Update `hermes-service.ts`** — HERMES_TASK_MODEL_MAP: all tasks → `deepseek-reasoner`. resolveProvider: map `deepseek-reasoner` to DeepSeek direct by default, with an explicit OpenCode Go/Hermes API route available for user-selected chat.
7. **Update `provider-chain.ts`** — reorder to: 1) DeepSeek primary, 2) OpenRouter fallback, 3) VProxy last resort. Update `isRetryable()` errors.
8. **Update `strands/provider.ts`** — add `createDeepSeekDirectModel()` following `createVProxyModel()` pattern, and `createDeepSeekOcApiModel()` for OpenCode Go/Hermes API. Add DeepSeek and OC API health checks.
9. **Update `strands/agent-factory.ts`** — add `"deepseek-direct"` and `"deepseek-oc-api"` cases in provider switch.
10. **Update `strands/agents/harper.ts`** — change auto-fallback: check DeepSeek health first → DeepSeek primary, VProxy 3rd. The harper-cao task still maps through HERMES_TASK_MODEL_MAP.
11. **Update `budget.ts`** — add DeepSeek v4 Pro pricing (input: ~$0.50/MTok, output: ~$2.19/MTok) for cost tracking.
12. **Update diagnostics routes** — `/api/diagnostics` should check DeepSeek API health as primary AI provider.
13. **Review agent instructions** — all files in `agent-instructions/`. Check for Claude-specific language, model references, or token limit assumptions. Update to be model-agnostic. **Preserve persona voices and tool access exactly.**
14. **Register new routes** in `boot/index.ts`.
15. **Add changelog entry** in `src/lib/changelog.ts`.
16. **Add a date comment** at the top of each modified file: `// [claude-code 2026-05-03] S58-T1: DeepSeek v4 Pro primary provider migration`

## Acceptance Criteria

- [ ] `POST /api/settings/ai-keys` — authenticated user can store an encrypted DeepSeek API key
- [ ] `GET /api/settings/ai-keys` — authenticated user can see their masked keys
- [ ] `DELETE /api/settings/ai-keys` — authenticated user can remove their key
- [ ] `GET /api/diagnostics` — shows DeepSeek as primary AI provider with green status (when key set)
- [ ] Harper chat still works (curl smoke test: `POST /api/harper/chat` with auth)
- [ ] All sub-agent tasks route through DeepSeek (Oracle, Feucht, Consul, Herald)
- [ ] Arbitrum deliberation routes through DeepSeek
- [ ] VProxy is never called unless DeepSeek + OpenRouter are both down (3rd fallback)
- [ ] Agent personas (Harper as CAO, Oracle as forecaster, Feucht as risk manager, etc.) produce responses with the same voice and tool access as before
- [ ] No Claude SDK bridge calls in the primary path
- [ ] `user_api_keys` table has RLS: user can only see/change their own keys
- [ ] All modified files under 300 lines (split if needed)

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# TypeScript check (no frontend changes in this track, but verify no breakage)
npx tsc --noEmit --project frontend/tsconfig.json

# API key endpoints smoke test (after local backend restart)
curl -X GET http://localhost:8080/api/settings/ai-keys \
  -H "Authorization: Bearer $(supabase jwt)"

# Harper chat smoke test
curl -X POST http://localhost:8080/api/harper/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(supabase jwt)" \
  -d '{"message":"Hello Harper, give me a 1-sentence market outlook"}'

# Diagnostics check
curl -s http://localhost:8080/api/diagnostics | jq '.services[] | select(.name | test("deepseek|ai"; "i"))'
```

## Commit Format

```
[S58] feat: T1 DeepSeek v4 Pro primary provider pipeline + encrypted API key storage
```
