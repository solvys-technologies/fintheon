# Sprint Brief: S40 — Time To Print + News Realtime + Narrative Overhaul (single-agent)

## Intent

Fintheon ships **realtime news intelligence**. Within 7-11 seconds of a CPI print, the Strategium rail flips from PsychAssist to a Time-To-Print widget showing country flag, event name, forecast, a pulsing countdown that resolves into the actual + beat/miss chip. Within 5-10 seconds of a market-moving tweet from a wire account, it's on the feed and tagged to the right narrative. The news worker is locked against regression, runs 24/7, prunes its own junk, and refuses to repeat the duplicates that have been polluting NarrativeFlow + Timeline. Anthropic-Google class deals get caught and promoted, not crickets. Harper sounds like a senior British PM, not Rachel from California.

## Branch Target

Fresh worktree off the latest prod tag at `~/Desktop/Codebases/fintheon-s40-ttp-realtime`. New branch `s40-ttp-realtime`. Do NOT work in the primary `~/Documents/Codebases/fintheon` checkout — S35 is still active there.

## Scope — Included

- [ ] **Pillar 1**: Harper voice swap to Piper TTS (`en_GB-cori-medium`)
- [ ] **Pillar 2**: News-worker stabilization — drop Reuters/Bloomberg from breaking; promote 8 Macro Twitter handles to breaking; add `tier_weight` column; add `headline_hash` cross-source dedup; re-enable `cleanupOldItems` as soft-delete sweep; boot-time config-drift assertion + `NEWS_WORKER_CONTRACT.md` lock file; watchdog with auto-restart, notify-on-restart, alert-on-healthy; per-source rolling 7-day IV-score average for self-improvement auto-downweight
- [ ] **Pillar 3**: Twitter source overhaul — retire Agent Reach; primary = Browserbase Playwright + logged-in X session intercepting GraphQL `UserTweets`/`HomeLatestTimeline` XHR; fallback poller = `rettiwt-api` v7 guest mode with 2-cookie pool; emergency flag for `twitterapi.io` WebSocket firehose ($149/mo, off by default)
- [ ] **Pillar 4**: Realtime upstream agency feeds — BLS, BEA, Federal Reserve, Census, SEC EDGAR, Treasury direct HTTP pollers via persistent browser-harness; T-30s arm; 250-500ms cadence during release windows; body-hash diff detection; 2-7s TTP target
- [ ] **Pillar 5**: Narrative classifier overhaul — fix Singularity bleed (remove generic "data center"/"infrastructure", add stricter compound matches, exclusion when geopolitical dominates without AI tokens); fix merger weight ceiling (3 → 6) + add `partnership_deal: 7`; drop NarrativeFlow gate (5.0 → 4.5 OR top-N per 24h); soften junk filter; one-shot retroactive backfill that dedups by `headline_hash` and reclassifies existing items
- [ ] **Pillar 6**: Time To Print widget — replaces PsychAssist in Strategium slot at T-5min, fades back at T+30s; layout `[🇺🇸 US] CPI (Core, MoM) | Forecast: 0.3% | 04:32` → on print `→ Actual: 0.4% [BEAT]`; pulse on countdown digits at 00:00 until actual or 60s timeout; multi-event collision shows highest-rank only with `+N more` chip → `t-dropdown` (max 4 stacked); PsychAssist auto-floats when `psychAssistAutoStart=true`; US-only commentator filter via institution allowlist + `country` column added to commentators (forward-prep); Refinement Engine country toggle scaffolded with US-enabled-only state
- [ ] **Pillar 7**: Sector-of-Risk persona overlays + Megacap analyst — `risk_sectors.ts` config (Singularity / Geopolitical / Macro / Earnings / Liquidity); persona metadata `primary_sector` on Oracle/Feucht/Consul/Herald; Agentic Forum dispatch by sector match; Consul-as-megacap-analyst scoped to hardcoded 12-ticker NDX∩SPX>$300B watchlist (AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA, AVGO, COST, NFLX, ADBE, ORCL — refresh quarterly); fires on megacap earnings AND on deals where megacap ticker is public counterparty
- [ ] **Pillar 8**: Megacap earnings ingestion — new `earnings_events` table; FMP MCP integration for earnings dates + post-print beat/miss; weekly cron refresh; feeds Time-To-Print eligibility list

## Scope — Excluded (OUT OF BOUNDS)

