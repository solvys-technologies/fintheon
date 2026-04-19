# S27-T6 — Harper Browser Operator

## Ownership

Claude-09, Wave 2, branch `s27-w2d-browser-ops` (paired with T7), worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w2d`.

Starts only after Wave 1 lands W1c (shared browser primitives). T6 and T7 ship together on the same branch; T6 commit lands first.

## Inspiration

- [hyperbrowserai/HyperAgent](https://github.com/hyperbrowserai/HyperAgent) — `page.ai(instruction)` + `page.extract(schema)` + `runFromActionCache()` for deterministic replay. Action cache is the sleeper feature: successful LLM-driven navigations save their XPath, subsequent calls replay without LLM cost; LLM-fallback only when page structure drifts.

## What This Adds to Harper

A new first-party tool `browse_task({url, objective, extract_schema?})` that makes Harper a browser _operator_, not just a reader. Existing T4 primitives do the reading; T6 adds the LLM-in-the-loop task-completion layer on top, gated by cost caps and action caching.

## Branch / Worktree / CWD

- **Worktree**: `/Users/tifos/Desktop/Codebases/fintheon-s27-w2d`
- **Branch**: `s27-w2d-browser-ops` off `v5.22` (rebased on W1c merge + any Wave 1 merges Harper-side)

## Scope — Included

### 1. Operator layer on W1c primitives

Create [`backend-hono/src/services/browser/operator.ts`](backend-hono/src/services/browser/operator.ts):

```ts
export async function browseTask(opts: {
  url: string;
  objective: string; // natural-language task
  extract_schema?: ZodSchema<any>; // if provided, returns structured data
  budget_usd?: number; // default 0.10 hard cap
  use_cache?: boolean; // default true
}): Promise<BrowseTaskResult>;
```

Internally:

- Hash `(url + objective + extract_schema_hash)` → lookup in `action_cache` Supabase table.
- Cache hit → replay saved XPath sequence via `page.click` / `page.fill` / `page.waitFor`. No LLM call. Return cached extracted data if `extract_schema` matched.
- Cache miss or XPath failure → LLM-driven navigation via browser-use SDK's `agent.run(objective)`. On success, persist the executed XPath sequence back to `action_cache`.
- Budget cap enforced at the OpenRouter spend layer (reuse existing spend tracking). Exceeding budget aborts the task with partial result.

### 2. Action cache table

New migration `supabase/migrations/20260419_05_action_cache.sql`:

```sql
create table public.action_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,          -- hash(url + objective + schema)
  url text not null,
  objective text not null,
  schema_hash text,
  xpath_sequence jsonb not null,           -- [{action, xpath, value?, waitFor?}, ...]
  extracted_data jsonb,                    -- only populated if extract_schema was provided
  success_count int default 0,
  failure_count int default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index action_cache_url_idx on public.action_cache (url);
create index action_cache_updated_at_idx on public.action_cache (updated_at desc);
```

Cache invalidation: after 3 consecutive replay failures, mark entry as stale (`failure_count >= 3 && last_failure_at > last_success_at`) and force LLM re-run on next call. After 30 days with no successful replay, auto-evict.

### 3. Harper tool registration

Update [`backend-hono/src/services/harper-handler.ts`](backend-hono/src/services/harper-handler.ts) to register `browse_task` as a first-party MCP tool Harper can call. Tool declaration:

```ts
{
  name: 'browse_task',
  description: 'Navigate a webpage and complete a task (read, extract, interact). Uses cached XPath replays when available for zero LLM cost. Max budget $0.10 per task.',
  input_schema: {
    type: 'object',
    required: ['url', 'objective'],
    properties: {
      url: { type: 'string', description: 'Full URL to navigate to' },
      objective: { type: 'string', description: 'Natural-language task in 1-2 sentences' },
      extract_fields: {
        type: 'object',
        description: 'Optional field map for structured extraction. Keys become JSON keys, values describe what to capture.',
        additionalProperties: { type: 'string' },
      },
      budget_usd: { type: 'number', description: 'Max spend (default 0.10)' },
    },
  },
}
```

Harper system-prompt addition (under a new "# Browser Operator" section): "When a user asks about a specific webpage or wants structured data from a page, call `browse_task`. Prefer cached replays for sites you've visited before. Always set `budget_usd` explicitly for expensive sites."

### 4. Universal mode gate

T6 is the first caller that enables `BROWSER_UNIVERSAL_ENABLED=true` at runtime. Confirm the W1c primitives respect the flag. Add a Harper-side guardrail: if Harper calls `browse_task` on a URL outside T4's allow-list and universal mode is off, the tool returns `{ error: 'URL_NOT_ALLOWED', suggestion: '<nearest-allowed-domain>' }` so Harper can try a different approach.

### 5. Observability

Every `browse_task` call logs to a new table `browse_task_runs`:

```sql
create table public.browse_task_runs (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,
  cache_hit boolean default false,
  objective text not null,
  url text not null,
  cost_usd numeric(10,4),
  duration_ms int,
  success boolean,
  failure_reason text,
  created_at timestamptz default now()
);
```

Include in the existing `/api/diagnostics` response: `cache_hit_rate_24h` computed from `browse_task_runs`. Target: >60% cache-hit rate after first week of use.

## Known Issues to Preserve

Per `src/lib/changelog.ts`, S26 mobile notification work + v.26.2 maintenance flows are recent — **do not touch**. Keep `frontend/components/diagnostics/` widget additions additive only; do not restructure existing diagnostics page.

## Scope — Excluded (DO NOT TOUCH)

- Anything outside `backend-hono/src/services/browser/operator.ts` (T4 owns pool/allowlist/harness)
- Any T5 voice files (Claude-08 owns)
- Any T7 news-worker files (same branch, but sequenced after T6 commit)
- Any `mobile/` paths (S26 territory)
- SOUL.md files (W1d-owned; read-only for T6)

## Files to touch

- NEW `backend-hono/src/services/browser/operator.ts`
- NEW `supabase/migrations/20260419_05_action_cache.sql`
- EDIT `backend-hono/src/services/harper-handler.ts` (register `browse_task` tool + system-prompt section)
- EDIT `backend-hono/src/routes/diagnostics.ts` (add `cache_hit_rate_24h`)
- EDIT `src/lib/changelog.ts`

## Validation Commands

```bash
# Type check
cd backend-hono && bun run build

# Fresh frontend build (stale-bundle prevention)
cd frontend && find dist -mindepth 1 -delete && npx vite build
```

Plus live smoke:

1. Harper given: "Use `browse_task` to pull Apple's latest 8-K filing summary from SEC EDGAR and extract `{date, type, brief_summary}`." → structured extraction returned, `action_cache` entry created.
2. Second call with same args → `action_cache` hit, `browse_task_runs.cache_hit = true`, cost_usd ≈ 0.
3. Mock SEC to change the page layout → replay fails, LLM re-runs, `action_cache` updated.
4. Budget cap test: call with `budget_usd: 0.001` → aborts early with partial result + budget-exceeded reason.
5. Universal mode off: call on `https://random.example.com` → returns `URL_NOT_ALLOWED`.
6. `GET /api/diagnostics` shows cache_hit_rate_24h field.

## Commit Format

```
[v.27.8] feat: T6 Harper Browser Operator — browse_task tool with Supabase-backed action cache
```

## Ship

`v.27.8` when W2d (T6 + T7 together) merges to `v5.22`.
