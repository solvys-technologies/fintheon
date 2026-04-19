# S27-T4 — Shared Browser Primitives + Rettiwt Cut + Headline Telemetry

## Ownership

Claude-04, Wave 1, branch `s27-w1c-browser`, worktree `/Users/tifos/Desktop/Codebases/fintheon-s27-w1c`.

Primitives ship here; consumers (T6 Harper Browser Operator + T7 News Worker) are Claude-09 (W2d). Must land before W2d unblocks.

## Inspiration + Decisions

- [browser-use/browser-harness](https://github.com/browser-use/browser-harness) — self-healing CDP-native browser harness. "The agent writes what's missing, mid-task." Structural + similarity-based selector recovery when pages change. Devs offer a free Mac mini to anyone who finds a task it can't complete — TP cited that as the confidence signal.
- TP's decision: **browser-harness replaces Rettiwt and acts as fallback when Exa / AgentReach miss.** Rettiwt is cut from the dispatcher but code left inert for fast re-enable. Headline volume metric quantifies the tradeoff in the first 48h post-S27.

## Why Shared Primitives (not Herald-only)

T6 needs the same browser for Harper's `browse_task`; T7 runs the same browser in a sibling process. Building a Herald-specific harness and then replicating it twice is the wrong shape. Primitives live at `backend-hono/src/services/browser/` and are imported by Herald, Harper, and the news worker alike. Downstream callers set intent via a `mode` flag (`'allowlist' | 'universal'`) — same code paths.

## §1 — Browser pool

`backend-hono/src/services/browser/pool.ts`

Extract Playwright launch logic from `backend-hono/src/services/screenshot-service.ts` (audit-confirmed location). Pool is a singleton, max 4 concurrent pages (up from the audit's 2 — needed because Herald + Harper + news worker share). Reconnect on crash, LIFO page reuse.

Both `screenshot-service` (chart captures) and the new `harness.ts` consume from this pool. `screenshot-service.ts` gets refactored to import — not duplicate.

## §2 — Allow-list with tiered quotas

`backend-hono/src/services/browser/allowlist.ts`

Not a binary list anymore. Per-domain daily-quota tiers:

```ts
export const BROWSER_ALLOWLIST: BrowserAllowlistEntry[] = [
  { domain: "sec.gov", tier: "regulatory", dailyQuota: 200 },
  { domain: "federalreserve.gov", tier: "regulatory", dailyQuota: 50 },
  { domain: "bls.gov", tier: "regulatory", dailyQuota: 50 },
  { domain: "treasury.gov", tier: "regulatory", dailyQuota: 50 },
  { domain: "polymarket.com", tier: "market", dailyQuota: 100 },
  { domain: "kalshi.com", tier: "market", dailyQuota: 100 },
  // Post-Rettiwt Twitter/X capture:
  { domain: "x.com", tier: "social", dailyQuota: 500 },
  { domain: "twitter.com", tier: "social", dailyQuota: 500 },
  // Major newswires (for AgentReach fallback):
  { domain: "reuters.com", tier: "news", dailyQuota: 200 },
  { domain: "bloomberg.com", tier: "news", dailyQuota: 100 },
  { domain: "wsj.com", tier: "news", dailyQuota: 100 },
  { domain: "ft.com", tier: "news", dailyQuota: 100 },
];
```

Quota counter in-memory, mirrored to `browser_quota_ledger` table so it survives restarts. UTC midnight reset.

`mode: 'universal'` callers bypass the allow-list but pay per-URL: hard cap $0.01 in LLM cost per fetch (measured via OpenRouter spend signals), falls through to HTML `fetch` if exceeded. Universal mode is gated behind `BROWSER_UNIVERSAL_ENABLED=true` env flag — off by default, T6 will turn on.

## §3 — Harness wrapper

`backend-hono/src/services/browser/harness.ts`

Thin wrapper around the `browser-use` TypeScript SDK. Exposes:

```ts
export async function browseRead(opts: {
  url: string;
  mode: "allowlist" | "universal";
  waitFor?: "load" | "networkidle" | { selector: string; timeoutMs?: number };
  extract?: { schema: ZodSchema<any> }; // structured extraction via LLM
  textOnly?: boolean; // default true
  budget_usd?: number; // default 0.01 (universal only)
}): Promise<BrowseResult>;
```

Behavior:

- Self-healing on: when a CSS selector specified in `waitFor` or `extract` breaks, harness computes alternative candidates from semantic meaning / visual context / past successful interactions. Built-in to browser-use, we don't reimplement.
- Circuit breaker (reuses AgentReach pattern from `agent-reach-service.ts`): 3 consecutive failures per domain → 10-minute pause, auto-fall-through to raw `fetch`.
- Every call logs to `browser_fetches` table: domain, URL hash, status, latency_ms, cost_usd, self_heal_occurred, cached_xpath_used.
- Strips nav/header/footer before returning text. Reuses existing AgentReach cleaner.

## §4 — Rettiwt cut

Two files become inert:

- `backend-hono/src/services/rettiwt-service.ts`
- `backend-hono/src/services/rettiwt-poller-accounts.ts`

Cut from the dispatcher in [`backend-hono/src/services/agent-reach-service.ts`](backend-hono/src/services/agent-reach-service.ts) (or whichever module routes Herald sources — audit exact location): source-router no longer calls Rettiwt. Files + DB tables untouched; fast re-enable if coverage gaps show up.

Add a one-line comment at the top of each Rettiwt file:

```ts
// [claude-code 2026-04-19] Cut from Herald dispatcher during S27-T4. Left inert for fast re-enable. Delete in S29 if browser-harness coverage holds. Do NOT remove imports elsewhere without replacing data source.
```

## §5 — Headline volume telemetry

New migration `supabase/migrations/20260419_02_sources.sql`:

```sql
-- Add source tag + metadata to the RiskFlow items table.
alter table public.riskflow_items
  add column if not exists source text,          -- 'exa' | 'rettiwt' | 'agent-reach' | 'browser-harness'
  add column if not exists source_domain text,
  add column if not exists fetched_at timestamptz,
  add column if not exists fetch_latency_ms int;

create index if not exists riskflow_items_source_fetched_at_idx
  on public.riskflow_items (source, fetched_at desc);

-- Rolling 48h comparison view.
create or replace view public.v_headline_volume_48h as
select
  source,
  count(*) as headlines,
  avg(fetch_latency_ms) as avg_latency_ms,
  min(fetched_at) as earliest,
  max(fetched_at) as latest
from public.riskflow_items
where fetched_at > now() - interval '48 hours'
group by source;

create table if not exists public.browser_fetches (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  url_hash text not null,
  status int,
  latency_ms int,
  cost_usd numeric(10,4) default 0,
  self_heal_occurred boolean default false,
  cached_xpath_used boolean default false,
  failure_reason text,
  created_at timestamptz default now()
);

create table if not exists public.browser_quota_ledger (
  domain text not null,
  day date not null,
  fetches int not null default 0,
  primary key (domain, day)
);
```

Every source writes into `riskflow_items` with its `source` tag (Exa, AgentReach, browser-harness, or the now-inert Rettiwt for historical rows).

New route `GET /api/diagnostics/headline-volume`:

```ts
// backend-hono/src/routes/diagnostics.ts (edit existing diagnostics route file)
app.get("/api/diagnostics/headline-volume", async (c) => {
  const { data } = await supabase.from("v_headline_volume_48h").select("*");
  return c.json({ window: "48h", sources: data });
});
```

Small widget on the existing diagnostics page shows the per-source counts as a sparkline. Glassmorphic surface, accent-gold numerics, no gradients, no emojis. Widget lives in `frontend/components/diagnostics/HeadlineVolumeWidget.tsx`.

## §6 — Coordination with Herald source-router

Update the source-router (likely in [`backend-hono/src/services/agent-reach-service.ts`](backend-hono/src/services/agent-reach-service.ts)) so the order is:

1. Exa neural search (unchanged)
2. ~~Rettiwt~~ — removed from this list
3. If domain is in browser-harness allow-list OR universal mode is enabled → `browseRead({mode: 'allowlist'|'universal'})`
4. Fall through to AgentReach raw `fetch`

Tag every returned article with its `source` field for `riskflow_items` insertion.

## Files to touch

- NEW `backend-hono/src/services/browser/pool.ts`
- NEW `backend-hono/src/services/browser/allowlist.ts`
- NEW `backend-hono/src/services/browser/harness.ts`
- NEW `backend-hono/src/services/browser/index.ts` (barrel export)
- NEW `supabase/migrations/20260419_02_sources.sql`
- NEW `frontend/components/diagnostics/HeadlineVolumeWidget.tsx`
- EDIT `backend-hono/src/services/screenshot-service.ts` (refactor Playwright launch into pool import)
- EDIT `backend-hono/src/services/agent-reach-service.ts` (source-router: drop Rettiwt, add browser-harness tier)
- EDIT `backend-hono/src/services/rettiwt-service.ts` (header comment marking inert)
- EDIT `backend-hono/src/services/rettiwt-poller-accounts.ts` (header comment marking inert)
- EDIT `backend-hono/src/routes/diagnostics.ts` (new `/headline-volume` route)
- EDIT `frontend/components/diagnostics/DiagnosticsPage.tsx` (mount widget — audit exact path)
- EDIT `src/lib/changelog.ts`

## Validation

1. `cd backend-hono && bun run build` clean.
2. `browseRead({url: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=0000320193&type=8-K&dateb=&owner=include&count=40', mode: 'allowlist'})` returns title + body with ≥90% of the filings listed. Previous AgentReach `fetch` returned <40% because of JS-rendered rows.
3. `browseRead({url: 'https://x.com/search?q=%24AAPL', mode: 'allowlist'})` returns timeline tweets. Confirms Rettiwt replacement is viable.
4. Circuit breaker test: force 3 consecutive failures on `bloomberg.com`, confirm 4th call falls through to `fetch` + domain paused for 10 minutes in `browser_fetches` log.
5. Universal mode off test: `browseRead({url: 'https://random-blog.example.com', mode: 'universal'})` with `BROWSER_UNIVERSAL_ENABLED=false` → throws `UNIVERSAL_MODE_DISABLED`.
6. `GET /api/diagnostics/headline-volume` returns populated per-source counts. Widget renders without layout shift.
7. Restart local launchd backend; `/api/diagnostics` green.

## Ship

`v.27.3` when W1c merges to `v5.22`.
