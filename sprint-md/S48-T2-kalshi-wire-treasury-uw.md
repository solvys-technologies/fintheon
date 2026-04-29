# Sprint Brief: T2 — Kalshi Whale Tracker + Wire Filters + Treasury + UW Prompts + Desk Plan

## Context

Kalshi is already fully integrated in the codebase (`kalshi-service.ts`, 270 lines with whale detection, market filtering, divergence scanning). The only missing piece is a RiskFlow feed pipe with Econ & Politics category filtering. Wire sources (FinancialJuice, DeItaOne) have no speculation noise filter — headlines containing "reportedly", "could", "might" pass all 9 content guard gates unchecked. Treasury auction results are not scraped. Unusual Whales MCP data (GEX, options walls, flow) is already integrated but agents don't know to use it for support/resistance analysis alongside RiskFlow headlines. The CAO (Harper) needs a midnight pulse schedule for desk planning.

This track adds the Kalshi → RiskFlow pipe, wire speculation filter, Treasury scraper, UW agent prompt updates, and the Desk Plan CAO schedule — all new files with zero overlap against T1's backend changes.

## Branch Target

`s48-t2-kalshi-wire-treasury` from `main` at `23129632`

## Scope — Included

- [ ] Kalshi whale alerts → RiskFlow pipe (Econ & Politics category filter only, no weather/crypto/meme)
- [ ] `speculation-filter.ts` — new standalone module for wire noise filtering (imported by T5 unification)
- [ ] Treasury auction RSS scraper (home.treasury.gov → standard tier)
- [ ] Unusual Whales agent prompt updates (Harper/Oracle/Feucht/Consul → query UW for support/resistance + news impact)
- [ ] CAO Desk Plan midnight pulse schedule

## Scope — Excluded (DO NOT TOUCH)

- `content-guard.ts` (T1 owns it — market relevance fix. T5 wires speculation-filter.ts import)
- `econ-bridge.ts`, `scorer-tagging.ts`, `central-scorer.ts`, `feed-service.ts` (T1 owns all)
- `RefinementEngine.tsx` (T3 owns frontend pipeline UI)
- `MainLayout.tsx`, `Sanctum.tsx` (T4 owns layout fixes)
- Kalshi credentials in env (handled via Fly secrets or Electron iFrame cookie capture — T5 wires the auth path)
- Rettiwt re-enablement (dead code since S27-T4)

## Reuse Inventory (existing code to call, not reinvent)

- `kalshi-service.ts:194` (`getWhaleAlerts()`) — already detects whales >100 contracts or >$5K notional
- `kalshi-service.ts:171` (`getMarkets()`) — fetches open markets from Kalshi Trading API
- `kalshi-service.ts:13-14` — Kalshi API base: `https://trading-api.kalshi.com/trade-api/v2`
- `oracle-research/scanner.ts:32` (`MIN_VOLUME_THRESHOLD = 5000`) — existing Oracle scanner filters by volume
- `oracle-research/scanner.ts` — already scans Kalshi + Polymarket for macro, monetary-policy, geopolitical, energy contracts
- `scorer-tagging.ts:161-167` — `PREDICTION_KEYWORDS` array includes "kalshi", "prediction market"
- `scorer-tagging.ts:180` — `rawSource === "Polymarket" || rawSource === "Kalshi"` → normalize to "Polymarket" bucket
- `browser/allowlist.ts:31` — `{ domain: "kalshi.com", tier: "market", dailyQuota: 100 }`
- `polymarket-kalshi-divergence.ts` — cross-platform odds divergence at 15-min intervals
- `unusual-whales.ts` — full API client: `getGammaExposure()`, `getOptionsWalls()`, `getOptionsFlow()`
- `unusual-whales.ts:11` (`isAvailable()`) — returns false if no API key set
- `market-data/index.ts` — exports unusualWhales as part of market-data service
- `mcp/index.ts:128-134` — unusual-whales MCP registry entry with `apiKeyEnvVar`
- `browser/allowlist.ts:26` — `{ domain: "treasury.gov", tier: "regulatory", dailyQuota: 100 }`
- `fiscal-sources/bessent-speeches.ts` — scrapes home.treasury.gov RSS for Bessent speeches
- `workers/riskflow-worker/sources/index.ts:46` — `COT_REPORT_URL` constant (CFTC URL pattern reference)
- `workers/riskflow-worker/sources/index.ts:117-125` — FOMC Minutes RSS pattern reference
- `event types` at `types/kalshi.ts` — `WhaleAlert`, `KalshiMarket`, `KalshiTrade` types
- `agent-instructions/` directory — Harper, Oracle, Feucht, Consul SOUL files

## Known Issues to Preserve

