# NEWS WORKER CONTRACT

**LOCKED CADENCE — Do not regress without TP signoff.**

This file is the source-of-truth for the news-worker scheduler. The boot-time
assertion in `boot.ts` reads `CONTRACT` from this file (mirrored as a
TypeScript constant) and overrides any drift before the scheduler starts.

If you find yourself wanting to change a number here, write a sprint brief
and get TP signoff first. The contract is enforced at boot, the changelog
comment is a gravestone, and the watchdog notifies on contract violation.

| Field                  | Value     | Was      | Notes                                   |
| ---------------------- | --------- | -------- | --------------------------------------- |
| BREAKING_INTERVAL_MS   | 180_000   | 60_000   | 3 min — was burning rate-limit budget   |
| STANDARD_INTERVAL_MS   | 3_600_000 | 300_000  | 1 hour — long-tail RSS doesn't move fast |
| ECON_BURST_ARM_OFFSET  | 30_000    | n/a      | T-30s arm before scheduled release       |
| ECON_BURST_INTERVAL_MS | 500       | n/a      | 500ms during 90s release window          |
| HEALTH_CHECK_MS        | 60_000    | n/a      | Watchdog ping cadence                    |
| STALE_THRESHOLD_SEC    | 300       | n/a      | ageSec >= this → ok=false                |

## On-boot contract enforcement

If on-boot config drifts from these values:

1. Log loud `[CONTRACT-VIOLATION]` with field, observed value, expected value
2. Override scheduler config to spec values
3. `notifySuperadmins("News worker contract auto-restored: <field> was <X>, reset to <Y>")`

## Emergency commercial flag

`TWITTER_EMERGENCY_FIRESTREAM=true` switches Twitter intake to the
twitterapi.io WebSocket firehose ($149/mo). Off by default. The flag is
checked at scheduler tick boundaries, not at boot, so it can be flipped
without a restart.

## Sources tier assignment

**Breaking tier (180s)**:
- 8 promoted Macro Twitter handles (FinancialJuice, DeItaone, etc.)
- SEC EDGAR 8-K Atom feed (1-2s lag from filing)
- Treasury Direct offering announcements
- Browser-harness fast-cycle endpoints

**Standard tier (1h)**:
- RSS feeds (FOMC press release, Census, BEA, BLS general)
- Long-tail newsletter sources

**REMOVED from breaking** (S40):
- Reuters general feed (latency too high to justify per-minute polling)
- Bloomberg general feed (same)

## Auto-downweight (S40-P2)

Daily 03:00 ET cron walks `riskflow_source_accounts` and computes a
rolling 7-day average `iv_score` for items each handle produced. If the
avg drops below 2 → `tier_weight = max(1, tier_weight - 1)`; above 5 →
`tier_weight = min(10, tier_weight + 1)`. Sources with `tier_weight = 1`
are skipped by the fetch loop (effectively dead, retained for audit).

## Soft-delete prune (S40-P2)

`cleanupOldItems` runs hourly:

```sql
UPDATE news_feed_items
SET archived_at = now()
WHERE iv_score < 3
  AND narrative_id IS NULL
  AND age > 24h
  AND archived_at IS NULL;
```

Daily 02:00 ET sweep hard-deletes rows where `archived_at < now() - 7 days`.
The frontend feed query filters `WHERE archived_at IS NULL`.