- **API consumer / external pipe productization** — keep SSE shape clean enough that selling-the-pipe is a future config change, not an S40 deliverable. No API-key issuance, no usage metering, no customer dashboards.
- **Univ of Michigan Consumer Sentiment** paid private feed — skip, not worth the sub.
- **CME FedWatch paid API** — skip, derive Fed funds repricing from existing TradingView pipe if needed for Pillar 7's Macro persona.
- **ECB / BOE / BOJ commentator feeds** — country toggle is scaffolded but only US is selectable. Wiring non-US scrapers is out of scope.
- **Annual / prior-period revision detection** beyond title-regex tagging — full FRED/BEA revision feed integration is deferred.
- **Twitter API v2 paid tier** — explicitly ruled out.
- **Touching Refinement Engine Advanced pane edit-locks** — S37 lock stands; only the country-toggle scaffolding is read-only.
- **Touching MainLayout safe-zones** — peers own MainLayout.tsx Strategium overlay/rename per s35-unified safe-zones memory; coordinate with TP if any MainLayout edit is unavoidable.
- **Fuses, spinners, global icon-set swaps** — sacred per memory; do not touch.

## Known Issues to Preserve

- `psychAssistAutoStart` flag in `SettingsContext` — the Time-To-Print floating-failover logic depends on its current shape; do not refactor.
- `t-panel-slide` and `t-modal` need `requestAnimationFrame` on first paint when mounted with `data-open="true"` — replicate the rAF pattern from existing usage; do NOT mount Time-To-Print with `data-open="true"` directly.
- `economic_events` schema (id, name, date, time, forecast, actual, previous, impact, country, category, event_key) — extend with new columns, don't recreate.
- ForexFactory populator stays as the FORECAST source for upcoming events. The agency direct pollers replace it ONLY for the actual-print step.
- `news_feed_items.econ_data` JSON column already has `{actual, forecast, previous, beatMiss, surprisePercent}` — populate `beatMiss` correctly per the threshold rules below; don't change the column shape.
- `commentators` table has no `country` column today — add it; institution-allowlist hack is the v1 filter while we backfill the column.
- `riskflow_source_accounts` schema is `(id, handle, display_name, category, active, ...)` — add `tier_weight INTEGER DEFAULT 5` and `noise_score REAL DEFAULT 0` without breaking the existing service.
- The 11 hardcoded handles in `backend-hono/src/types/source-account.ts` are the production set (NOT the 3 listed in stale memory). Don't drop any.
- `cleanupOldItems` literal `// DISABLED — items are never deleted` comment exists; the brief re-enables it but as soft-delete (`archived_at`) not hard-delete.
- `src/lib/changelog.ts` ships in the bundle — no plaintext secrets/URLs in changelog strings.
- launchd backend reads from `~/Desktop/Codebases/fintheon`, not Documents — sync via TP after backend changes if testing locally.
- `fintheon-update.sh` self-update bootstrap (v5.25.2) must remain intact.

## Design Pass

### Pillar 1 — Harper voice (smallest, ship first)

**File layout:**

```
backend-hono/
  assets/voices/
    en_GB-cori-medium.onnx     (committed binary, ~30MB)
    en_GB-cori-medium.onnx.json (config)
  src/services/
    voice-tts/
      index.ts                  (router with HARPER_TTS_PROVIDER env)
      piper.ts                  (synthesizeWithPiper via piper-onnx npm)
      elevenlabs.ts             (renamed from voice-tts.ts; kept for fallback)
```

**Router shape:**

```typescript
export async function synthesize(
  text: string,
): Promise<SynthesizedAudio | null> {
  const provider = (process.env.HARPER_TTS_PROVIDER ?? "piper") as
    | "piper"
    | "elevenlabs";
  if (provider === "piper") {
    const result = await synthesizeWithPiper(text);
    if (result) return result;
  }
  return synthesizeWithElevenLabs(text);
}
```

**Sample endpoint** for live A/B (TP audits in his own ear):

- `GET /api/voice/sample?voice=cori|jenny_dioco|elevenlabs&text=<urlencoded>`
- Returns `{ audioBase64, mimeType: "audio/wav" }`. Same shape as existing `/api/voice/speak`.

**Frontend**: zero changes. `useVoiceAssistant.playAudio` already handles base64 + mime generically.

**Acceptance**: TP issues `curl 'http://localhost:8080/api/voice/sample?voice=cori&text=Good+morning,+Chief'` and listens. If approved, set `HARPER_TTS_PROVIDER=piper` in Fly secrets. If rejected, fallback weights `en_GB-jenny_dioco-medium.onnx` are also committed.

### Pillar 2 — News-worker stabilization

**`NEWS_WORKER_CONTRACT.md`** at `backend-hono/src/workers/news-worker/NEWS_WORKER_CONTRACT.md`:

```
LOCKED CADENCE — Do not regress without TP signoff.

BREAKING_INTERVAL_MS:    180_000   (3 min)  — was 60_000
STANDARD_INTERVAL_MS:    3_600_000 (1 hour) — was 300_000
ECON_BURST_ARM_OFFSET:   30_000    (T-30s)
ECON_BURST_INTERVAL_MS:  500       (during 90s window)
HEALTH_CHECK_MS:         60_000

If on-boot config drifts from these values:
  1. Log loud `[CONTRACT-VIOLATION]`
  2. Override scheduler config to spec values
  3. notifySuperadmins("News worker contract auto-restored: <field> was <X>, reset to <Y>")
```

**Boot-time assertion** in `backend-hono/src/workers/news-worker/boot.ts`:

```typescript
import { CONTRACT } from "./NEWS_WORKER_CONTRACT";
function assertContract() {
  if (BREAKING_INTERVAL_MS !== CONTRACT.BREAKING_INTERVAL_MS) {
    /* override + notify */
  }
  // ... etc for each field
}
assertContract();
```

**Watchdog** at `backend-hono/src/workers/news-worker/watchdog.ts`:

- Pings `/api/riskflow/health` every 60s
- `/api/riskflow/health` returns `{ lastHeadlineAt: ISO, ageSec: number, ok: boolean }` where `ok = ageSec < 300`
- On `ok=false`: kill worker process via process.exit(1) so launchd/Fly restarts it; log + `notifySuperadmins("News worker auto-restart: stale > 5min")`
- On `ok=true`: silent (heartbeat to `worker_health` table only)
- Daily 09:00 ET digest: `notifySuperadmins("News worker healthy: 24h headline count=N, restart count=M")`
- New table `worker_health` (id, ts, status, age_sec, action_taken)

**Auto-prune** in `news-cache.ts`:

- Re-enable `cleanupOldItems` but as soft-delete: `UPDATE news_feed_items SET archived_at = now() WHERE iv_score < 3 AND narrative_id IS NULL AND age > 24h AND archived_at IS NULL`
- Daily 02:00 ET hard-delete sweep: `DELETE FROM news_feed_items WHERE archived_at < now() - INTERVAL '7 days'`
- Frontend feed query already filters `WHERE archived_at IS NULL` — confirm in [riskflow/handlers.ts] and add if missing

**Self-improving auto-downweight** in `riskflow_source_accounts`:

- Add `noise_score REAL DEFAULT 0` (0=signal, 1=pure noise)
- Add `tier_weight INTEGER DEFAULT 5` (1-10)
- Daily 03:00 ET cron: for each handle, compute rolling 7-day avg of `iv_score` for items it produced. If avg < 2 → `tier_weight = max(1, tier_weight - 1)` AND `noise_score = (1 - avg/10)`. If avg > 5 → `tier_weight = min(10, tier_weight + 1)`.
- Source-account fetch loop respects `tier_weight DESC` ordering and skips handles where `tier_weight = 1` (effectively dead)

### Pillar 3 — Twitter source overhaul (retire Agent Reach)

**Primary streaming watcher** at `backend-hono/src/services/twitter/streaming-watcher.ts`:

```
- Acquire one persistent Browserbase Playwright page (separate from shared 4-page pool)
- Login once with TP-provided X account (env: X_BURNER_USER, X_BURNER_PASS, X_BURNER_TOTP)
- Navigate to a custom List containing all 12 handles
- page.route() intercepts /i/api/graphql/*/UserTweets and HomeLatestTimeline XHR responses
- onResponse → parse JSON → extract new tweets (dedup by tweet_id) → push to existing scoring pipeline
- Heartbeat every 60s: if no XHR observed in 5 min → declare session degraded
```

**Fallback poller** at `backend-hono/src/services/twitter/rettiwt-fallback.ts`:

```typescript
import { Rettiwt } from "rettiwt-api";
const rettiwt = new Rettiwt(); // guest mode, no auth
export async function pollHandle(handle: string): Promise<Tweet[]> {
  const result = await rettiwt.tweet.list({ fromUsers: [handle] });
  return result.list.map(/* ... */);
}
```

- Auth-cookie pool: `X_RETTIWT_COOKIES` env (JSON array of cookie strings); rotate on rate-limit
- 30s interval per handle, parallel `Promise.all` across 12 handles, ~3-5s total round-trip

**Failover state machine** in `streaming-watcher.ts`:

```
HEALTHY    → primary observing XHR
DEGRADED   → primary stale > 5min → start rettiwt fallback in parallel + notifySuperadmins("Twitter primary degraded; fallback active")
RECOVERING → reconnect attempt every 60s; on 3 consecutive XHR observations → return HEALTHY + notifySuperadmins("Twitter primary restored")
DEAD       → 30+ consecutive failed reconnects (~30 min) → notifySuperadmins("Twitter primary dead; fallback running indefinitely. Manual intervention required.")
```

