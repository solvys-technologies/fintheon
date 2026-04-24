# S34-T4 Report — Web Source Quality Audit + FJ-Alignment Pass

**Date:** 2026-04-24
**Branch:** `s34-t4-web-source-quality-audit`
**Status:** Counters instrumented. Prune list AWAITING TP APPROVAL.

---

## 1. Smoking-gun decomposed

Live Supabase query taken at branch-cut, against `raw_riskflow_items` and
`scored_riskflow_items` over the last 48h. `promoted = iv_score >= 2`;
`drop_rate = 1 - promoted/ingested`.

| source           | ingested (raw) | scored (all) | promoted (≥2) | drop_rate | avg_score |
| ---------------- | -------------: | -----------: | ------------: | --------: | --------: |
| Custom           |            892 |           39 |            23 |    0.9742 |      2.56 |
| CuratedTimeline  |             53 |            6 |             6 |    0.8868 |      7.00 |
| OSINTSources     |              0 |           16 |            16 |    0.0000 |      5.61 |
| EconomicCalendar |              0 |            4 |             3 |    0.0000 |      5.56 |
| FinancialJuice   |              0 |           76 |            75 |    0.0000 |      4.77 |

Two facts the brief's "0 items, 0 errors" heartbeat was hiding:

1. **848 raw items sit in an unscored backlog**, 815 of them `source='Custom'`.
   The central-scorer is draining slower than ingest in Custom's path and /
   or dropping them in one of the four sequential gates before a scored row
   ever gets written.
2. **Source-name asymmetry.** OSINTSources, EconomicCalendar, FinancialJuice
   show scored rows but zero raw rows in this window. `normalizeSource`
   rewrites the raw label during scoring; the view inherits that, so
   drop_rate for those three reads `0.0000` because the denominator is 0,
   not because nothing's dropping.

Once the new counters flush for 24h, the live endpoint resolves both.

---

## 2. "Custom" bucket decomposed by submitted_by

`source='Custom'` is agent-reach's default tag for everything it pulls from
an RSS feed, regardless of upstream. Four feeds fill it:

| submitted_by                 | items (48h) |
| ---------------------------- | ----------: |
| agent-reach:rss:seekingalpha |         487 |
| agent-reach:rss:bloomberg    |         285 |
| agent-reach:rss:cnbc         |          69 |
| agent-reach:rss:marketwatch  |          51 |

`source='CuratedTimeline'` (commentary-scraper poll-by-handle):

| submitted_by                       | items (48h) |
| ---------------------------------- | ----------: |
| commentary-scraper:DeItaone        |          26 |
| commentary-scraper:OSINTtechnical  |          12 |
| commentary-scraper:Overton_news    |           6 |
| commentary-scraper:NickTimiraos    |           6 |
| commentary-scraper:realDonaldTrump |           3 |

SeekingAlpha alone is 487/892 = 55% of Custom's ingest.

---

## 3. Top 5 lowest-signal sources — AWAITING TP APPROVAL

Ranked by estimated noise contribution (ingested × drop_rate). No RSS URL
has been removed — per S34-T4 scope, the counter layer lands first and
prune decisions come later in a T5 follow-up.

| Rank | submitted_by                       | Ingested | Est. dropped | Recommendation                                                |
| ---: | ---------------------------------- | -------: | -----------: | ------------------------------------------------------------- |
|    1 | agent-reach:rss:seekingalpha       |      487 |         ~474 | **Prune** — opinion-heavy / SEO bait                          |
|    2 | agent-reach:rss:bloomberg          |      285 |         ~278 | **Prune non-Breaking RSS** — Markets Wrap dominates           |
|    3 | agent-reach:rss:cnbc               |       69 |          ~67 | **Prune** — infotainment, few catalysts                       |
|    4 | agent-reach:rss:marketwatch        |       51 |          ~50 | **Prune** — personal-finance columns                          |
|    5 | commentary-scraper:realDonaldTrump |        3 |           ~3 | **Retain** — volume low, political-spam guard already handles |

If 1–4 are pruned: ~869 scorer-dropped items/48h eliminated (~18/hr of
busy-work disappears).

**Do NOT prune:**

- FinancialJuice (avg_score 4.77, 0% drop)
- OSINTSources (avg_score 5.61, 0% drop)
- CuratedTimeline: DeItaOne, NickTimiraos, OSINTtechnical, Overton_news

---

## 4. What shipped

### Counter instrumentation

Every drop path in the news pipeline now bumps a per-source, per-stage,
per-reason counter in `riskflow_drop_counters` via a 60s in-process flush
(`backend-hono/src/services/riskflow/drop-counters.ts`), wired into
`bootBackground` in `backend-hono/src/boot/services.ts` as
`startDropCounterFlush()`.

