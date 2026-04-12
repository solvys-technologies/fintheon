# S15-T3: Aquarium Polymarket Cards + Divergence Detector + Prediction Tracking

**Sprint:** S15 — Polymarket Integration  
**Track:** T3 of 3 (runs AFTER T1 and T2 complete)  
**Scope:** Polymarket prediction cards in Aquarium UI, Kalshi/Polymarket odds divergence detector, prediction accuracy tracking  
**Depends on:** T2 (polymarket-service.ts must exist, /api/polymarket/\* routes must be live, context bank must return Polymarket data)

---

## Context

After T1 (Hermes persona updates) and T2 (Polymarket service + context bank), the backend now serves live Polymarket data. This track builds the **user-facing** integration:

1. **Aquarium Polymarket Cards** — New prediction market cards alongside the existing futures instrument cards (/NQ, /ES, /YM, /CL, /GC)
2. **Divergence Detector** — Backend service that compares Polymarket vs Kalshi odds on overlapping markets, flags >10% divergence as a potential Kalshi trade signal
3. **Prediction Tracking** — Wire the existing `polymarket_predictions` table for agent accuracy tracking + resolution cron

**Remember: Polymarket = research/signal. Kalshi = execution. Divergence between the two = alpha.**

---

## Files to Read First

1. `frontend/components/narrative/AquariumPredictionCards.tsx` — Current futures prediction cards. You'll add a companion component for Polymarket, same visual pattern.
2. `backend-hono/src/routes/predictions.ts` — The `/api/predictions/outlook` endpoint that Aquarium fetches. Currently returns 5 futures instruments only.
3. `backend-hono/src/services/riskflow/aquarium-scheduler.ts` — Oracle AI scheduler that generates futures outlook every 30min. Model for Polymarket scheduler.
4. `backend-hono/src/services/polymarket-service.ts` — **Created by T2.** Read this to understand available methods.
5. `backend-hono/src/services/kalshi-service.ts` — Kalshi service. Needed for divergence comparison.
6. `backend-hono/src/types/polymarket.ts` — **Created by T2.** Polymarket types.
7. `backend-hono/src/types/context-bank.ts` — PolymarketMarketSummary type (expanded by T2).
8. `backend-hono/migrations/010_polymarket_predictions.sql` — Existing prediction tracking table schema.
9. `backend-hono/src/services/autopilot/signal-processor.ts` — Signal processor. You'll add Polymarket context enrichment.

---

## Task 1: Polymarket Prediction Cards Component

**File to create:** `frontend/components/narrative/PolymarketPredictionCards.tsx`

Build a companion to `AquariumPredictionCards.tsx` that displays top Polymarket markets. Same visual language (glassmorphism cards, horizontal scroll), adapted for binary probability markets.

### Interface

```typescript
interface PolymarketOutlook {
  slug: string;
  question: string; // "Will Bitcoin hit $100k by March?"
  yesPrice: number; // 0.00-1.00
  volume: number; // USDC
  category: string; // "crypto", "politics", etc.
  closeTime?: string; // ISO date
  kalshiDivergence?: {
    // null if no Kalshi equivalent
    kalshiPrice: number; // Kalshi YES equivalent
    divergencePct: number; // abs difference as percentage
    direction: "poly_higher" | "poly_lower" | "aligned";
  };
}
```

### Visual Design

Each card (220px wide, matching existing cards):

- **Header**: Category tag (e.g., "CRYPTO") in `var(--fintheon-accent)` + close date
- **Question**: 2-line truncated market question in `text-[10px]`
- **Probability Bar**: Full-width bar showing YES probability. Color: green if >0.60, red if <0.40, gold (accent) if 0.40-0.60
- **Price**: Large `text-[16px]` font-mono showing "65.2%" (yesPrice \* 100)
- **Volume**: Small `text-[7px]` muted showing "Vol: $1.2M"
- **Divergence Badge** (if kalshiDivergence exists and divergencePct > 5):
  - Show `"↕ 12% vs Kalshi"` in a small badge
  - Color: `var(--fintheon-bearish)` if divergence > 10% (significant), `var(--fintheon-muted)` if 5-10%

### Data Fetching

