# S2-T4: Historical Calibration DB + Upload Context

**Sprint:** S2 — RiskFlow Regime-Aware Scoring Engine
**Track:** T4 (Wave 2 — parallel with T2, T3 after T1 completes)
**Depends on:** T1 (types in `backend-hono/src/types/calibration.ts`, `backend-hono/src/types/regime.ts`)

---

## Objective

Build the calibration infrastructure: Supabase tables for scoring calibration + refinement annotations + historical observations, a bulk text parser for ingesting raw Financial Juice posts, an "Upload Context" button in the Sanctum header (MiroFish), and endpoints for CRUD operations. The actual historical data (500 FJ posts) will be ingested in a later conversation — this track builds the pipes.

---

## Files to Read First

- `backend-hono/src/types/calibration.ts` — CalibrationEntry, RefinementAnnotation, CalibrationObservation (created by T1)
- `backend-hono/src/types/regime.ts` — MarketRegime (for regimeAtTime field)
- `backend-hono/src/services/supabase-service.ts` — existing table patterns
- `backend-hono/src/services/headline-parser.ts` — parseHeadline() function for parsing raw text
- `backend-hono/src/services/twitter-cli/fj-emoji-filter.ts` — FJ emoji/keyword classification
- `frontend/components/narrative/SanctumHeader.tsx` — (renamed from AuditoriumHeader by T1) where Upload Context button goes
- `backend-hono/src/services/mirofish/mirofish-context.ts` — existing MiroFish context system
- `backend-hono/src/routes/index.ts` — route registration
- `backend-hono/src/config/scoring-weights.json` — current event weights (v2.0) to seed calibration table

---

## Files to Create

### 1. `backend-hono/src/services/calibration/calibration-service.ts` (NEW, ~130 lines)

Core calibration data management:

```typescript
import type { CalibrationEntry, RefinementAnnotation, CalibrationObservation } from '../../types/calibration';

// In-memory cache of calibration weights (refreshed from Supabase)
let calibrationCache: CalibrationEntry[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL = 60_000; // 1 min

export async function getCalibrationWeights(): Promise<CalibrationEntry[]>
// Returns all calibration entries. If table is empty, seeds from scoring-weights.json defaults.

export async function getWeightForEvent(eventType: string): Promise<number>
// Returns base_weight for eventType from calibration table.
// Falls back to scoring-weights.json default if not in table.

export async function updateCalibrationWeight(
  eventType: string,
  baseWeight: number,
  regimeOverrides?: Partial<Record<MarketRegime, number>>,
  updatedBy?: string
): Promise<void>
// UPSERT into scoring_calibration. Clears cache.

export async function seedCalibrationFromDefaults(): Promise<void>
// Reads scoring-weights.json and inserts all event types into scoring_calibration table.
// Only runs if table is empty (idempotent).

export async function addAnnotation(annotation: Omit<RefinementAnnotation, 'id' | 'createdAt'>): Promise<string>
// INSERT into refinement_annotations. Returns id.

export async function getAnnotationsForItem(riskflowItemId: string): Promise<RefinementAnnotation[]>
// SELECT from refinement_annotations WHERE riskflow_item_id = $id

export async function addObservation(obs: Omit<CalibrationObservation, 'id' | 'createdAt'>): Promise<string>
// INSERT into calibration_observations. Returns id.

export async function getObservations(limit?: number): Promise<CalibrationObservation[]>
// SELECT from calibration_observations ORDER BY created_at DESC
```

### 2. `backend-hono/src/services/calibration/bulk-parser.ts` (NEW, ~150 lines)

Parses raw Financial Juice text dumps into structured items:

```typescript
import { parseHeadline } from '../headline-parser';
import { classifyFJHeadline } from '../twitter-cli/fj-emoji-filter';

export interface BulkParseResult {
  total: number;
  parsed: ParsedBulkItem[];
  skipped: number;
  errors: string[];
}

export interface ParsedBulkItem {
  rawText: string;
  headline: string;
  parsedHeadline: ParsedHeadline;
  fjClassification: FJClassification;
  eventType: string;
  symbols: string[];
  estimatedTimestamp?: string;
}

export function parseBulkText(rawText: string): BulkParseResult
// Accepts a large block of text (copy-pasted FJ posts) and parses it.
//
// Splitting heuristics:
// 1. Split on double newlines (separate posts)
// 2. Split on timestamp patterns (e.g., "12:34 PM" or "2026-03-15")
// 3. Split on emoji prefixes (🔴, ⚠️, 🟡, 🔵)
// 4. Each chunk is one headline
//
// For each chunk:
// 1. Clean whitespace, strip URLs, normalize
// 2. Run parseHeadline() to get structured data
// 3. Run classifyFJHeadline() to get tier/macroLevel
// 4. Classify event type
// 5. Extract timestamp if present
//
// Returns { total, parsed[], skipped, errors[] }

export function bulkItemsToObservations(
  items: ParsedBulkItem[],
  instrument: string,
  defaultRegime?: MarketRegime
): Omit<CalibrationObservation, 'id' | 'createdAt'>[]
// Converts parsed bulk items into CalibrationObservation format for DB storage.
// Sets source = 'backfill'.
```

### 3. `backend-hono/src/routes/calibration/index.ts` (NEW, ~15 lines)

### 4. `backend-hono/src/routes/calibration/handlers.ts` (NEW, ~120 lines)

```typescript
// GET /api/calibration/weights — returns all calibration entries
// PUT /api/calibration/weight/:eventType — update weight { baseWeight, regimeOverrides }
// POST /api/calibration/seed — seeds calibration table from scoring-weights.json defaults
// POST /api/calibration/annotate — add annotation { riskflowItemId, comment, flawTag, suggestedScore }
// GET /api/calibration/annotations/:itemId — get annotations for an item
// POST /api/calibration/observe — add observation { headline, eventType, actualPointsMove, instrument, ... }
// GET /api/calibration/observations?limit=50 — list observations
// POST /api/calibration/bulk-parse — parse raw text { rawText, instrument } → BulkParseResult
// POST /api/calibration/bulk-ingest — parse + store { rawText, instrument, regime } → { stored: number }
// POST /api/calibration/upload-context — upload parsed data as MiroFish context { items: ParsedBulkItem[] }
```

---

## Files to Modify

### 1. `backend-hono/src/services/supabase-service.ts`

Add functions for 3 new tables:

```typescript
// --- scoring_calibration ---
export async function writeCalibrationEntry(entry: ...): Promise<void>
export async function readCalibrationEntries(): Promise<CalibrationEntry[]>
export async function upsertCalibrationWeight(eventType: string, ...): Promise<void>

// --- refinement_annotations ---
export async function writeAnnotation(ann: ...): Promise<string>
export async function readAnnotationsForItem(itemId: string): Promise<RefinementAnnotation[]>

// --- calibration_observations ---
export async function writeObservation(obs: ...): Promise<string>
export async function readObservations(limit?: number): Promise<CalibrationObservation[]>
export async function writeObservationsBatch(obs: ...[]): Promise<number>
```

