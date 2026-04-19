# S27-T2 — Hermes Python Sidecar + Lossless Context

## Ownership

- **§1-3 (sidecar infra, HTTP contract, deploy)**: Claude-03, Wave 1, branch `s27-w1b-sidecar`, worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w1b`.
- **§4-6 (context engine + backend integration + persistent-memory bridge)**: Claude-07, Wave 2, branch `s27-w2b-context-handoff` (paired with T3), worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w2b`.

Wave 2 starts only after the orchestrator's mid-sprint checkpoint confirms Wave 1 sidecar boots green on localhost and on a preview Fly machine.

## Inspiration

- [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) — the self-improving AI agent runtime. v0.9 shipped a pluggable `ContextEngine` ABC and v0.10 added SOUL.md + Smart Model Routing. By running Hermes as-is as a sidecar, Fintheon inherits the upstream plugin ecosystem (Icarus, hermes-lcm, GEPA) instead of reimplementing it in TypeScript.
- [stephenschoettler/hermes-lcm](https://github.com/stephenschoettler/hermes-lcm) — Lossless Context Management plugin. DAG-backed context engine with `lcm_grep` / `lcm_describe` / `lcm_expand` tools so the agent navigates old context instead of re-summarizing it.

## Decision Record

TP chose Python sidecar over a native TypeScript port. Rationale: upstream-compatible, plugin-portable, avoids a massive reimplementation that would diverge within a single release cycle. Cost: new Python infra + deploy + monitoring. Mitigation: legacy `hermes-handler.ts` path retained behind `HERMES_SIDECAR_ENABLED=false` rollback flag.

## §1 — Sidecar install + boot (W1b)

Install Hermes Agent as a service that runs alongside `backend-hono`.

- Local: launchd unit `io.solvys.fintheon-hermes` on port **8318** (backend is 8080, avoid collision). Auto-restart on crash via `KeepAlive` + `SuccessfulExit=false`. Boot verifies via `curl http://localhost:8318/healthz`.
- Prod: dedicated Fly.io app `fintheon-hermes` with `restart_policy = on-failure`. Internal networking to `fintheon` backend (6PN), no public IP. GPU sizing: start with `shared-cpu-4x` + 4GB RAM for the non-voice path; voice model sizing handled in §3.
- Python env pinned to `uv` + `pyproject.toml`. Do **not** use `pip`/`venv` — this matches the rest of our Python tooling.
- Hermes `config.yaml` picks `context.engine: lcm` (the hermes-lcm plugin) as default. Alternative engines can be selected per-conversation via HTTP header `X-Context-Engine`.
- Plugin preload list: `hermes-lcm`, `icarus-plugin` (memory), eventually GEPA (T11).

Repo home: new top-level directory `hermes-sidecar/`. Contains `pyproject.toml`, `config.yaml`, `entrypoint.py`, launchd plist, Fly `fly.toml`, Dockerfile.

## §2 — HTTP contract

Define the contract `backend-hono` speaks. All requests carry an internal-only JWT (`INTERNAL_HERMES_JWT`) + correlation id. All responses stream SSE when applicable.

```
POST /v1/chat
  body: { agent_id, conversation_id, user_message, system_overrides?, stream: true }
  sse: { type: 'delta'|'tool_call'|'tool_result'|'done', payload }

POST /v1/context/ingest
  body: { conversation_id, turn: ConversationTurn }

GET  /v1/context/view?conversation_id=…&budget_tokens=…
  → { turns: ConversationTurn[], summaries: SummaryNode[] }

POST /v1/context/tools/:tool_name
  body: { conversation_id, args }
  → tool-specific JSON

POST /v1/voice/stt      body: { audio_bytes, lang? }      → { transcript, words[] }
POST /v1/voice/tts      body: { text, voice_id, stream }  → audio stream (mp3/opus)

POST /v1/skills/invoke  body: { skill_id, args, context } → skill-defined JSON
GET  /v1/skills         → list of registered skill manifests

POST /v1/routing/select body: { agent_id, task_type, input_tokens }
                        → { model, provider, reasoning }
```

TypeScript types + Zod schemas in `shared/sidecar-contract.ts` (W1a owns file creation; W1b populates). Both ends import from the same file.

## §3 — Deploy verification

Before Wave 1 merges and unblocks Wave 2, Claude-03 must prove:

1. `launchctl load /Library/LaunchAgents/io.solvys.fintheon-hermes.plist` → service up.
2. `curl -H "Authorization: Bearer $INTERNAL_HERMES_JWT" http://localhost:8318/v1/chat -d '{"agent_id":"harper","conversation_id":"smoke","user_message":"ping","stream":true}'` → SSE stream with at least one `delta` + `done`.
3. Fly app deploys green via `fly deploy --config hermes-sidecar/fly.toml --no-cache`.
4. Internal-network smoke from backend Fly machine → sidecar Fly machine succeeds.
5. Rollback test: stop sidecar, set `HERMES_SIDECAR_ENABLED=false`, confirm legacy `hermes-handler.ts` path still works.

## §4 — Context engine integration (W2b)

Replace direct OpenRouter calls in `backend-hono/src/services/hermes-handler.ts` with sidecar proxy via `shared/sidecar-contract.ts` types.

- Every Hermes message flow: `POST /v1/context/ingest` (user turn) → `POST /v1/chat` (streaming reply) → handle any `tool_call` events (including `lcm_grep`, `lcm_describe`, `lcm_expand`) by routing to `POST /v1/context/tools/:name` → stream `delta` events to the frontend SSE.
- Delete the 80k threshold + Haiku whole-transcript summarizer from `conversation-store.ts`. Keep the file but hollow it out to a compatibility shim (imports still resolve during the transition).
- Per-conversation engine override: allow callers to pass `context_engine` in the conversation config (persisted on the `conversations.context_engine` column — new migration). Default `lcm`.

## §5 — Persistent-memory bridge

Existing Fintheon persistence (`agent_context_bank` + `agent_memory` Supabase tables) is richer than what Hermes ships out-of-the-box. Bridge them:

- Before `POST /v1/chat`, `backend-hono` fetches the user's `agent_context_bank` entries for the target agent + top 20 most-recent `agent_memory` rows; injects as `system_overrides.persistent_memory` so the sidecar can consume alongside SOUL.md.
- After `/v1/chat` completes, if the sidecar returns any `memory_writes` events, backend-hono persists to `agent_memory` with the correct `agent_id` + typed entries (`deliberation_output`, `learned_pattern`, etc.).
- `agent_context_bank` remains the user-scoped ground truth; the sidecar never writes to it directly.

## §6 — Observability

- New table `supabase/migrations/20260419_01_context_store.sql`: `context_messages` (immutable message log mirror), `context_summary_nodes` (DAG mirror), `conversations.context_engine` column. The sidecar is authoritative but a mirror in Supabase gives TP queryability + survives sidecar restarts.
- Sidecar streams `context_view` events that backend-hono logs to a `context_views` table (conversation_id, engine, turns_included, tokens_total). TP can query:

```sql
select engine, avg(tokens_total), avg(turns_included), count(*)
from context_views where created_at > now() - interval '24 hours'
group by engine;
```

## Files to touch

- NEW `hermes-sidecar/` top-level directory (entrypoint, pyproject, config, Dockerfile, Fly toml, launchd plist)
- NEW `shared/sidecar-contract.ts` (W1a creates empty; W1b populates — coordinate)
- NEW `backend-hono/src/services/ai/sidecar-client.ts` (typed HTTP client)
- NEW `supabase/migrations/20260419_01_context_store.sql`
- EDIT `backend-hono/src/services/hermes-handler.ts` (sidecar proxy + `HERMES_ROUTER_MODE` rollback flag preserved)
- EDIT `backend-hono/src/services/conversation-store.ts` (hollow to shim)
- EDIT `backend-hono/src/services/harper-handler.ts` (route via sidecar for non-claude-cli paths; T3 registers handoff tools)
- EDIT `src/lib/changelog.ts` (one entry per Claude on merge)

## Validation

Per-Claude validation:

- W1b: §3 five-point checklist green. Legacy hermes-handler.ts rollback confirmed.
- W2b: 100-turn scripted Hermes conversation stays under budget end-to-end (measure via `context_views` table). Agent successfully invokes `lcm_grep` and `lcm_expand` on a turn where the answer is more than 50 turns old. `agent_context_bank` entries verifiably injected and observable in sidecar logs.

## Ship

- W1b → `v.27.2`
- W2b → `v.27.6` (stacks with T3 on the same Wave 2 branch)