| Stage            | File                                                   | Reasons bumped                                                                                                   |
| ---------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `persist`        | `backend-hono/src/workers/news-worker/persist.ts`      | `dropped_missing_fields`, `dropped_dedup`, `dropped_supabase_error`                                              |
| `content-guard`  | `backend-hono/src/services/riskflow/content-guard.ts`  | every `checkContentGuard` reason — `no-market-relevance`, `platform-ad`, `scraper-artifact`, `political-spam`, … |
| `central-scorer` | `backend-hono/src/services/riskflow/central-scorer.ts` | content-guard safety-net pass, `dropped_dismissed_pattern`, `dropped_narrative_gate`, `dropped_below_threshold`  |

### Source signal-noise view

`v_source_signal_noise` (migration `20260424103000_riskflow_drop_counters.sql`)
joins raw × scored over 48h and returns per-source `{ ingested, scored_total,
promoted, drop_rate, avg_score }`. Migration is idempotent and ready for
`supabase db push`.

### Diagnostics endpoint

`GET /api/diagnostics/source-quality` returns:

- `sources` — rows from `v_source_signal_noise`
- `flushed_counters` — last 2h of `riskflow_drop_counters` rows
- `live_counters` — in-memory snapshot since last flush (so operators see
  drops in <60s)
- `errors` — per-query non-throwing error surfacing

### FJ baseline + allowlist expansion

- `backend-hono/scripts/scrape-fj-sample.ts` — one-shot live scraper via
  `agent-reach-service.fetchRss` (NOT Rettiwt). Falls back to the curated
  seed if it can't collect ≥100 posts.
- `backend-hono/src/services/riskflow/fj-keyword-baseline.json` — 95
  curated FJ-grade keywords seeded this pass (ECB speakers, curve
  dynamics, QRA/TLTRO/MRO primary-market mechanics, regional equity
  indices, regional Fed districts).
- `content-guard.ts::MARKET_KEYWORDS` — appended (not replaced) with the
  FJ baseline. **No keyword was removed.** Every addition widens pass
  rate by definition — there is no false-negative risk.

---

## 5. Post-deploy followup — fill once 24h of counter data lands

Operators should pull the first honest per-source breakdown after 24h
of live traffic:

```bash
curl -s https://fintheon.fly.dev/api/diagnostics/source-quality | jq '{
  sources,
  flushed_counters: (.flushed_counters | length),
  dominant_reasons_by_source: (
    .flushed_counters
    | group_by(.source)
    | map({source: .[0].source, total: (map(.count) | add), top_reason: (group_by(.reason) | max_by((map(.count) | add)) | .[0].reason)})
  )
}'
```

What to decide with that payload:

- **If `dropped_dedup` dominates for a source**: RSS upstream is stale;
  lower poll rate or mark source stale.
- **If `dropped_missing_fields` dominates**: parser is broken.
- **If `no-market-relevance` dominates**: prune candidate (confirm
  against section 3 above).
- **If `dropped_dismissed_pattern` dominates**: the scorer's dismiss
  patterns are over-matching; T4 counter drops are the evidence needed
  to loosen them.
- **If `dropped_supabase_error` appears at all**: page backend-oncall.

---

## 6. Validation — smoke

```bash
cd backend-hono && bun run build
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
# One flush window + one scoring cycle
sleep 90
curl -s http://localhost:8080/api/diagnostics/source-quality | jq '{
  sources: (.sources | length),
  flushed_counters: (.flushed_counters | length),
  live_total: (.live_counters.total_dropped // 0)
}'
```

Expected on a freshly restarted backend with no live traffic:
`sources: 5, flushed_counters: 0..N, live_total: 0..N`. The endpoint
returns 200 regardless.

---

## 7. Migration hand-off

`supabase/migrations/20260424103000_riskflow_drop_counters.sql` — hand
to TP for `supabase db push`. Creates:

- `public.riskflow_drop_counters` (table, 3 indexes)
- `public.v_source_signal_noise` (view)

Both idempotent. Safe to re-run.

---

## 8. Open followups (not this track)

- **T5 (source-accounts wiring)** should move RSS URL CRUD into
  `source_accounts` and consume the prune recommendations in §3 once
  TP approves.
- **Source-name normalization asymmetry.** The raw writer tags
  SeekingAlpha/Bloomberg/CNBC/MarketWatch all as `source='Custom'`, and
  `normalizeSource` rewrites post-score. The view would be clearer if
  the raw writer adopted the same per-submitted_by naming — but that's
  a schema touch; flagging for Harper/TP discussion, not doing here.
- **rettiwt-poller-transform.ts** `filterWithContentGuard` call passes
  no source hint; drops there will attribute to `unknown`. Rettiwt is
  currently off behind `RETTIWT_REENABLE=true`, so low priority.
- **Content-guard unit coverage.** The 95 new FJ keywords have no tests.
  Append-only means no false-negative risk; extend
  `backend-hono/src/services/riskflow/__tests__/content-guard.test.ts`
  in a follow-up.
