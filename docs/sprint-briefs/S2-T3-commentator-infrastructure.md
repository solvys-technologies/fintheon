# S2-T3: Commentator Infrastructure

**Sprint:** S2 — RiskFlow Regime-Aware Scoring Engine
**Track:** T3 (Wave 2 — parallel with T2, T4 after T1 completes)
**Depends on:** T1 (types in `backend-hono/src/types/commentator.ts`)

---

## Objective

Build the commentator tagging system: a speaker extraction service that identifies who's talking in a headline, a registry of known officials with tier assignments, and CRUD endpoints for managing the registry. The actual roster of names will be populated LATER when TP reviews historical posts — this track builds the infrastructure only.

---

## Files to Read First

- `backend-hono/src/types/commentator.ts` — CommentatorEntry, CommentatorTier, TIER_DEFAULT_MULTIPLIERS (created by T1)
- `backend-hono/src/services/headline-parser.ts` — existing entity extraction (line ~50+), ParsedHeadline.entity field
- `backend-hono/src/services/iv-scoring-v2.ts` — classifyEventType function (~line 954), `powellSpeak` and `politicalCommentary` detection
- `backend-hono/src/services/supabase-service.ts` — table patterns
- `backend-hono/src/routes/index.ts` — route registration

---

## Files to Create

### 1. `backend-hono/src/services/commentator/commentator-service.ts` (NEW, ~100 lines)

Registry management:

```typescript
import type { CommentatorEntry, CommentatorTier } from '../../types/commentator';
import { TIER_DEFAULT_MULTIPLIERS, UNTAGGED_MULTIPLIER } from '../../types/commentator';

// In-memory cache of commentator registry (refreshed from Supabase)
let registry: CommentatorEntry[] = [];
let registryLoadedAt = 0;
const CACHE_TTL = 300_000; // 5 min

export async function getRegistry(): Promise<CommentatorEntry[]>
// Returns full active registry from Supabase. Cached 5 min.

export async function addCommentator(entry: Omit<CommentatorEntry, 'id' | 'createdAt'>): Promise<CommentatorEntry>
// INSERT into commentator_registry. Clears cache.

export async function updateCommentator(id: string, updates: Partial<CommentatorEntry>): Promise<void>
// UPDATE commentator_registry. Clears cache.

export async function removeCommentator(id: string): Promise<void>
// SET active = false. Clears cache.

export async function getMultiplierForSpeaker(speakerName: string): Promise<number>
// Looks up speaker in registry (fuzzy match against name + aliases).
// Returns tier's weightMultiplier if found, UNTAGGED_MULTIPLIER (0.8) if not.

export function fuzzyMatchSpeaker(name: string, registry: CommentatorEntry[]): CommentatorEntry | null
// Case-insensitive match against entry.name and entry.aliases[].
// Handles partial matches: "Powell" matches alias "Jerome Powell".
// Returns best match or null.
```

### 2. `backend-hono/src/services/commentator/speaker-extractor.ts` (NEW, ~120 lines)

Extracts the speaker/official from a headline:

```typescript
export interface SpeakerExtraction {
  speaker: string | null;      // "Powell", "Bessent", "Waller"
  institution: string | null;  // "Federal Reserve", "US Treasury"
  isOfficial: boolean;         // true if detected as named official (vs generic "analyst says")
  confidence: number;          // 0-1
}

export function extractSpeaker(headline: string): SpeakerExtraction
// Pattern matching to identify who is speaking in a headline.
//
// Patterns:
// 1. "PERSON_NAME says/said/warns/signals/confirms..."
// 2. "Fed's PERSON_NAME: ..."
// 3. "BOE/ECB/BOJ PERSON_NAME ..."
// 4. "Treasury Secretary PERSON_NAME ..."
// 5. "PERSON_NAME (Fed/ECB/BOJ) ..."
//
// Known official patterns (expand later via registry):
// Federal Reserve: Powell, Waller, Bowman, Barkin, Bostic, Daly, Williams, Goolsbee, Kashkari, Harker, Mester, Logan, Collins, Jefferson, Cook, Kugler
// Treasury: Bessent, Lutnick
// Political: Trump, POTUS
// ECB: Lagarde, Schnabel, Lane, Panetta, Villeroy
// BOJ: Ueda
// BOE: Bailey
// Media (Fed whisperer): Timiraos, Nick Timiraos
//
// Returns { speaker, institution, isOfficial, confidence }.
// If no speaker detected, returns { speaker: null, isOfficial: false, confidence: 0 }.

// Known institutions for reverse lookup
const INSTITUTION_MAP: Record<string, string> = {
  'fed': 'Federal Reserve',
  'fomc': 'Federal Reserve',
  'ecb': 'European Central Bank',
  'boj': 'Bank of Japan',
  'boe': 'Bank of England',
  'treasury': 'US Treasury',
};
```