- Endpoint: `GET /api/predictions/polymarket-outlook` (you'll create this in Task 3)
- Poll every 120s (same as existing cards)
- Cache in localStorage with key `fintheon:polymarket-predictions`
- Same visibility-gated polling pattern as existing `AquariumPredictionCards`

### Styling Rules

- Use `var(--fintheon-*)` CSS variables only — no hardcoded colors
- No gradients, no colored emojis (project rules)
- Match the glassmorphism card style from existing prediction cards
- `scrollbar-none` on the horizontal scroll container

---

## Task 2: Mount Polymarket Cards in Aquarium

**Find the parent component** that renders `<AquariumPredictionCards />` and add the Polymarket cards below it with a subtle section divider.

Search for where `AquariumPredictionCards` is imported and rendered. Add:

```tsx
import { PolymarketPredictionCards } from "./PolymarketPredictionCards";

// In the render, after <AquariumPredictionCards />:
<div className="mt-1 pt-1 border-t border-[var(--fintheon-border)]/5">
  <div className="flex items-center gap-2 px-4 pb-1">
    <span className="text-[7px] uppercase tracking-wider text-[var(--fintheon-muted)]/30 font-semibold">
      Prediction Markets
    </span>
  </div>
  <PolymarketPredictionCards />
</div>;
```

---

## Task 3: Polymarket Outlook API Endpoint

**File to modify:** `backend-hono/src/routes/predictions.ts`

Add a new endpoint alongside the existing `/outlook`:

```typescript
// GET /api/predictions/polymarket-outlook
app.get("/polymarket-outlook", async (c) => {
  try {
    const { createPolymarketService } =
      await import("../services/polymarket-service.js");
    const polyService = createPolymarketService();

    // Get top markets by volume
    const polyData = await polyService.getMarkets(undefined, 8);

    // Try to get Kalshi markets for divergence comparison
    let kalshiMarkets: Array<{
      ticker: string;
      title: string;
      lastPrice: number;
    }> = [];
    try {
      const { createKalshiService } =
        await import("../services/kalshi-service.js");
      const kalshiService = createKalshiService();
      const kalshiData = await kalshiService.getMarkets();
      kalshiMarkets = kalshiData.markets;
    } catch {
      // Kalshi unavailable — skip divergence
    }

    const markets = polyData.markets.map((m) => {
      // Fuzzy match: find Kalshi market with similar title
      const kalshiMatch = findKalshiMatch(m.question, kalshiMarkets);

      return {
        slug: m.slug,
        question: m.question,
        yesPrice: m.yesPrice,
        volume: m.volume,
        category: m.category,
        closeTime: m.closeTime,
        kalshiDivergence: kalshiMatch
          ? {
              kalshiPrice: kalshiMatch.lastPrice,
              divergencePct: Math.abs(m.yesPrice - kalshiMatch.lastPrice) * 100,
              direction:
                m.yesPrice > kalshiMatch.lastPrice + 0.02
                  ? "poly_higher"
                  : m.yesPrice < kalshiMatch.lastPrice - 0.02
                    ? "poly_lower"
                    : "aligned",
            }
          : undefined,
      };
    });

    return c.json({
      markets,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Predictions] polymarket outlook error:", err);
    return c.json(
      {
        markets: [],
        fetchedAt: new Date().toISOString(),
        error: "Fetch failed",
      },
      500,
    );
  }
});
```

### Fuzzy matching helper (in same file):

```typescript
function findKalshiMatch(
  polyQuestion: string,
  kalshiMarkets: Array<{ ticker: string; title: string; lastPrice: number }>,
): { ticker: string; title: string; lastPrice: number } | null {
  if (kalshiMarkets.length === 0) return null;

  const polyLower = polyQuestion.toLowerCase();
  // Extract key terms (remove stop words)
  const keyTerms = polyLower
    .replace(/will |the |be |by |in |to |of |a |an /g, "")
    .split(/\s+/)
    .filter((t) => t.length > 3);

  let bestMatch: (typeof kalshiMarkets)[0] | null = null;
  let bestScore = 0;

  for (const km of kalshiMarkets) {
    const kalshiLower = km.title.toLowerCase();
    let score = 0;
    for (const term of keyTerms) {
      if (kalshiLower.includes(term)) score++;
    }
    // Require at least 3 matching terms for a valid match
    if (score >= 3 && score > bestScore) {
      bestScore = score;
      bestMatch = km;
    }
  }

  return bestMatch;
}
```

---

## Task 4: Divergence Detector Service

**File to create:** `backend-hono/src/services/polymarket-kalshi-divergence.ts`

This runs on a schedule and compares Polymarket vs Kalshi odds on overlapping markets. When divergence exceeds threshold, it writes an alert to the boardroom/bulletin for agent discussion.

```typescript
// [claude-code 2026-04-12] S15-T3: Cross-platform odds divergence detector

import { createPolymarketService } from "./polymarket-service.js";
import { createKalshiService } from "./kalshi-service.js";
import { getSupabaseClient } from "../config/supabase.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("DivergenceDetector");
const DIVERGENCE_THRESHOLD = 0.1; // 10%
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 min

export interface DivergenceAlert {
  id: string;
  polymarketSlug: string;
  polymarketQuestion: string;
  polymarketYesPrice: number;
  kalshiTicker: string;
  kalshiTitle: string;
  kalshiYesPrice: number;
  divergencePct: number;
  direction: "poly_higher" | "poly_lower";
  detectedAt: string;
  significance: "moderate" | "high"; // 10-15% = moderate, >15% = high
}

let recentAlerts: DivergenceAlert[] = [];

export function getRecentDivergenceAlerts(): DivergenceAlert[] {
  return recentAlerts;
}

async function checkDivergence(): Promise<void> {
  try {
    const polyService = createPolymarketService();
    const kalshiService = createKalshiService();

    const [polyData, kalshiData] = await Promise.all([
      polyService.getMarkets(undefined, 30),
      kalshiService.getMarkets(),
    ]);

    if (!polyData.markets.length || !kalshiData.markets.length) {
      log.warn("Missing data from one or both platforms");
      return;
    }

    const newAlerts: DivergenceAlert[] = [];

    for (const pm of polyData.markets) {
      const kalshiMatch = findBestMatch(pm.question, kalshiData.markets);
      if (!kalshiMatch) continue;

      const divergence = Math.abs(pm.yesPrice - kalshiMatch.lastPrice);
      if (divergence < DIVERGENCE_THRESHOLD) continue;

      newAlerts.push({
        id: `div-${pm.conditionId}-${Date.now()}`,
        polymarketSlug: pm.slug,
        polymarketQuestion: pm.question,
        polymarketYesPrice: pm.yesPrice,
        kalshiTicker: kalshiMatch.ticker,
        kalshiTitle: kalshiMatch.title,
        kalshiYesPrice: kalshiMatch.lastPrice,
        divergencePct: Math.round(divergence * 100),
        direction:
          pm.yesPrice > kalshiMatch.lastPrice ? "poly_higher" : "poly_lower",
        detectedAt: new Date().toISOString(),
        significance: divergence > 0.15 ? "high" : "moderate",
      });
    }

    if (newAlerts.length > 0) {
      log.info(`Found ${newAlerts.length} divergence alerts`, {
        alerts: newAlerts.map(
          (a) => `${a.polymarketQuestion}: ${a.divergencePct}%`,
        ),
      });
    }

    recentAlerts = newAlerts;
  } catch (err) {
    log.error("Divergence check failed", { error: String(err) });
  }
}

// Simple fuzzy match — same logic as predictions route
function findBestMatch(
  polyQuestion: string,
  kalshiMarkets: Array<{ ticker: string; title: string; lastPrice: number }>,
): { ticker: string; title: string; lastPrice: number } | null {
  const polyLower = polyQuestion.toLowerCase();
  const keyTerms = polyLower
    .replace(/will |the |be |by |in |to |of |a |an /g, "")
    .split(/\s+/)
    .filter((t) => t.length > 3);

  let best: (typeof kalshiMarkets)[0] | null = null;
  let bestScore = 0;

  for (const km of kalshiMarkets) {
    const title = km.title.toLowerCase();
    let score = 0;
    for (const term of keyTerms) {
      if (title.includes(term)) score++;
    }
    if (score >= 3 && score > bestScore) {
      bestScore = score;
      best = km;
    }
  }

  return best;
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startDivergenceDetector(): void {
  log.info("Starting divergence detector (15min interval)");
  // Initial run after 30s delay (let services boot)
  setTimeout(() => checkDivergence(), 30_000);
  intervalId = setInterval(checkDivergence, CHECK_INTERVAL_MS);
}

export function stopDivergenceDetector(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
```

---

## Task 5: Divergence API Route

**File to modify:** `backend-hono/src/routes/polymarket/index.ts` (created by T2)

Add a new endpoint to the existing Polymarket routes:

```typescript
import { getRecentDivergenceAlerts } from "../../services/polymarket-kalshi-divergence.js";

// GET /api/polymarket/divergence — cross-platform odds comparison
app.get("/divergence", (c) => {
  const alerts = getRecentDivergenceAlerts();
  return c.json({
    alerts,
    count: alerts.length,
    fetchedAt: new Date().toISOString(),
  });
});
```

---

## Task 6: Start Divergence Detector on Boot

Find where the backend starts its schedulers/services (likely in the main `index.ts` or a startup file). Search for `startAquariumScheduler` or similar scheduler boot calls.

Add alongside existing scheduler starts:

```typescript
import { startDivergenceDetector } from "./services/polymarket-kalshi-divergence.js";

// In the startup sequence:
startDivergenceDetector();
```

---

## Task 7: Prediction Tracking Routes

**File to modify:** `backend-hono/src/routes/polymarket/index.ts` (created by T2)

Add endpoints for the existing `polymarket_predictions` table:

```typescript
// POST /api/polymarket/predictions — record an agent prediction
app.post("/predictions", async (c) => {
  const body = await c.req.json();
  const {
    marketId,
    marketTitle,
    predictedOutcome,
    predictedProbability,
    agentName,
    snapshotProbability,
  } = body;

  if (
    !marketId ||
    !marketTitle ||
    !predictedOutcome ||
    predictedProbability == null
  ) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const sb = getSupabaseClient();
  if (!sb) return c.json({ error: "No database" }, 503);

  const { data, error } = await sb
    .from("polymarket_predictions")
    .insert({
      market_id: marketId,
      market_title: marketTitle,
      predicted_outcome: predictedOutcome,
      predicted_probability: predictedProbability,
      agent_name: agentName || "Oracle",
      snapshot_probability: snapshotProbability || predictedProbability,
    })
    .select()
    .single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// GET /api/polymarket/predictions — list predictions with optional filters
app.get("/predictions", async (c) => {
  const agent = c.req.query("agent");
  const resolved = c.req.query("resolved");
  const limit = parseInt(c.req.query("limit") || "50", 10);

  const sb = getSupabaseClient();
  if (!sb) return c.json({ error: "No database" }, 503);

  let query = sb
    .from("polymarket_predictions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (agent) query = query.eq("agent_name", agent);
  if (resolved === "true") query = query.eq("resolved", true);
  if (resolved === "false") query = query.eq("resolved", false);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);
  return c.json({ predictions: data, count: data?.length ?? 0 });
});

// GET /api/polymarket/predictions/accuracy — agent accuracy stats
app.get("/predictions/accuracy", async (c) => {
  const agent = c.req.query("agent");

  const sb = getSupabaseClient();
  if (!sb) return c.json({ error: "No database" }, 503);

  let query = sb
    .from("polymarket_predictions")
    .select("agent_name, result, predicted_probability")
    .eq("resolved", true);

  if (agent) query = query.eq("agent_name", agent);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  // Compute stats per agent
  const stats: Record<
    string,
    { total: number; wins: number; losses: number; avgConfidence: number }
  > = {};
  for (const row of data ?? []) {
    const name = row.agent_name;
    if (!stats[name])
      stats[name] = { total: 0, wins: 0, losses: 0, avgConfidence: 0 };
    stats[name].total++;
    if (row.result === "win") stats[name].wins++;
    else stats[name].losses++;
    stats[name].avgConfidence += row.predicted_probability;
  }

  const result = Object.entries(stats).map(([agent, s]) => ({
    agent,
    total: s.total,
    wins: s.wins,
    losses: s.losses,
    winRate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0,
    avgConfidence:
      s.total > 0 ? Math.round((s.avgConfidence / s.total) * 100) : 0,
  }));

  return c.json({ accuracy: result });
});
```

Add the Supabase import at the top of the polymarket routes file:

```typescript
import { getSupabaseClient } from "../../config/supabase.js";
```

---

## Task 8: Prediction Resolution Cron

**File to create:** `backend-hono/src/services/polymarket-prediction-resolver.ts`

Check resolved Polymarket markets and update prediction records:

```typescript
// [claude-code 2026-04-12] S15-T3: Resolve Polymarket predictions when markets close

import { createPolymarketService } from "./polymarket-service.js";
import { getSupabaseClient } from "../config/supabase.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("PredictionResolver");
const RESOLVE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function resolveClosedPredictions(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  // Get unresolved predictions
  const { data: pending } = await sb
    .from("polymarket_predictions")
    .select("id, market_id, predicted_outcome")
    .eq("resolved", false)
    .limit(50);

  if (!pending || pending.length === 0) return;

  const polyService = createPolymarketService();
  let resolved = 0;

  for (const pred of pending) {
    try {
      // Check if the market has closed on Polymarket
      // A closed market has yesPrice ~1.00 or ~0.00 (settled)
      const market = await polyService.getMarketBySlug(pred.market_id);
      if (!market) continue;
      if (market.status !== "closed") continue;

      // Determine actual outcome: if yesPrice >= 0.95, YES won. If <= 0.05, NO won.
      let actualOutcome: string | null = null;
      if (market.yesPrice >= 0.95) actualOutcome = "Yes";
      else if (market.yesPrice <= 0.05) actualOutcome = "No";
      else continue; // Not yet settled

      const isWin =
        pred.predicted_outcome.toLowerCase() === actualOutcome.toLowerCase();

      await sb
        .from("polymarket_predictions")
        .update({
          resolved: true,
          actual_outcome: actualOutcome,
          result: isWin ? "win" : "loss",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", pred.id);

      resolved++;
    } catch (err) {
      log.warn(`Failed to resolve prediction ${pred.id}`, {
        error: String(err),
      });
    }
  }

  if (resolved > 0) {
    log.info(`Resolved ${resolved} predictions`);
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startPredictionResolver(): void {
  log.info("Starting prediction resolver (1h interval)");
  setTimeout(() => resolveClosedPredictions(), 60_000); // 1min delay after boot
  intervalId = setInterval(resolveClosedPredictions, RESOLVE_INTERVAL_MS);
}

export function stopPredictionResolver(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
```

Start alongside the divergence detector in the boot sequence:

```typescript
import { startPredictionResolver } from "./services/polymarket-prediction-resolver.js";
startPredictionResolver();
```

---

## Task 9: Changelog Entry

**File to modify:** `src/lib/changelog.ts`

```typescript
{
  date: '2026-04-12T14:00:00',
  agent: 'claude-code',
  summary: 'S15-T3: Aquarium Polymarket prediction cards, Kalshi/Polymarket divergence detector (15min), prediction accuracy tracking + resolution cron (1h). Divergence >10% flagged as Kalshi trade signal.',
  files: [
    'frontend/components/narrative/PolymarketPredictionCards.tsx',
    'backend-hono/src/routes/predictions.ts',
    'backend-hono/src/services/polymarket-kalshi-divergence.ts',
    'backend-hono/src/services/polymarket-prediction-resolver.ts',
    'backend-hono/src/routes/polymarket/index.ts',
  ]
}
```

---

## Verification

1. **TypeScript:**

   ```bash
   cd ~/Documents/Codebases/fintheon && npx tsc --noEmit 2>&1 | head -20
   ```

2. **Build:**

   ```bash
   bun run build
   ```

3. **Backend smoke tests:**

   ```bash
   # Polymarket outlook
   curl -s http://localhost:8080/api/predictions/polymarket-outlook | jq '.markets | length'
   # Should return > 0

   # Divergence alerts
   curl -s http://localhost:8080/api/polymarket/divergence | jq '.alerts'

   # Record a test prediction
   curl -s -X POST http://localhost:8080/api/polymarket/predictions \
     -H "Content-Type: application/json" \
     -d '{"marketId":"test-btc","marketTitle":"Will BTC hit 100k","predictedOutcome":"Yes","predictedProbability":0.65,"agentName":"Oracle","snapshotProbability":0.55}'

   # Retrieve predictions
   curl -s http://localhost:8080/api/polymarket/predictions?agent=Oracle | jq '.predictions | length'

   # Accuracy (will be empty until predictions resolve)
   curl -s http://localhost:8080/api/polymarket/predictions/accuracy | jq '.accuracy'
   ```

4. **Frontend visual check:**
   - Start dev server: `cd frontend && bun run dev`
   - Navigate to Aquarium view
   - Verify: existing futures cards still render, new "Prediction Markets" section appears below with Polymarket cards
   - Cards should show: question, probability percentage, volume, category
   - If any card has a Kalshi divergence, verify the badge renders

---

## DO NOT

- Do NOT modify `AquariumPredictionCards.tsx` — create a NEW companion component
- Do NOT modify `polymarket-service.ts` or `polymarket types` — those are T2's deliverables, treat them as stable
- Do NOT modify Hermes agent persona files — that's T1's scope
- Do NOT add live trading capabilities — everything is read-only + paper
- Do NOT modify the signal-processor.ts SignalEvent source type — Polymarket enriches context, it doesn't generate Autopilot signals
- Do NOT delete the heuristic fallback in predictions.ts — the AI outlook should be additive
- Do NOT use hardcoded colors — use `var(--fintheon-*)` variables only
- Do NOT use gradients or colored emojis (project rules)
