# S27-T4 — Herald Browser-Harness (Track C, part 1 of 2)

## Inspiration

[browser-use/browser-harness](https://github.com/browser-use/browser-harness) — self-healing headless browser designed for LLM task completion. Retries on selector drift, handles JS-rendered content, exposes a small tool surface.

## The Gap

Audit finding:

> "Herald fetches news via three stacked sources — no raw browser rendering. AgentReach is a TypeScript `fetch`-based article scraper. No Playwright or headless browser in the Herald news pipeline. Playwright exists in `screenshot-service.ts` for chart captures only."

Sites that matter and break on fetch:

- **SEC EDGAR** filing detail pages — 8-K/10-Q exhibits are JS-rendered after the initial HTML
- **FOMC press release / minutes** pages — PDF embedded in viewer, title metadata lives in JS-populated DOM
- **Polymarket / Kalshi** live order books — DOM updates via WebSocket after page load
- **BLS release** pages at the moment of embargo lift (30s window where HTML lags)

Today Herald silently misses these.

## Branch / Worktree / CWD

- **Worktree**: `/Users/tifos/Desktop/Codebases/fintheon-s27-c`
- **Branch**: `s27-c-capabilities` off `v5.22`. Contains T4 and T5.
- Merge target: `v5.22` → ship tag `v.27.3`

## Scope — Included

### 1. Reuse existing Playwright

[`backend-hono/src/services/screenshot-service.ts`](backend-hono/src/services/screenshot-service.ts) already has Playwright bootstrapped. Extract the browser-launch logic into [`backend-hono/src/services/browser-pool.ts`](backend-hono/src/services/browser-pool.ts) as a shared singleton (max 2 concurrent pages; reconnect on crash). Both `screenshot-service` and the new Herald browser harness consume it.

### 2. Herald browser client

Create [`backend-hono/src/services/herald/browser-harness.ts`](backend-hono/src/services/herald/browser-harness.ts). Thin API:

```ts
type FetchOptions = {
  url: string;
  waitFor?: "load" | "networkidle" | { selector: string; timeoutMs?: number };
  extract?: { selectors: Record<string, string> }; // css → field name
  textOnly?: boolean; // default true
};

export async function browseRead(opts: FetchOptions): Promise<{
  url: string;
  title: string;
  body: string; // cleaned text
  fields?: Record<string, string>;
  status: number;
  rendered_at: string;
}>;
```

Behavior:

- Allow-list only (see §3). Unknown domain ⇒ throws with a `URL_NOT_ALLOWED` code; caller falls back to `AgentReach`.
- `waitFor` default: `networkidle`, 10s timeout.
- On selector miss during `waitFor`, retry once with `load` + 3s settle, then give up.
- Strip scripts, styles, nav/header/footer before returning `body`. Reuse existing AgentReach cleaner.
- `textOnly: false` returns raw HTML (for cases where Herald wants to run its own parser).

### 3. Allow-list + quota

Create [`backend-hono/src/services/herald/browser-allowlist.ts`](backend-hono/src/services/herald/browser-allowlist.ts):

```ts
export const BROWSER_ALLOWLIST = [
  { domain: "sec.gov", dailyQuota: 200 },
  { domain: "federalreserve.gov", dailyQuota: 50 },
  { domain: "bls.gov", dailyQuota: 50 },
  { domain: "treasury.gov", dailyQuota: 50 },
  { domain: "polymarket.com", dailyQuota: 100 },
  { domain: "kalshi.com", dailyQuota: 100 },
] as const;
```

Per-domain daily counter in memory (reset at UTC midnight) + logged row in `agent_memory` so it survives restarts. Exceeding quota ⇒ throws `QUOTA_EXCEEDED`; caller logs + falls back.

### 4. Wire into Herald source stack

Update [`backend-hono/src/services/herald/source-router.ts`](backend-hono/src/services/herald/source-router.ts) (audit exact file; likely lives near `agent-reach-service.ts`). New order:

1. Exa neural search (unchanged)
2. Rettiwt timeline (unchanged)
3. **Allow-list check** → if domain matches, call `browseRead`
4. Fall through to AgentReach fetch for everything else

Add a `source` tag on the returned article object: `'exa' | 'rettiwt' | 'browser' | 'agent-reach'` so RiskFlow cards can show provenance.

### 5. Circuit breaker

Reuse AgentReach's breaker pattern ([`agent-reach-service.ts`](backend-hono/src/services/agent-reach-service.ts)): 3 consecutive browser failures on the same domain ⇒ pause browser calls to that domain for 10 minutes, auto-fall-through to AgentReach.

### 6. Observability

Log every browser fetch to a new table (migration `supabase/migrations/20260419_browser_fetches.sql`):

```sql
create table public.browser_fetches (
  id uuid primary key default gen_random_uuid(),
  domain text not null,
  url text not null,
  status int,
  ms int,
  failure_reason text,
  created_at timestamptz default now()
);
```

TP can query failure rate per domain + tune allow-list weekly.

## Scope — Excluded

- No form submission / clicking through the site (read-only browser).
- No captcha solving.
- No cookie persistence across sessions.
- No LLM-in-the-loop for navigation (browser-harness the library does this; we're using a narrower read-only subset).
- No Rettiwt or Exa changes.
- Not a generic "browser tool" for Harper — T4 is Herald-only.

## Validation

1. `cd backend-hono && bun run build` clean.
2. Scripted test: fetch an SEC 8-K detail URL that was previously returning partial HTML via `AgentReach`. Expect full text body + non-empty title.
3. Allow-list reject test: `browseRead({url: 'https://example.com'})` → throws `URL_NOT_ALLOWED`.
4. Quota reject test: mock daily counter at `dailyQuota - 1`, make 2 calls → second throws `QUOTA_EXCEEDED`.
5. Circuit breaker test: force 3 failures on a domain, verify 4th attempt falls through to AgentReach.
6. `GET /api/diagnostics` green; browser pool reports healthy.

## Files to Touch

- NEW `backend-hono/src/services/browser-pool.ts`
- NEW `backend-hono/src/services/herald/browser-harness.ts`
- NEW `backend-hono/src/services/herald/browser-allowlist.ts`
- NEW `supabase/migrations/20260419_browser_fetches.sql`
- EDIT `backend-hono/src/services/screenshot-service.ts` (refactor to use `browser-pool`)
- EDIT `backend-hono/src/services/herald/source-router.ts` (or equivalent dispatcher)
- EDIT `backend-hono/src/services/agent-reach-service.ts` (only if the router wiring is inside it)
- EDIT `src/lib/changelog.ts`

## Ship

Commit prefix: `v.27.3`. Ships with T5 on the same branch; merge both into `v5.22` in sequence.