**Emergency commercial flag**:

- Env `TWITTER_EMERGENCY_FIRESTREAM=true` switches to `twitterapi.io` WebSocket firehose
- Off by default; doc the flag in `NEWS_WORKER_CONTRACT.md`

**Retire** `backend-hono/src/workers/news-worker/sources/agent-reach.ts` — keep file with `// DEPRECATED 2026-04-25` comment + `throw new Error("agent-reach retired in S40")` to surface stale wiring.

### Pillar 4 — Realtime upstream agency feeds

**Module**: `backend-hono/src/services/time-to-print/agency-pollers/`

```
agency-pollers/
  bls.ts       (cpi, ppi, empsit, jolts, eci, prod2 release URLs)
  bea.ts       (gdp, pce, personal-income)
  frb.ts       (FOMC press release index)
  census.ts    (retail-sales, housing-starts, durable-goods)
  edgar.ts     (8-K Atom feed; updates within 1-2s)
  treasury.ts  (TreasuryDirect Offering Announcements RSS)
  scheduler.ts (T-30s arm, 90s window per known release time)
```

**Per-poller pattern** (BLS example):

```typescript
const RELEASES = {
  cpi: "https://www.bls.gov/news.release/cpi.htm",
  empsit: "https://www.bls.gov/news.release/empsit.htm",
  ppi: "https://www.bls.gov/news.release/ppi.htm",
  // ...
};

export async function armBLSBurst(
  release: keyof typeof RELEASES,
  scheduledAt: Date,
) {
  const armAt = scheduledAt.getTime() - 30_000;
  const disarmAt = scheduledAt.getTime() + 60_000;
  // ... at armAt: acquire dedicated mini-pool page; navigate; cache initial body hash
  // ... loop every 500ms: page.reload({waitUntil:"domcontentloaded"}); diff hash
  // ... on diff: extract actual + previous + commentary; emit; disarm
}
```

**HTTP client** uses User-Agent: `Fintheon RiskFlow (tp@pricedinresearch.io)` per agency etiquette.

**beatMiss compute** at `backend-hono/src/services/time-to-print/beat-miss.ts`:

```typescript
// surprisePercent = (actual - forecast) / forecast
// Polarity-aware: low CPI = beat for risk-on; high NFP = beat for risk-on; low Jobless Claims = beat
const POLARITY = {
  cpi: -1,
  ppi: -1,
  nfp: +1,
  jobless: -1,
  gdp: +1,
  retail: +1 /* ... */,
};
function classify(
  actual: number,
  forecast: number,
  eventKey: string,
): "beat" | "miss" | "inline" {
  const surprise = (actual - forecast) / Math.abs(forecast || 1);
  if (Math.abs(surprise) < 0.001) return "inline";
  return Math.sign(surprise) === Math.sign(POLARITY[eventKey] ?? +1)
    ? "beat"
    : "miss";
}
```

**Scoring path**: skip the OpenRouter IV-scoring call for the 9 ranked econ events (`econ-rankings.ts`). Static map: `CPI=8, NFP=8, FOMC=9, PCE=7, GDP=7, PPI=6, JOLTS=5, JOBLESS=5, RETAIL=5`. Async-rescore later via existing inline path if surprise magnitude warrants escalation.

**Mini-pool**: 1 page reserved in `browser-harness/pool.ts` for `econ-burst`, separate from the 4-page shared pool. Hard-coded.

### Pillar 5 — Narrative classifier overhaul

**Singularity seed rewrite** in `backend-hono/src/services/riskflow/catalyst-promoter.ts`:

Remove from `THREAD_KEYWORDS["ai-singularity"]`: `data center`, `infrastructure` (too generic).

Add stricter compound matches:

```
"AI data center", "GPU cluster", "H100", "B200", "compute build",
"training cluster", "model training", "foundation model",
"Anthropic", "OpenAI", "xAI", "Mistral", "DeepMind",
"AI deal", "AI partnership", "AI compute deal"
```

Add exclusion guard:

```typescript
function shouldExcludeFromSingularity(
  headline: string,
  riskType: string,
): boolean {
  const hasGeopol = riskType === "geopolitical";
  const hasAITokens =
    /\b(AI|model|GPU|chip|compute|training|inference|H100|B200|TPU)\b/i.test(
      headline,
    );
  return hasGeopol && !hasAITokens;
}
```

**Merger weight fix** in `backend-hono/src/services/analysis/iv-scorer.ts:94`:

```typescript
merger: 6,                   // was 3
partnership_deal: 7,         // NEW — for multi-billion strategic deals (Anthropic-Google, Amazon-Anthropic class)
```

