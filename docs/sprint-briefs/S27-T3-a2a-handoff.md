# S27-T3 — A2A Handoff Protocol (Track B, part 2 of 2)

## Inspiration

[Bitterbot-AI/bitterbot-desktop](https://github.com/Bitterbot-AI/bitterbot-desktop) — Agent-to-agent (A2A) protocol where desktop agents expose typed capabilities and invoke each other through a shared bus rather than a central router.

## The Gap

Audit finding (verbatim):

> "Oracle / Feucht / Consul / Herald are **not** called as sub-tools by Harper. The dispatch is regex-based intent routing in `hermes-handler.ts:67-185`. There is no A2A handoff protocol. The 'handoff' protocol in the dossiers (e.g., herald.ts:55-60) is instruction text, not functional plumbing."

Harper speaks _about_ the other agents — "Feucht would say the 4195 pivot is still active" — but never _to_ them. Every cross-desk reasoning chain is Harper hallucinating the other desk's voice.

## Dependency

T1 (Track A) must land `shared/harper-cards.ts` first. This task depends on the `agent-handoff` card variant to render in-flight handoffs in the Harper chat.

## Branch / Worktree / CWD

Same worktree as T2: `/Users/tifos/Desktop/Codebases/fintheon-s27-b`, branch `s27-b-agent-core`. T2 ships first; T3 stacks on top.

## Scope — Included

### 1. Agent router module

Create [`backend-hono/src/services/ai/agent-router.ts`](backend-hono/src/services/ai/agent-router.ts). Exposes:

```ts
type HandoffRequest = {
  from: "harper" | "oracle" | "feucht" | "consul" | "herald";
  to: "oracle" | "feucht" | "consul" | "herald";
  question: string;
  context_refs?: string[]; // sandbox IDs from T2
  depth: number; // incremented per handoff, cap at 2
  visited: string[]; // agent IDs already in this chain
};

type HandoffResponse = {
  from: string;
  body: string; // the responding agent's answer
  cards?: Card[]; // typed cards from T1
  memory_writes?: { key: string; value: unknown }[]; // agent_memory entries to persist
  follow_up_suggested?: HandoffRequest; // agent wants to escalate further
};

export async function handoff(req: HandoffRequest): Promise<HandoffResponse>;
```

Implementation: the router compiles the target agent's system prompt via existing `getAgentSystemPrompt()` from `agent-instructions/index.ts`, sends the `question` + context to the OpenRouter model assigned to that agent (same model as hermes-handler uses today), parses the response, and returns. If `follow_up_suggested` is non-null AND `depth < 2` AND the suggested target isn't in `visited`, the router chains automatically and returns the deepest result. Otherwise it surfaces the suggestion in the response for the caller to decide.

### 2. Harper tool registration

Update [`backend-hono/src/services/harper-handler.ts`](backend-hono/src/services/harper-handler.ts) to register four new first-party tools for the Claude CLI:

- `handoff_to_oracle({question, context_refs?})` → calls `agent-router.handoff({to: 'oracle', …})`.
- `handoff_to_feucht({question, context_refs?})` → same for Feucht.
- `handoff_to_consul({question, context_refs?})` → same for Consul.
- `handoff_to_herald({question, context_refs?})` → same for Herald.

Each tool returns the `HandoffResponse` body + cards. Harper's system prompt gains a section: "When a question requires another desk's expertise, call `handoff_to_<desk>`. Do not paraphrase — quote the desk's response verbatim under an `agent-handoff` card."

Rate limit: max 3 handoffs per Harper turn. Exceeding returns an error tool result Harper can read ("Already at handoff cap — synthesize from existing responses.").

### 3. Hermes handler upgrade

Today `hermes-handler.ts:67-185` regex-routes to one agent. Keep that fallback for direct intent matches, but also:

- Expose a `HERMES_ROUTER_MODE` env flag: `legacy` (regex) | `harper-first` (default new behavior).
- In `harper-first` mode, all Hermes messages route through Harper, which then decides whether to handle directly or invoke `handoff_to_*`.
- When the flag is `legacy`, behavior is unchanged — this is our rollback path.

### 4. Provenance in the UI

The `agent-handoff` card (Track A schema) renders with:

- Small accent-gold label: "HARPER → FEUCHT" with a 1px gold chevron.
- The target agent's response body beneath.
- Timestamp + `depth` indicator ("2nd hop").
- Click → expand to show the full handoff chain (from/to/question/response for each step), which requires Harper to emit the full chain as structured data. Add this to the card payload.

### 5. Loop prevention

Enforce at the router:

- `depth > 2` → reject with error.
- `to in visited` → reject.
- Token budget per chain: sum of response tokens < 4000. Exceeding ⇒ truncate + flag.

Log every handoff to `sandbox_metrics` (reuse T2's table; add `handoff_from`, `handoff_to` nullable columns) so TP can audit chain lengths and catch pathological loops early.

## Scope — Excluded

- No changes to the five agent system prompts themselves (their dossiers stay as-is).
- No UI for configuring rate limits (env var only).
- No persistent record of handoff chains beyond `sandbox_metrics` (full chain inspection is UI-click-to-expand, not a stored report).
- No Harper-to-Harper loops (Harper is the orchestrator, not a callable desk).

## Validation

1. `cd backend-hono && bun run build` clean.
2. Live chat: ask Harper "What's the macro read on tomorrow's CPI, and what futures levels should I watch?" — expect at least two `agent-handoff` cards (Consul for macro, Feucht for levels) rendered in the reply.
3. Loop test: mock Oracle to always suggest handoff to Oracle — expect rejection after depth 0 (self-handoff disallowed) or after visited-set enforcement.
4. Flag-flip test: set `HERMES_ROUTER_MODE=legacy` in local env, restart backend, confirm intent-based regex routing still works.
5. `sandbox_metrics` query: `select handoff_from, handoff_to, count(*) from sandbox_metrics where handoff_to is not null group by 1, 2` — populated after a few live tests.

## Files to Touch

- NEW `backend-hono/src/services/ai/agent-router.ts`
- EDIT `backend-hono/src/services/harper-handler.ts` (tool registration + prompt)
- EDIT `backend-hono/src/services/hermes-handler.ts` (mode flag)
- EDIT `backend-hono/src/services/ai/agent-instructions/index.ts` (expose a pure `buildPrompt(role, question, refs)` that the router uses — should already exist)
- EDIT `supabase/migrations/20260419_sandbox_metrics.sql` (add handoff columns to the table T2 creates)
- EDIT `src/lib/changelog.ts`

## Ship

Commit prefix: `v.27.2` (same tag as T2, this is the second commit on that track's sequence).