**Table creation SQL:**
```sql
CREATE TABLE IF NOT EXISTS scoring_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL UNIQUE,
  base_weight DECIMAL(4,2) NOT NULL,
  regime_overrides JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS refinement_annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  riskflow_item_id TEXT NOT NULL,
  comment TEXT,
  flaw_tag TEXT,
  suggested_score DECIMAL(4,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT DEFAULT 'tp'
);
CREATE INDEX IF NOT EXISTS idx_annotation_item ON refinement_annotations(riskflow_item_id);

CREATE TABLE IF NOT EXISTS calibration_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  headline TEXT NOT NULL,
  event_type TEXT,
  predicted_iv_score DECIMAL(4,2),
  actual_points_move DECIMAL(8,2),
  instrument TEXT DEFAULT '/ES',
  regime_at_time TEXT,
  vix_at_time DECIMAL(6,2),
  observed_at TIMESTAMPTZ,
  notes TEXT,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2. `frontend/components/narrative/SanctumHeader.tsx` (renamed from AuditoriumHeader by T1)

Add "Upload Context" button next to the MiroFish "Update" button.

**Current structure (after T1 rename):**
```
[MiroFish label] [LIVE badge] ... [Presets] [Rolling: 7d|14d|30d] [Update btn]
```

**After T4:**
```
[MiroFish label] [LIVE badge] ... [Presets] [Rolling: 7d|14d|30d] [Upload Context btn] [Update btn]
```

Add:
- New prop: `onUploadContext: () => void`
- New button with `Upload` lucide icon, same styling as Update button
- On click, opens a textarea modal/dialog where user can paste raw FJ text
- Submit calls `POST /api/calibration/bulk-ingest` then calls `POST /api/calibration/upload-context`
- Show success/error toast

**Upload Context Modal** (inline in SanctumHeader or extracted):
- Textarea for pasting raw text
- Instrument selector (default /ES)
- "Parse Preview" button → shows parsed count before committing
- "Ingest" button → stores to DB + feeds to MiroFish context
- Keep under 150 lines total (modal + handler)

### 3. `backend-hono/src/services/mirofish/mirofish-context.ts`

Add function to accept calibration data as context:
```typescript
export function addCalibrationContext(items: ParsedBulkItem[]): void
// Stores parsed items in MiroFish's running context so they influence analysis.
// Format: { source: 'calibration_upload', items: [...], uploadedAt: Date }
```

### 4. `backend-hono/src/routes/index.ts`

Add calibration routes:
```typescript
import calibrationRoutes from './calibration';
app.route('/api/calibration', calibrationRoutes);
```

### 5. `backend-hono/scripts/backfill-fj-scraped.ts` (NEW, ~60 lines)

Ingestion script that loads the pre-scraped FJ headlines from `.firecrawl/fj-combined-headlines.json` (625 headlines already collected via Firecrawl map + search — zero Twitter API risk) and pushes them through the bulk-ingest endpoint.

```typescript
#!/usr/bin/env bun
/**
 * FJ Historical Backfill — Firecrawl Pre-Scraped Data
 *
 * Loads 625 FJ headlines already scraped via Firecrawl (stored at .firecrawl/fj-combined-headlines.json)
 * and pushes them through the bulk-ingest API endpoint.
 *
 * Data sources: financialjuice.com sitemap (389 URLs) + x.com/financialjuice search results (236 tweets)
 * Category breakdown: 134 geopolitical, 99 econ data, 71 fed commentary, 34 political, 287 other
 */

import { readFileSync } from 'fs';

const BACKFILL_FILE = '../../.firecrawl/fj-combined-headlines.json';
const API_BASE = 'http://localhost:8080';
const BATCH_SIZE = 50; // headlines per API call

