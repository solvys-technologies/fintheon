# S27-T2 — Tool-Output Sandbox (Track B, part 1 of 2)

## Inspiration

[mksglu/context-mode](https://github.com/mksglu/context-mode) — sandbox MCP/tool output into a scratch store, inject only a reference into the LLM context. Reported 98% token reduction on tool-heavy conversations.

## The Gap

Audit confirmed:

> "No sandboxing or per-tool summarization layer. Tool results are appended to the conversation history and passed raw to the LLM. The conversation-level budget lives in `conversation-store.ts:24-25`: `MAX_CONTEXT_TOKENS = 100_000`, `SUMMARIZATION_THRESHOLD = 80_000`. Harper itself (claude-cli path) has no equivalent summarization layer."

Practically: one Hermes session that calls `close_search_leads` + `close_find_opportunities` + a handful of `rettiwt` timeline fetches can burn 40k+ tokens on tool payloads Harper only needs the _summary_ of.

## Branch / Worktree / CWD

- **Worktree**: `/Users/tifos/Desktop/Codebases/fintheon-s27-b`
- **Branch**: `s27-b-agent-core` off `v5.22`. This track contains **both** T2 and T3.
- **Start order**: T2 first (no dependency on Track A). T3 starts once Track A's `shared/harper-cards.ts` is on disk.

## Scope — Included

### 1. Sandbox store

Create [`backend-hono/src/services/ai/tool-sandbox.ts`](backend-hono/src/services/ai/tool-sandbox.ts). A per-conversation LRU keyed on conversation-id. Each entry:

```ts
type SandboxEntry = {
  id: string; // stable hash of tool + args + result prefix
  tool: string;
  args: unknown;
  result: unknown; // full raw payload
  tokens_estimated: number;
  summary: string; // 80-200 token LLM-generated digest
  created_at: number;
};
```

APIs:

- `sandbox.stash(convId, tool, args, rawResult) → { id, summary, ref }` where `ref` is `<<sandbox:{id}>>`.
- `sandbox.hydrate(convId, id) → rawResult | undefined`.
- `sandbox.purgeConv(convId)` on conversation end.

LRU cap: 100 entries per conversation, 10MB total. Entries evicted oldest-first.

### 2. Summarizer

Long tool outputs (>1500 estimated tokens OR >6KB string length) get summarized by a cheap fast model. Add [`backend-hono/src/services/ai/tool-summarizer.ts`](backend-hono/src/services/ai/tool-summarizer.ts):

- Model: Claude Haiku 4.5 via VProxy (`http://localhost:8317`) using `claude-haiku-4-5-20251001`. Max 300 output tokens.
- Prompt: "Summarize the following `<tool>` result in under 200 tokens. Preserve IDs, URLs, timestamps, and numeric values verbatim. Omit prose."
- Cache by stable hash. Same hash ⇒ skip LLM call.
- On summarizer failure: fall back to first 1200 chars of the raw result with a `[truncated]` sentinel (never block the turn).

### 3. Hermes integration

Wire into [`backend-hono/src/services/hermes-handler.ts`](backend-hono/src/services/hermes-handler.ts) tool-call loop:

- After a tool returns, replace the tool-result message in the conversation transcript with `{ tool, args, sandbox_ref: id, summary, tokens_estimated }`.
- If the LLM emits `<<sandbox:{id}>>` in a subsequent message OR requests a `hydrate_tool_result` tool call, return the raw payload for that turn only.
- Lower `SUMMARIZATION_THRESHOLD` from 80_000 to 30_000 once sandbox is live (fewer whole-transcript summaries because per-tool summaries carry most of the weight).

### 4. Harper (claude-cli bridge) integration

Harper runs through the Claude CLI — we don't control its tool loop directly. Instead:

- Intercept MCP tool responses in [`backend-hono/src/services/harper-handler.ts`](backend-hono/src/services/harper-handler.ts) before they stream back. (Audit exact MCP proxy layer; if `vproxy` or `claude-cli` handles tools internally, this intercept lives in the VProxy gateway config.)
- Any tool response over threshold gets stashed; the CLI sees the summary + ref.
- Expose a first-party tool `hydrate_sandbox(id: string)` that Harper can call when it decides it needs the full payload.

If intercepting at the CLI layer is infeasible in-sprint, ship Hermes-side sandbox only and note the Harper gap in the unification debrief.

### 5. Observability

Add columns to the existing `agent_memory` table (new migration `supabase/migrations/20260419_sandbox_metrics.sql`):

```sql
create table public.sandbox_metrics (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null,
  tool text not null,
  raw_tokens int not null,
  summary_tokens int not null,
  hydrated boolean default false,
  created_at timestamptz default now()
);
```

Emit a row per stash so TP can query `select avg(raw_tokens - summary_tokens) from sandbox_metrics` to measure savings.

## Scope — Excluded

- No UI changes (Track A owns frontend).
- No changes to `MAX_CONTEXT_TOKENS` itself (stays at 100k — we're reducing consumption, not the ceiling).
- No eviction policy tuning beyond "LRU, caps above."

## Validation

1. `cd backend-hono && bun run build` clean.
2. Run a scripted Hermes conversation with 20 tool calls against a mock set (can reuse existing Close CRM fixture under `backend-hono/test/`). Measure tokens stashed vs tokens sent to LLM.
3. Ask for a hydrate explicitly ("show me the raw result from the 3rd lead search") — verify `hydrate_sandbox` fires and raw data returns.
4. Query `sandbox_metrics`: `select tool, count(*), avg(raw_tokens - summary_tokens) from sandbox_metrics group by tool`. Expect >70% reduction on the biggest offenders.
5. Restart local launchd backend (`launchctl unload` + `load`) + `GET /api/diagnostics` green.

## Files to Touch

- NEW `backend-hono/src/services/ai/tool-sandbox.ts`
- NEW `backend-hono/src/services/ai/tool-summarizer.ts`
- NEW `supabase/migrations/20260419_sandbox_metrics.sql`
- EDIT `backend-hono/src/services/hermes-handler.ts`
- EDIT `backend-hono/src/services/conversation-store.ts` (threshold change, import sandbox)
- EDIT (optional) `backend-hono/src/services/harper-handler.ts` (if intercept feasible)
- EDIT `src/lib/changelog.ts`

## Ship

Commit prefix: `v.27.2` (pairs with T3). Land T2 first on its own commit, then T3 on top.
