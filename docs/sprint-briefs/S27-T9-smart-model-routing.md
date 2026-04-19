# S27-T9 — Smart Model Routing (Absorbed S28-B)

## Ownership — split across Wave 1 + Wave 2

- **§1-2 Routing foundation**: Claude-05, Wave 1, branch `s27-w1d-soul-routing` (paired with T8), worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w1d`. Foundation lands defaults + telemetry scaffolding.
- **§3-5 Live per-agent routing**: Claude-10, Wave 2, branch `s27-w2e-routing-hub-gepa` (paired with T10 + T11), worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w2e`. Flips routing live after mid-sprint checkpoint.

## Inspiration + Decision

- [Hermes Agent v0.10 — SOUL.md + Smart Model Routing](https://blakecrosley.com/guides/hermes) — per-agent model selection with cost/quality telemetry. Hermes ships this upstream; we wrap it so `backend-hono` callers pick a model based on (agent, task type) without hardcoding.
- TP's decision: **full live routing** — not foundation-only. Per-agent: Oracle → `claude-opus-4-7`, Feucht → `claude-haiku-4-5`, Consul → `claude-sonnet-4-6`, Herald → `claude-haiku-4-5`, Harper → `claude-opus-4-7`. Voice assistant uses smartest free Qwen via sidecar.

## §1 — Routing table + registry (W1d)

Create [`backend-hono/src/services/ai/routing.ts`](backend-hono/src/services/ai/routing.ts):

```ts
export type AgentId =
  | "harper"
  | "oracle"
  | "feucht"
  | "consul"
  | "herald"
  | "harper-voice";
export type TaskType =
  | "chat"
  | "probability"
  | "tape"
  | "macro"
  | "news"
  | "voice"
  | "structured-extraction";

export interface RoutingRule {
  agent: AgentId;
  task?: TaskType; // optional task-type override
  model: string;
  provider: "anthropic" | "openrouter" | "hermes-sidecar";
  max_input_tokens: number;
  cost_per_mtoken_in_usd: number;
  cost_per_mtoken_out_usd: number;
}

export const ROUTING_TABLE: RoutingRule[] = [
  {
    agent: "harper",
    model: "claude-opus-4-7",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 15,
    cost_per_mtoken_out_usd: 75,
  },
  {
    agent: "oracle",
    model: "claude-opus-4-7",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 15,
    cost_per_mtoken_out_usd: 75,
  },
  {
    agent: "feucht",
    model: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 1,
    cost_per_mtoken_out_usd: 5,
  },
  {
    agent: "consul",
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 3,
    cost_per_mtoken_out_usd: 15,
  },
  {
    agent: "herald",
    model: "claude-haiku-4-5-20251001",
    provider: "anthropic",
    max_input_tokens: 200_000,
    cost_per_mtoken_in_usd: 1,
    cost_per_mtoken_out_usd: 5,
  },
  {
    agent: "harper-voice",
    model: "<QWEN_REASONING_LATEST>",
    provider: "hermes-sidecar",
    max_input_tokens: 32_000,
    cost_per_mtoken_in_usd: 0,
    cost_per_mtoken_out_usd: 0,
  },
];

export function selectModel(agent: AgentId, task?: TaskType): RoutingRule {
  /* ... */
}
```

`<QWEN_REASONING_LATEST>` is a placeholder — Claude-08 (T5) picks the concrete model during Wave 2 and commits the string. W1d leaves it as a typed constant.

Env-var overrides: `ROUTING_OVERRIDE_HARPER=claude-sonnet-4-6` swaps at runtime. Useful for A/B + cost experiments.

## §2 — Telemetry foundation (W1d)

New migration `supabase/migrations/20260419_04_gepa_metrics.sql` (shared with T11):

```sql
create table public.routing_decisions (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  agent_id text not null,
  task_type text,
  model text not null,
  provider text not null,
  input_tokens int,
  output_tokens int,
  cost_usd numeric(10,6),
  latency_ms int,
  user_feedback_score smallint,    -- 1-5, populated later via UI thumbs
  created_at timestamptz default now()
);

create index routing_decisions_agent_created_idx
  on public.routing_decisions (agent_id, created_at desc);

-- GEPA-ready metrics table (T11 consumes)
create table public.gepa_metrics (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  metric_name text not null,       -- 'accuracy', 'latency', 'cost_per_turn', 'handoff_success_rate'
  metric_value numeric not null,
  window_start timestamptz not null,
  window_end timestamptz not null,
  sample_size int not null,
  created_at timestamptz default now()
);
```

Every model call must write a `routing_decisions` row. Wrap calls through a single [`backend-hono/src/services/ai/llm-call.ts`](backend-hono/src/services/ai/llm-call.ts) helper that takes `(agent, task, messages, tools)` + emits the row automatically.

## §3 — Live per-agent routing (W2e)

Flip every call site to go through the routing layer:

- [`backend-hono/src/services/hermes-handler.ts`](backend-hono/src/services/hermes-handler.ts) — route each agent's OpenRouter call through `selectModel(agent).provider`
- [`backend-hono/src/services/harper-handler.ts`](backend-hono/src/services/harper-handler.ts) — Harper-Opus routing (keeps `claude-opus-4-7` by default, but routing layer is where it lives now)
- [`backend-hono/src/services/ai/sidecar-client.ts`](backend-hono/src/services/ai/sidecar-client.ts) — pass routing decision to sidecar's `/v1/routing/select` for voice calls
- Handoff tools (T3) — target agent's model picked via `selectModel(target_agent)`

Before merge: confirm `routing_decisions` table shows non-zero rows for each of the 5 agents post-smoke.

## §4 — Cost budget + degraded-mode fallback (W2e)

Every routing rule carries cost/token metadata. Add a per-user per-day budget (default $20/day/user) tracked in `user_budget_daily` table (new migration). When budget exceeded:

- Degrade Harper: Opus → Sonnet
- Degrade Oracle: Opus → Sonnet
- Consul stays Sonnet
- Feucht/Herald stay Haiku
- Log budget-exceeded events, emit notification to the diagnostics panel

This is explicitly NOT a hard cutoff — it's a graceful downgrade that keeps the platform working. Env var `ROUTING_DISABLE_BUDGET=true` for TP's own usage (TP should not get rate-limited).

## §5 — Diagnostics surfacing (W2e)

Add to `/api/diagnostics` response:

```json
{
  ...existing fields...,
  "routing": {
    "last_24h": {
      "harper": { "model": "claude-opus-4-7", "calls": 142, "total_cost_usd": 12.40, "avg_latency_ms": 2800 },
      "oracle": { ... },
      ...
    },
    "budget_status": { "user_id": "...", "used_usd": 4.10, "cap_usd": 20.00, "degraded": false }
  }
}
```

Expose a small widget under the existing diagnostics page showing per-agent cost + latency (glassmorphic, accent-gold numerics, no gradients).

## Known Issues to Preserve

- Existing hardcoded model strings in `agent-instructions/*.ts` — do not remove during W1d. W2e reads them for reference and then removes on final flip.
- Changelog entry 2026-04-20T03:15:00 (v5.22 mobile polish) — intentional, do not touch mobile

## Scope — Excluded (DO NOT TOUCH)

- SOUL.md files (T8 authors them; T9 reads `model_preferences` hints)
- Hermes sidecar Python code (W1b)
- Any `mobile/` or `frontend/` outside the diagnostics widget
- T11 GEPA evolutionary loop (separate brief; T9 only provides the metrics foundation)

## Files to touch

### W1d (foundation)

- NEW `backend-hono/src/services/ai/routing.ts`
- NEW `backend-hono/src/services/ai/llm-call.ts`
- NEW `supabase/migrations/20260419_04_gepa_metrics.sql` (also used by T11)
- EDIT `src/lib/changelog.ts`

### W2e (live)

- EDIT `backend-hono/src/services/hermes-handler.ts`
- EDIT `backend-hono/src/services/harper-handler.ts`
- EDIT `backend-hono/src/services/ai/sidecar-client.ts`
- EDIT `backend-hono/src/routes/diagnostics.ts` (routing + budget surface)
- NEW `supabase/migrations/20260419_07_user_budgets.sql`
- NEW `frontend/components/diagnostics/RoutingWidget.tsx`
- EDIT `frontend/components/diagnostics/DiagnosticsPage.tsx` (mount widget)
- EDIT `src/lib/changelog.ts`

## Validation Commands

```bash
cd backend-hono && bun run build
cd frontend && find dist -mindepth 1 -delete && npx vite build
```

Live smoke (W2e):

1. Send a probability-heavy query through Oracle → `routing_decisions` shows `model=claude-opus-4-7`.
2. Send a tape-read query through Feucht → `routing_decisions` shows `model=claude-haiku-4-5-20251001`.
3. Set `ROUTING_OVERRIDE_ORACLE=claude-haiku-4-5-20251001`, restart, re-query → table reflects override.
4. Force budget exceed (low `ROUTING_DAILY_CAP=0.01`) → next Harper call routes to Sonnet, `budget_status.degraded=true`.
5. `/api/diagnostics` shows `routing.last_24h` populated for all 5 agents.

## Commit Format

```
[v.27.4] feat: T9 Smart Model Routing foundation — routing table, telemetry, cost tracking    # W1d
[v.27.9] feat: T9 Smart Model Routing live — per-agent model selection flipped on all call sites  # W2e
```

## Ship

- `v.27.4` — W1d foundation
- `v.27.9` — W2e live routing (bundled with T10 + T11)