async function main() {
  const raw = JSON.parse(readFileSync(BACKFILL_FILE, 'utf-8'));
  const items: { headline: string; source: string; url: string }[] = raw.items;
  console.log(`[backfill] Loaded ${items.length} headlines from Firecrawl scrape`);

  let stored = 0;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const rawText = batch.map(item => item.headline).join('\n\n');

    const response = await fetch(`${API_BASE}/api/calibration/bulk-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, instrument: '/ES', source: 'backfill' }),
    });
    const result = await response.json() as any;
    stored += result.stored ?? batch.length;
    console.log(`[backfill] Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} headlines → ${result.stored ?? '?'} stored`);
  }

  console.log(`[backfill] Done. Total stored: ${stored}`);
}

main().catch(console.error);
```

**Usage:**
```bash
# Backend must be running first
cd backend-hono && bun run scripts/backfill-fj-scraped.ts
```

**Pre-scraped data location:** `.firecrawl/fj-combined-headlines.json` (625 headlines, created by T1 orchestrator via Firecrawl)

---

## Key Rules / Corrections

- **The calibration table starts EMPTY, then gets SEEDED from scoring-weights.json.** The `/api/calibration/seed` endpoint handles this idempotently.
- **Bulk parser must handle messy text.** FJ posts come from URL slugs (hyphens-as-spaces) and tweet search titles — expect missing punctuation, no timestamps, no emojis. The parser should normalize hyphens-to-spaces and handle URL-encoded characters.
- **Upload Context feeds MiroFish** in addition to storing in calibration_observations. The data serves two purposes: calibration reference AND MiroFish analytical context.
- **Do NOT auto-score bulk-parsed items.** Parsing extracts structure, but IV scoring of historical items is T5's job (or manual via Refinement Engine).
- **The Upload Context button goes in SanctumHeader** (formerly AuditoriumHeader). Read the file AFTER T1 has renamed it.
- **Backfill script runs against localhost** — backend must be running. It uses the same bulk-ingest endpoint, so parsed items flow through the same pipeline.
- **Backfill is safe to re-run** — the bulk-ingest endpoint should deduplicate by headline text (or tweet_id if available).
- **Supabase status (verified 2026-03-26):** `raw_riskflow_items` and `scored_riskflow_items` are EMPTY (0 rows). `consilium_messages` has a few FJ items starting 2026-03-22.
- **Pre-scraped data (verified 2026-03-27):** 625 FJ headlines already collected via Firecrawl and stored at `.firecrawl/fj-combined-headlines.json`. Breakdown: 134 geopolitical, 99 econ data, 71 fed commentary, 34 political, 287 other. The backfill script reads this file and pushes through bulk-ingest.
- **Add a migration step:** Script should also read `consilium_messages` WHERE metadata->source = 'FinancialJuice' and copy those into `raw_riskflow_items` so we don't lose the 4 days of data already captured.

---

## Verification

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Seed calibration table
curl -X POST http://localhost:8080/api/calibration/seed
curl http://localhost:8080/api/calibration/weights
# Should return all event types with their default weights from scoring-weights.json

# 3. Bulk parse works
curl -X POST http://localhost:8080/api/calibration/bulk-parse \
  -H "Content-Type: application/json" \
  -d '{"rawText": "🔴 US CPI (MoM) Actual: 0.4% (Forecast: 0.3%, Previous: 0.5%)\n\n⚠️ Fed Chair Powell says rates will remain higher for longer", "instrument": "/ES"}'
# Should return: { total: 2, parsed: [...], skipped: 0, errors: [] }

# 4. Annotation CRUD
curl -X POST http://localhost:8080/api/calibration/annotate \
  -H "Content-Type: application/json" \
  -d '{"riskflowItemId": "test123", "comment": "This was overscored", "flawTag": "overscored", "suggestedScore": 3.5}'

# 5. Build passes
bun run build
```

---

## Changelog Entry
```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: 'S2-T4: Calibration DB — bulk parser, observation storage, annotation system, Upload Context in Sanctum header', files: ['backend-hono/src/services/calibration/calibration-service.ts', 'backend-hono/src/services/calibration/bulk-parser.ts', 'backend-hono/src/routes/calibration/handlers.ts', 'frontend/components/narrative/SanctumHeader.tsx', 'backend-hono/src/services/mirofish/mirofish-context.ts', 'backend-hono/src/services/supabase-service.ts'] }
```

---

## DO NOT

- Do NOT modify the IV scoring engine (T5 scope)
- Do NOT create the Refinement Engine UI (T7 scope)
- Do NOT modify the regime engine (T2 scope)
- Do NOT modify the commentator system (T3 scope)
- Do NOT auto-score bulk parsed items — just parse and store structure
- Do NOT fetch from Twitter/X — all historical data is pre-scraped via Firecrawl at `.firecrawl/fj-combined-headlines.json`