**NarrativeFlow gate fix** in `backend-hono/src/routes/narrative/handlers.ts:452`:

Replace the absolute `.gte("iv_score", 5.0)` with a hybrid:

```typescript
// Prefer top-N per 24h; fall back to absolute gate
const baseQuery = supabase
  .from("scored_riskflow_items")
  .select("*")
  .gte("published_at", twentyFourHoursAgo)
  .order("iv_score", { ascending: false })
  .limit(200);
// Then post-filter: include all items with iv_score >= 4.5 OR top 50 by iv_score
```

**Junk filter softening** in `catalyst-promoter.ts:341-352`:

```typescript
if (
  threads.length === 0 &&
  sentiment === "neutral" &&
  ivScore < 5 &&
  !hasEntityTags(item) &&
  !hasTickerReference(item)
) {
  return { promoted: false, reason: "junk-filtered" };
}
```

**Level 3 catalyst keywords** in `backend-hono/src/config/catalyst-levels.ts:36-55`:
Add: `merger`, `acquisition`, `partnership`, `strategic deal`, `multi-billion deal`, `Anthropic`, `OpenAI`, `xAI`, `compute deal`, `chip deal`.

**One-shot retroactive backfill** at `backend-hono/scripts/s40-narrative-backfill.ts`:

1. Compute `headline_hash = sha1(normalize(headline))` for all `scored_riskflow_items` and `news_feed_items` rows
2. Group by hash, keep oldest, soft-delete duplicates (`archived_at = now()`)
3. Re-run classifier over all unique items in the last 30 days
4. Update `narrative_card_links` to reflect new classifications
5. Idempotent (safe to re-run); writes audit row to `worker_health` on completion

### Pillar 6 — Time To Print widget

**Frontend**: `frontend/components/strategium/TimeToPrintDockable.tsx` (new, mirrors `PsychAssistDockable.tsx` exactly).

**Layout (header mode, h-7 strip)**:

```
[🇺🇸 US] CPI (Core, MoM)     Forecast: 0.3%     04:32
                                                  ↓ on print:
[🇺🇸 US] CPI (Core, MoM)     Actual: 0.4%  [BEAT] ▲
```

**Layout (floating mode, 340px, 2-row)**:

```
┌──────────────────────────────┐
│ [🇺🇸 US]  CPI (Core, MoM)    │
│           Forecast: 0.3%   04:32 │
└──────────────────────────────┘

(post-print)
┌──────────────────────────────┐
│ [🇺🇸 US]  CPI (Core, MoM)    │
│ Actual: 0.4%       [BEAT] ▲  │
└──────────────────────────────┘
```

**Color rules**:

- Beat chip: `bg-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/30`
- Miss chip: `bg-[#7a3a3a]/15 text-[#c97777] border-[#c97777]/30`
- Inline chip: `bg-[var(--fintheon-text)]/10 text-[var(--fintheon-text)]/70 border-[var(--fintheon-text)]/20`
- Pulse at 00:00: `accent` glow ring at scale 1.0→1.04, 800ms cubic-bezier loop, until actual or 60s timeout

**State machine**:

```
idle → (T-5min from next eligible event)
       fade-in TimeToPrint via t-panel-slide (rAF on first paint)
       if psychAssistAutoStart && PsychAssist=header → flip PsychAssist to floating
T-5:00 to T-1:00  tick every 60s (display-only refresh)
T-1:00 to T-0:00  tick every 30s
T-0:00            pulse on countdown digits
                  rapid-burst already armed; awaiting actual via SSE
+0-7s   actual arrives → swap "Forecast: X.X" line to "Actual: X.X [CHIP]"
                  stop pulse
+30s    fade-out TimeToPrint via t-panel-slide reverse
       restore PsychAssist to its prior target
```

**Multi-event collision**:

- Show highest `econ-rankings.ts` rank
- If 2+ events within ±60s of each other → render `+N more` chip on right edge
- Click chip → `t-dropdown` opens (origin=top-right) showing up to 4 stacked rows
- Each row: same flag/event/forecast/countdown shape, smaller (h-6, px-2)

**Hidden schedule eligibility**: query joins `economic_events` + `earnings_events` + `commentator_speeches` (filtered country='US' for v1) within 5min lookahead, ordered by impact rank.

**SSE channel**: new `time-to-print` event on `/api/riskflow/stream`:

```
event: time-to-print
data: {"id":"...","fires_at":"2026-04-25T08:30:00Z","state":"imminent","event":{"name":"CPI (Core, MoM)","country":"US","forecast":"0.3%"}}
```

