# Sprint Brief: T5 — Source-accounts → news-worker wiring (WS1)

## Context

Refinement Engine's `SourceAccountsManager` UI persists edits to `riskflow_source_accounts` cleanly, but no poller consumes them post-S27-T4. TP swapped `@financialjuice` → `@MacroEdge` in the UI and nothing changed in the feed because Agent-Reach reads **hardcoded RSS URLs** in `backend-hono/src/workers/news-worker/sources/index.ts`, not the DB. This track closes the loop so UI edits actually drive polling within one tier cycle.

## Branch target

`s34-t5-source-accounts-wiring` off `main`.

## Upstream dependency

- **T4 / WS9** (web source quality audit) ships a per-source ingest counter that T5 relies on for its verification step. T5 may start in parallel if T4 slips, but must wait on T4's counter work before declaring acceptance.
- **T1 / WS3** `econ_watch_filters` table is NOT a dependency — T5 only touches `riskflow_source_accounts`. Do not import econ filter code.

## Scope — Included

- [ ] **Tighten cache TTL** in [backend-hono/src/services/source-accounts/source-accounts-service.ts:15](backend-hono/src/services/source-accounts/source-accounts-service.ts#L15): drop `CACHE_TTL` from `300_000` (5 min) to `30_000` (30s) so UI edits take effect by the next tier tick without a backend restart. Leave the `clearCache()` calls in `addAccount`/`updateAccount`/`removeAccount` intact — they still give immediate invalidation on write.
- [ ] **Add category-scoped handle helpers** to the same file (place below `getAccountHandles` at [line 75](backend-hono/src/services/source-accounts/source-accounts-service.ts#L75)):
  ```ts
  export async function getWireHandles(): Promise<string[]> {
    const active = await getActiveAccounts();
    return active.filter((a) => a.category === "Wire").map((a) => a.handle);
  }
  export async function getMacroHandles(): Promise<string[]> {
    const active = await getActiveAccounts();
    return active.filter((a) => a.category === "Macro").map((a) => a.handle);
  }
  ```
  Categories live in [backend-hono/src/types/source-account.ts:3-9](backend-hono/src/types/source-account.ts#L3-L9): `Wire | OSINT | Geopolitical | Macro | Custom`.
- [ ] **Extend Agent-Reach collector** in [backend-hono/src/workers/news-worker/sources/agent-reach.ts](backend-hono/src/workers/news-worker/sources/agent-reach.ts):
  - Add an optional `handles?: string[]` field to `CollectOpts`.
  - When present, expand handles into Nitter RSS URLs using a constant mirror list (default mirror: `https://nitter.net/{handle}/rss`).
  - Wrap each mirror fetch in a fallback chain: `nitter.net → nitter.poast.org → nitter.privacydev.net` (stop at first 200-OK). Keep the existing `agent-reach-service` circuit breaker — do not roll your own.
  - Tag the resulting `CollectedNewsItem.source_domain` as `nitter:{handle}` so T4's per-source counter can attribute ingest back to the handle (not the mirror).
- [ ] **DB-driven tier wiring** in [backend-hono/src/workers/news-worker/sources/index.ts](backend-hono/src/workers/news-worker/sources/index.ts):
  - `runBreakingTier` — add a third `safeCollect` block that calls `collectFromAgentReach({ handles: await getWireHandles(), tier: "breaking" })`. Keep the existing Reuters/Bloomberg RSS feeds.
  - `runStandardTier` — add a fourth `safeCollect` block that calls `collectFromAgentReach({ handles: await getMacroHandles(), tier: "standard" })`. Keep the existing SEC/Treasury RSS feeds and Exa query.
  - Each category's handles are fetched on **every tier tick** (the 30s service cache keeps it cheap).
  - Keep isolated-failure semantics — a failing handle list must NOT kill the tier.
- [ ] **Remove the rettiwt-gated no-op path** in [backend-hono/src/services/riskflow/feed-poller.ts:302-332](backend-hono/src/services/riskflow/feed-poller.ts#L302-L332):
  - The S25-T1 branch that treats Rettiwt as secondary and falls back to scrape can be deleted — DB-driven Agent-Reach now covers Wire+Macro handles directly.
  - Preserve the economic feed fetch (`fetchEconomicFeed`) — T3 still writes into it.
  - If any call site outside this function references `markRettiwtPollEmpty` / `markRettiwtPollSuccess` / `isRettiwtRateLimited` / `hasAuthenticatedKeys`, leave those utilities in place but stop calling them from this branch.
  - Do NOT remove the `RETTIWT_REENABLE=true` flag or the rettiwt service itself — keep the kill-switch path for future re-enable per the plan's "open items."
- [ ] Changelog entry in `src/lib/changelog.ts` and top-of-file `// [claude-code 2026-04-24] ...` comments on every modified file.

## Scope — Excluded (DO NOT TOUCH)

- `econ_watch_filters` / `EconFiltersManager` / econ filter service — owned by **T1**.
- `economic_events` table or migrations — owned by **T3**.
- `rettiwt-poller-econ.ts` keyword trigger rewrite — owned by **T6**.
- Countdown modal, SSE econ-print broadcaster — owned by **T8**.
- Per-source diagnostic counter implementation — owned by **T4**. T5 only tags `source_domain` so T4's counter can attribute correctly; do NOT add your own counter.
- `SourceAccountsManager.tsx` UI — no changes needed; the UI already writes to the table that T5 now consumes.

## Known issues to preserve

- `feedback_fly_always_on`: news-worker runs 24/7 on Fly. Deploy changes via `fly deploy --config fly.news-worker.toml --yes` from `backend-hono/`, never root, never disable always-on.
- `feedback_news_worker_redeploy`: news-worker deploys are Routine-managed normally; for a direct sprint deploy, go through `/solvys-deploy` or hand to TP.
- `feedback_launchd_backend_desktop_checkout`: `io.solvys.fintheon-backend` reads `dist/index.js` from `~/Desktop/Codebases/fintheon`. New helper exports won't be visible on localhost until TP syncs the Desktop checkout. Verify fly deploy directly, not just localhost.
- `feedback_fuses_are_sacred` — not a concern here (no UI changes), but do NOT wander into `SourceAccountsManager.tsx` or adjacent panels.
- Recent changelog entries from 2026-04-19 (S27-T7) that introduced the tier coordinators are intentional — extend them, don't rewrite.

## Implementation steps

1. Edit `source-accounts-service.ts`: drop TTL to 30s, add `getWireHandles` + `getMacroHandles`. Add top-of-file claude-code comment.
2. Edit `agent-reach.ts`: add `handles?` field, Nitter expansion, mirror fallback chain, tagged `source_domain`. Reuse existing `fetchRss` + `scrapeUrl` from `agent-reach-service`.
3. Edit `sources/index.ts`: add Wire handle collector to `runBreakingTier`, Macro handle collector to `runStandardTier`. Keep existing collectors.
4. Edit `feed-poller.ts`: delete the rettiwt-gated branch at 302–332; leave the economic feed fetch and the scrape fallback utilities intact.
5. `cd backend-hono && bun run build` — must be green. Fix any type errors from the new helper signatures.
6. Type-check the frontend (no changes expected, but confirm): `npx tsc --noEmit --project frontend/tsconfig.json`.
7. Changelog entry + top-of-file comments. Commit on the track branch.

## Acceptance criteria

- [ ] `bun run build` in `backend-hono/` succeeds with zero TS errors.
- [ ] `curl localhost:8080/api/source-accounts` (or the existing read endpoint) returns the seeded list; toggling any Wire or Macro account active→inactive via PATCH is reflected in the next `runBreakingTier`/`runStandardTier` tick within ≤60s (30s cache + one tick).
- [ ] After deploy to `fintheon-news-worker`, the tier heartbeat row in `news_worker_heartbeats` shows `items_ingested > 0` during market hours with contributions tagged `source_domain = "nitter:{handle}"` for each active Wire and Macro account (joins against T4's per-source counter).
- [ ] Swapping `@financialjuice` → `@MacroEdge` in the Refinement Engine UI causes `MacroEdge` items to appear in the `raw_riskflow_items` feed within the next two tier cycles — no backend restart required.
- [ ] `feed-poller.ts` no longer logs "Poll cycle: 0 items from all sources (rettiwt: unavailable, econ: checked)" when rettiwt keys are absent.

## Validation commands

```bash
# Backend build
cd backend-hono && bun run build && cd ..

# Frontend type-check (sanity — no FE changes expected)
npx tsc --noEmit --project frontend/tsconfig.json

# Local backend restart (run from Desktop checkout before hitting localhost)
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke: verify helpers land in the runtime
curl -s http://localhost:8080/api/source-accounts | jq '.[] | select(.category=="Wire") | .handle'

# Deploy news-worker (where the tier coordinators actually run)
cd backend-hono && fly deploy --config fly.news-worker.toml --yes && cd ..

# Verify live ingest attribution (within ~2 minutes of deploy)
curl -s https://fintheon-news-worker.fly.dev/api/diagnostics | jq '.tiers'
```

## Commit format

```
[v.04.24.5] feat: T5 source-accounts → news-worker DB-driven wiring
```

## Open questions

- **Nitter mirror reliability**: if all three mirrors 404/429 during Wave 2, plan says fall back to re-enabling Rettiwt for Wire+Macro only behind `RETTIWT_REENABLE=true`. Flag this at the Wave 2 checkpoint — do NOT flip the flag inside T5.
- **OSINT / Geopolitical handles**: out of scope for T5 (Wire + Macro only). If Wave 3 integration needs them, extend via a follow-up track, not by sneaking them into T5.