### 3. `backend-hono/src/routes/commentator/index.ts` (NEW, ~15 lines)
Route registration file.

### 4. `backend-hono/src/routes/commentator/handlers.ts` (NEW, ~90 lines)

```typescript
// GET /api/commentator/registry — returns full active registry
// POST /api/commentator — add new { name, aliases, tier, role, institution }
// PUT /api/commentator/:id — update entry
// DELETE /api/commentator/:id — soft delete (active=false)
// POST /api/commentator/identify — test extraction: { headline } → { speaker, tier, multiplier }
```

---

## Files to Modify

### 1. `backend-hono/src/services/supabase-service.ts`

Add functions for `commentator_registry` table:

```typescript
export async function writeCommentator(entry: Omit<CommentatorEntry, 'id' | 'createdAt'>): Promise<string>
// INSERT into commentator_registry, returns id

export async function readCommentatorRegistry(): Promise<CommentatorEntry[]>
// SELECT from commentator_registry WHERE active = true

export async function updateCommentatorEntry(id: string, updates: Record<string, unknown>): Promise<void>
// UPDATE commentator_registry SET ... WHERE id = $id

export async function deactivateCommentator(id: string): Promise<void>
// UPDATE commentator_registry SET active = false WHERE id = $id
```

**Table creation:**
```sql
CREATE TABLE IF NOT EXISTS commentator_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
  role TEXT,
  institution TEXT,
  weight_multiplier DECIMAL(3,2) DEFAULT 1.0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commentator_active ON commentator_registry(active) WHERE active = true;
```

### 2. `backend-hono/src/services/headline-parser.ts`

Add speaker extraction to the parsing pipeline. After existing entity extraction:

```typescript
import { extractSpeaker } from '../commentator/speaker-extractor';

// Inside parseHeadline() function, after entity extraction:
const speakerInfo = extractSpeaker(headline);

// Add to ParsedHeadline return:
return {
  ...existing,
  speaker: speakerInfo.speaker,
  speakerInstitution: speakerInfo.institution,
  isOfficialStatement: speakerInfo.isOfficial,
};
```

**Also update the ParsedHeadline type** in `backend-hono/src/types/news-analysis.ts`:
```typescript
// Add to ParsedHeadline interface:
speaker?: string;
speakerInstitution?: string;
isOfficialStatement?: boolean;
```

### 3. `backend-hono/src/routes/index.ts`

Add commentator routes:
```typescript
import commentatorRoutes from './commentator';
app.route('/api/commentator', commentatorRoutes);
```

---

## Key Rules / Corrections

- **The registry will be EMPTY initially.** The user will populate it after reviewing historical FJ posts. The system must work with an empty registry (all speakers get UNTAGGED_MULTIPLIER = 0.8x).
- **Speaker extraction is heuristic, not AI.** Use regex/keyword patterns. No LLM calls for speaker ID.
- **The speaker field is ADDED to ParsedHeadline** but not yet USED by the scorer. T5 integrates it.
- **Fuzzy matching must handle aliases.** "Powell" should match an entry with aliases: ["Jerome Powell", "Powell", "Fed Chair Powell", "Chair Powell"].
- **Do NOT seed the registry with names.** TP explicitly said "we will break them down far before we implement." Build the pipes, not the data.

---

## Verification

```bash
# 1. TypeScript compiles
npx tsc --noEmit

# 2. Registry CRUD works
curl -X POST http://localhost:8080/api/commentator \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Official", "aliases": ["Test", "T. Official"], "tier": 2, "role": "Test", "institution": "Test Inst"}'

curl http://localhost:8080/api/commentator/registry
# Should return array with the test entry

# 3. Speaker identification works
curl -X POST http://localhost:8080/api/commentator/identify \
  -H "Content-Type: application/json" \
  -d '{"headline": "Fed Chair Powell says rates will remain higher for longer"}'
# Should return: { "speaker": "Powell", "institution": "Federal Reserve", "isOfficial": true, "tier": null, "multiplier": 0.8 }
# (tier null because registry is empty, multiplier = untagged default)
```

---

## Changelog Entry
```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: 'S2-T3: Commentator infrastructure — speaker extractor, tier registry service, CRUD routes, ParsedHeadline speaker field', files: ['backend-hono/src/services/commentator/commentator-service.ts', 'backend-hono/src/services/commentator/speaker-extractor.ts', 'backend-hono/src/routes/commentator/handlers.ts', 'backend-hono/src/services/headline-parser.ts', 'backend-hono/src/types/news-analysis.ts', 'backend-hono/src/services/supabase-service.ts'] }
```

---

## DO NOT

- Do NOT populate the commentator registry with real names (TP will do this later)
- Do NOT modify the IV scoring engine (T5 scope)
- Do NOT create frontend UI for commentator management (T6/T7 scope)
- Do NOT modify the regime system (T2 scope)
- Do NOT modify feed-service.ts or central-scorer.ts (T5 scope)