States: `imminent` (T-5 to T-0) | `live` (T-0 to actual) | `printed` (actual received) | `cleared` (post-30s fade)

**Hook**: `frontend/hooks/useTimeToPrint.ts` reads SSE, exposes `{ event: TimeToPrintEvent | null, secondsRemaining: number, actual: ActualPayload | null }`.

**MainLayout integration**: in the existing PsychAssist slot, conditionally render:

```typescript
const ttp = useTimeToPrint();
const showTTP = ttp.event != null;
return (
  <>
    {showTTP && <TimeToPrintDockable event={ttp.event} target={psychAssistTarget} ... />}
    <PsychAssistDockable
      target={showTTP && psychAssistAutoStart ? "floating" : psychAssistTarget}
      visible={!showTTP || psychAssistAutoStart}
      ...
    />
  </>
);
```

**Country flag component**: new `frontend/components/primitives/CountryFlag.tsx` using SVG flag set from `country-flag-icons/3x2/<ISO>.svg` (npm, MIT). For US-only v1 the file is just hardcoded; expansion is trivial.

**Country toggle in Refinement Engine**: new section `frontend/components/refinement-engine/CountryToggle.tsx` listing `[US ☑] [EU ☐ coming soon] [UK ☐ coming soon] [JP ☐ coming soon]`. Disabled toggles are grayed with tooltip; only US is selectable.

### Pillar 7 — Sector-of-Risk + Megacap analyst

**`backend-hono/src/config/risk-sectors.ts`** (new):

```typescript
export const RISK_SECTORS = {
  Singularity: { keywords: ["AI", "GPU", "H100", "compute", "Anthropic", "OpenAI", ...], owner: "herald" },
  Geopolitical: { keywords: ["sanctions", "Iran", "tariff", "war", "Taiwan", ...], owner: "feucht" },
  Macro:        { keywords: ["CPI", "FOMC", "rates", "inflation", "GDP", ...], owner: "oracle" },
  Earnings:     { keywords: ["EPS", "revenue", "guidance", ...], owner: "consul" },
  Liquidity:    { keywords: ["Treasury", "auction", "balance sheet", "QT", ...], owner: "oracle" },
} as const;
```

**Persona metadata** in agent-instructions YAML frontmatter:

```yaml
# backend-hono/src/services/ai/agent-instructions/herald.md
---
name: herald
primary_sector: Singularity
secondary_sectors: [Earnings]
---
```

**Agentic Forum dispatch** in `backend-hono/src/services/boardroom-dispatcher.ts`:

```typescript
function selectPersonaForCatalyst(catalyst): PersonaId {
  const sector = classifyToSector(catalyst);
  return RISK_SECTORS[sector].owner;
}
```

**Megacap analyst** at `backend-hono/src/services/analysts/megacap-analyst.ts`:

- Hardcoded `MEGACAP_TICKERS = ["AAPL","MSFT","GOOGL","AMZN","NVDA","META","TSLA","AVGO","COST","NFLX","ADBE","ORCL"]`
- Subscribed to two events:
  1. `earnings_events` row insert where `symbol IN MEGACAP_TICKERS`
  2. `news_feed_items` insert where headline contains a megacap ticker AND riskType IN ("merger","partnership_deal")
- On trigger: dispatches a Consul boardroom task with the ticker context, scoring focus: revenue, guidance, capex, AI exposure.
- Result feeds NarrativeFlow as a high-priority catalyst card.

### Pillar 8 — Megacap earnings ingestion

**Migration**: `supabase/migrations/{timestamp}_earnings_events.sql`:

```sql
CREATE TABLE earnings_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol TEXT NOT NULL,
  company_name TEXT,
  fiscal_quarter TEXT,
  report_date DATE NOT NULL,
  report_time TEXT,            -- 'BMO' | 'AMC' | 'TBD' | ISO time
  market_cap_usd BIGINT,
  in_ndx BOOLEAN DEFAULT false,
  in_spx BOOLEAN DEFAULT false,
  forecast_eps NUMERIC,
  actual_eps NUMERIC,
  beat_miss TEXT,              -- 'beat' | 'miss' | 'inline'
  surprise_percent NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(symbol, report_date)
);
CREATE INDEX earnings_events_lookahead ON earnings_events(report_date, report_time)
  WHERE in_ndx = true AND in_spx = true;
```

**Service**: `backend-hono/src/services/earnings/megacap-fmp.ts`:

- Hits FMP `/v3/earning_calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Filters by `MEGACAP_TICKERS` (in_ndx=true, in_spx=true forced for v1 since list is hand-curated)
- Upserts into `earnings_events`
- Weekly cron Sunday 22:00 ET refreshes next 90 days

**Beat/miss post-print**: separate FMP endpoint `/v3/historical/earning_calendar/<symbol>?limit=1` polled at T+5min after `report_time` to retrieve actual EPS; computes `beat_miss` and `surprise_percent`; updates row + emits SSE.

### Aesthetic Rules (all pillars)

- Flat surfaces; thin `var(--fintheon-accent)` border at /10–/30 opacity for separation
- No gradients, no emojis (in code or UI), no glass blur, no Kanban borders, no box-shadows
- Typography: Doto numerals for countdown digits (per existing RiskFlow card pattern); inline-grid for chips
- Solvys Gold accent `#c79f4a` for beat / inline; muted red `#c97777` for miss; never green
- All transitions via `t-*` classes from `frontend/styles/transitions.css`; rAF on first paint when applicable

## Development Flow

**Order matters — single agent, sequenced. Pillar 1 first since it's smallest and lowest-risk; Pillar 5 last since it triggers a backfill that touches everything.**

1. **Pillar 1 (Harper voice)** — commit `en_GB-cori-medium.onnx` weights, scaffold `voice-tts/` router, add `/api/voice/sample` route. Build, smoke-test with curl. ~3 hours.

2. **Data layer** — Supabase migrations (single push):
   - `riskflow_source_accounts` add `tier_weight INTEGER DEFAULT 5`, `noise_score REAL DEFAULT 0`
   - `commentators` add `country TEXT DEFAULT 'US'`
   - `news_feed_items` add `headline_hash TEXT`, `archived_at TIMESTAMPTZ`
   - `scored_riskflow_items` add `headline_hash TEXT`, `archived_at TIMESTAMPTZ`
   - new `earnings_events` table
   - new `worker_health` table
   - run `supabase db push` from main worktree per memory rule (never MCP, never hand to TP)

3. **Pillar 8 (Megacap earnings ingestion)** — service + cron registration. Backfill next 90 days.

4. **Pillar 4 (Agency pollers)** — agency-pollers/ module + scheduler + mini-pool reservation in browser-harness. Test arming logic with a fake "scheduled at 2 min from now" entry.

5. **Pillar 2 (News-worker stabilization)** — `NEWS_WORKER_CONTRACT.md`, boot-time assertion, watchdog, `cleanupOldItems` re-enable as soft-delete, daily auto-downweight cron. Validate by stopping worker and confirming watchdog restarts it.

6. **Pillar 3 (Twitter overhaul)** — streaming-watcher.ts (Browserbase + GraphQL XHR intercept), rettiwt-fallback.ts, failover state machine, retire agent-reach.ts. Use TP-provided burner X account creds via env. Validate end-to-end with one tweet from FinancialJuice.

7. **Pillar 7 (Sector-of-Risk + Megacap analyst)** — `risk_sectors.ts`, persona frontmatter, dispatcher, megacap-analyst.ts. Smoke-test with a synthetic Anthropic-Google fixture.

8. **Pillar 6 (Time To Print widget)** — backend SSE channel, frontend hook, component, MainLayout integration, country flag primitive, Refinement Engine country toggle. Test floating-failover branch with `psychAssistAutoStart=true` and `=false`.

9. **Pillar 5 (Narrative classifier overhaul)** — keyword + threshold + junk-filter edits across 4 files. Then run the one-shot backfill script.

10. **Validation** — full tsc, clean vite build, backend bun build, curl smoke on every new endpoint, manual UI verification of TTP widget with simulated event, replay the Anthropic-Google fixture through the new pipeline and confirm it lands in NarrativeFlow under Singularity (NOT Middle East).

11. **Changelog + file headers** — entry in `src/lib/changelog.ts`; `// [claude-code 2026-04-25]` header on every substantially modified file.

## Acceptance Criteria