- Xquik-dev/x-twitter-scraper is TP-vetoed. Do not reference or import.
- Rettiwt is inert. Do not attempt to re-enable for Kalshi or Treasury polling.
- Kalshi auth currently uses email/password env vars (`KALSHI_EMAIL`, `KALSHI_PASSWORD`). If TP uses Google OAuth, the auth path will be: Kalshi API key (check account settings) → Fly secret, or Electron iFrame → session cookie capture. T5 wires the final auth method.
- Unusual Whales MCP is confirmed free per TP (S45.5 changelog). The `UNUSUAL_WHALES_API_KEY` env var is already referenced. The MCP server source path on disk is currently missing — per S45.5, TP needs to share the clone URL or npm name.
- The `econ-calendar-populator.ts` already uses TradingView as the sole source (ForexFactory dropped per S46.4). Do not change this.

## Implementation Steps

### Step 1: Kalshi Whale Tracker → RiskFlow Pipe

In `backend-hono/src/services/kalshi-service.ts`, add a new function `getEconPoliticsWhaleAlerts()`:

```typescript
// Filter whale alerts to Economics & Politics categories only
// Reuse existing getWhaleAlerts() at line 194
// Filter by market category: "economics", "politics", "monetary-policy", "fiscal"
// Exclude: "weather", "crypto", "entertainment", "sports", "memes"
// Map to FeedItem format with source: "Kalshi", ingest_pipeline: "kalshi-whale"
// Pass to a new feed-bridge function
```

Create `backend-hono/src/services/riskflow/kalshi-feed-pipe.ts` (new file, <100 lines):

```typescript
// Maps Kalshi WhaleAlert → FeedItem for raw_riskflow_items
// Sets: source = "Kalshi", ingest_pipeline = "kalshi-whale", category = event category
// Sets headline format: "{marketTitle} | Whale: {contracts} contracts / ${notional} | {takerSide}"
// Runs every 5 minutes in standard tier or as a separate cron
```

Wire into `workers/riskflow-worker/sources/index.ts` as a new Standard tier entry:

```typescript
// After line 145 (Macro X handles fallback), add:
// Kalshi whale alerts (Econ & Politics only)
try {
  const kalshiItems = await pollKalshiWhaleAlerts();
  if (kalshiItems.length > 0) {
    await persistItems(kalshiItems, "standard");
  }
} catch (err) {
  log.warn("Kalshi whale poll failed", { error: String(err) });
}
```

### Step 2: Speculation Filter Module

Create `backend-hono/src/services/riskflow/speculation-filter.ts` (new file, <120 lines):

```typescript
// Standalone module. T5 will wire the import into content-guard.ts.
// Applies as a new gate in checkContentGuard() order.

export type SpeculationAction = "block" | "demote" | "off";

// Hedged-language patterns indicating speculation, not confirmed facts
const SPECULATION_PATTERNS: RegExp[] = [
  /\breportedly\b/i,
  /\bsources\s+say\b/i,
  /\bcould\s+(?:be|see|lead|trigger|push|cause)\b/i,
  /\bmight\s+(?:be|see|signal|indicate)\b/i,
  /\brumored\b/i,
  /\ballegedly\b/i,
  /\bpurportedly\b/i,
  /\bunconfirmed\b/i,
  /\bpossibly\b/i,
  /\bit\s+appears\b/i,
  /\bsome\s+analysts?\s+(?:believe|think|say|expect)\b/i,
  /\btalks?\s+of\b/i,
  /\b(?:under|being)\s+consider(?:ed|ing)\b/i,
  /\bhinting\b/i,
];

// Score demotion factor: 0.7× for hedged language
export const SPECULATION_DEMOTE_FACTOR = 0.7;

export function isSpeculative(headline: string, body?: string): boolean {
  const text = `${headline} ${body ?? ""}`;
  return SPECULATION_PATTERNS.some((p) => p.test(text));
}
```

**Application policy (to be wired by T5 in content-guard.ts):**

- Wire items: `isSpeculative()` → apply action. Default action: "demote" (score ×0.7).
- Other source types: `isSpeculative()` → "block" (drop item entirely).
- Exception: items where `ingest_pipeline === "economic-calendar"` always pass (econ prints are confirmed data, not speculative).
- Configurable via `ingest_pipeline_state` table (speculation-action column or separate config).

### Step 3: Treasury Auction RSS Scraper

Create `backend-hono/src/services/riskflow/treasury-feed.ts` (new file, <80 lines):

```typescript
// Polls https://home.treasury.gov/news/press-releases/feed via RSS
// Filters for auction announcements: "Treasury Auctions", "Notes", "Bonds", "Bills"
// Maps to FeedItem with source: "Treasury", ingest_pipeline: "browser-harness", category: "fiscal"
// Headline format: "Treasury Auction: {security} | Yield: {yield}% | Bid-to-Cover: {b2c}x"
```

Wire into `workers/riskflow-worker/sources/index.ts` Standard tier, after FOMC Minutes RSS:

```typescript
// Treasury auction results (home.treasury.gov RSS)
// Lines after 132: add another agent-reach RSS poll entry
const treasuryItems = await collectFromAgentReach({
  rssFeeds: ["https://home.treasury.gov/news/press-releases/feed"],
  tier: "standard",
  // Filter: only items whose title matches Treasury auction patterns
});
```

The existing `agent-reach.ts` already has `enrich: true` option which does a full HTML scrape after RSS ingest. Treasury RSS items don't need enrichment (the RSS summary is sufficient).

### Step 4: Unusual Whales Agent Prompt Updates

Edit the following agent instruction files in `backend-hono/src/services/ai/agent-instructions/`:

**Harper (CAO) — `harper.md`:**
Add to the data-source section (after "use TradingView API first"):

```
### Unusual Whales Data (Support/Resistance)
When analyzing RiskFlow headlines for market impact:
1. Query Unusual Whales for GEX (gamma exposure) on affected instruments
2. Cross-reference headline sentiment with options walls (strike levels with large OI)
3. Identify if key support/resistance levels coincide with the news catalyst
4. Flag when news breaks near a gamma flip level or max pain strike
5. Include bars/pinpoint in analysis: "Headline X → /ES approaching 5300 call wall → resistance likely"
```

**Oracle (Forecaster) — `oracle.md`:**

```
### Prediction Market + Options Integration
When evaluating event probabilities:
1. Cross-reference Kalshi/Polymarket probabilities with UW options flow
2. If a whale is heavily positioned on one side AND options flow confirms, flag as high conviction
3. If prediction market odds diverge from options positioning, flag as uncertainty signal
```

**Feucht (Risk Manager) — `feucht.md`:**

```
### Options-Based Risk Assessment
For risk evaluation:
1. Check UW gamma exposure for crowded positioning
2. GEX flip zones = potential volatility expansion
3. Max pain = likely pinning level on expiration
4. Flag when RiskFlow headlines suggest movement INTO a call/put wall
```

**Consul (Fundamentals) — `consul.md`:**

```
### Macro + Options Cross-Reference
When evaluating macro events:
1. After CPI/NFP/FOMC: immediately pull UW data for rate-sensitive instruments
2. Compare options flow before/after event for sentiment shift
3. Put/call ratio changes = institutional positioning signal
```

### Step 5: Desk Plan CAO Midnight Pulse

Create `backend-hono/src/services/desk-planner.ts` (new file, <150 lines):

```typescript
// Runs at 00:00 ET daily (midnight)
// Harper polls economic_events for today's events
// Writes a "desk_plan" entry to a new table or in-memory cache
// Frontend SessionCountdownWidget reads from cache
// Pulse behavior: widget shows today's events → fades → countdown to next event

export interface DeskPlan {
  date: string;
  events: Array<{
    name: string;
    time: string;
    forecast: string;
    previous: string;
    priority: "critical" | "high" | "medium" | "low";
    countdownTo: string; // ISO timestamp
  }>;
  generatedAt: string;
}

export async function generateDailyDeskPlan(): Promise<DeskPlan> {
  // Query economic_events WHERE date = today() ORDER BY time ASC
  // Build event list with countdown timestamps
  // Cache in memory + broadcast via SSE
}
```

Wire into boot services at `backend-hono/src/boot/services.ts` (cron entry):

```typescript
// Desk Plan: midnight pulse
cron.schedule(
  "0 0 * * 1-5",
  async () => {
    await generateDailyDeskPlan();
  },
  { timezone: "America/New_York" },
);
```

## Acceptance Criteria

- [ ] `getEconPoliticsWhaleAlerts()` returns only Econ & Politics category whales
- [ ] Kalshi whale items appear in `raw_riskflow_items` with `source: "Kalshi"`, `ingest_pipeline: "kalshi-whale"`
- [ ] `speculation-filter.ts` exports `isSpeculative()` + `SPECULATION_DEMOTE_FACTOR`
- [ ] All 14 hedge-language patterns match correctly (test with sample FJ headlines)
- [ ] Treasury RSS scraper produces items with appropriate event filtering
- [ ] All 4 agent SOUL files updated with UW data-source instructions
- [ ] `desk-planner.ts` generates daily desk plan at midnight
- [ ] No file exceeds 300 lines
- [ ] `cd backend-hono && bun run build` passes

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Test speculation filter (pure function, no DB needed)
cd backend-hono && bun -e "
  const { isSpeculative } = require('./dist/services/riskflow/speculation-filter.js');
  console.log('reportedly:', isSpeculative('Fed reportedly considers rate cut'));
  console.log('confirmed:', isSpeculative('Fed holds rates at 4.50%'));
"

# Test Kalshi whale filtering (requires auth)
curl -s http://localhost:8080/api/kalshi/whale-alerts 2>/dev/null | head -c 200 || echo "Needs Kalshi auth configured"
```

## Commit Format

```
[v5.35.0] feat: T2 Kalshi whale tracker + wire speculation filter + Treasury RSS + UW agent prompts + Desk Plan CAO midnight pulse
```