- [ ] **Harper voice**: `curl 'http://localhost:8080/api/voice/sample?voice=cori&text=Hello+Chief'` returns audio; played output sounds British, middle-aged, measured (not Rachel)
- [ ] **News worker**: boot logs `[CONTRACT-OK]` for all locked fields; killing worker triggers auto-restart within 60s + notifySuperadmins fires
- [ ] **Twitter primary**: a fresh tweet from `@DeItaone` appears on `/api/riskflow/stream` within 10s of publish
- [ ] **Twitter fallback**: forcing primary degraded → fallback engages → notifySuperadmins fires
- [ ] **Agency burst (BLS)**: simulated CPI release page change at T=0 → SSE econ-print event fires within 7s
- [ ] **Time To Print widget**: at T-5min before a scheduled CPI event, TimeToPrintDockable fades in, replaces PsychAssist; PsychAssist auto-floats when `psychAssistAutoStart=true`; pulse begins at 00:00; actual chip appears with correct beat/miss color; widget fades out at T+30s; PsychAssist returns to its prior slot
- [ ] **Multi-event collision**: simulated 8:30 cluster (CPI + Retail Sales) shows highest-rank only with `+1 more` chip; click opens dropdown
- [ ] **Country toggle**: only `US` is enabled in Refinement Engine country list
- [ ] **Megacap earnings**: `/api/earnings/upcoming` returns next 7 days of NDX∩SPX>$300B reports
- [ ] **Sector-of-Risk dispatch**: synthetic `risk_type=Singularity` catalyst routes to Herald in the boardroom
- [ ] **Narrative fix — Anthropic-Google**: replay fixture lands in NarrativeFlow under `ai-singularity` thread, NOT `middle-east-conflict`; iv_score >= 6
- [ ] **Narrative fix — Singularity bleed**: a fixture headline `"Iran retaliates against US bases"` does NOT promote to Singularity
- [ ] **Dedup**: post-backfill, no two `news_feed_items` rows share the same `headline_hash` AND `archived_at IS NULL`
- [ ] **Auto-prune**: items older than 24h with `iv_score < 3 AND narrative_id IS NULL` have `archived_at` set
- [ ] **TTP latency**: synthetic CPI fixture end-to-end source-page-change → frontend-render measures **≤ 11s** (target 7s, hard ceiling 30s)
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] All new endpoints curl-smoke verified at `localhost:8080` (after launchd restart)
- [ ] Changelog entry added to `src/lib/changelog.ts` (no plaintext secrets)
- [ ] File header `// [claude-code 2026-04-25]` added to every substantially modified file
- [ ] Worktree is `~/Desktop/Codebases/fintheon-s40-ttp-realtime`, branch `s40-ttp-realtime`

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build (mandatory: rm -rf dist first)
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Restart launchd-managed local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load   ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Live endpoint smoke (each must return non-empty JSON or audio)
curl -sI http://localhost:8080/api/diagnostics
curl -s  'http://localhost:8080/api/voice/sample?voice=cori&text=Good+morning' | head -c 200
curl -s  http://localhost:8080/api/riskflow/health
curl -s  http://localhost:8080/api/time-to-print/next
curl -s  'http://localhost:8080/api/earnings/upcoming?days=7' | head -c 400
curl -s  http://localhost:8080/api/riskflow/refresh -X POST | head -c 400

# SSE stream test (background; ctrl-c after observing one event)
curl -Ns http://localhost:8080/api/riskflow/stream &

# Supabase migration push (from main worktree, NOT from s40 worktree, per memory)
cd ~/Documents/Codebases/fintheon && supabase db push

# Narrative backfill (one-shot; idempotent)
cd backend-hono && bun run scripts/s40-narrative-backfill.ts

# Twitter primary smoke
TWITTER_PRIMARY_DEBUG=true bun run src/services/twitter/streaming-watcher.ts

# TTP latency synthetic test
bun run scripts/s40-ttp-latency-fixture.ts
```

## Commit Format

```
[v5.29.0] feat: S40 time-to-print + news realtime + narrative overhaul
```

Subsequent in-flight commits use `[v5.29.0-rcN]` format. Final ship commit is `v5.29.0`.

## Operator Notes (read before starting)

- **Browser-harness mini-pool** is a real change to `pool.ts` — coordinate carefully so it doesn't starve Harper's screenshot path.
- **Burner X account credentials** live in `1Password` (TP) — `X_BURNER_USER`, `X_BURNER_PASS`, `X_BURNER_TOTP`. Set in Fly secrets AND local launchd plist. NEVER log these.
- **FMP API key** — already in env-validation; if missing, fall back to in-memory hardcoded next-earnings dates for the 12 megacap tickers (curated quarterly).
- **Piper voice weights** — host on a public HuggingFace mirror; commit the file directly via `git lfs` if size is an issue. Cori-medium is ~30MB; jenny_dioco-medium is ~30MB. Total ~60MB image growth, acceptable.
- **The retroactive backfill is destructive** in that it sets `archived_at` on duplicates. Run on production ONLY after smoke-testing on a Supabase branch first.
- **Notify-on-restart loud, alert-on-healthy daily** — do not flood TP. Healthy = 1 push per 24h. Restarts = each occurrence + a daily summary.
- **Twitter session bans are real** — if the burner account dies, fallback rettiwt + notifySuperadmins. Do not auto-create new accounts; that's a TP decision.
- **DO NOT touch fuses, spinners, or do global icon-set swaps** per memory.
- **DO NOT regress this brief's locked cadence values without explicit TP signoff** — the contract assertion will catch you, and the changelog comment is a gravestone.
