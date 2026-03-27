# S2-T1: Foundation + Sanctum Rename

**Sprint:** S2 — RiskFlow Regime-Aware Scoring Engine
**Track:** T1 (Wave 1 — runs first, all other tracks depend on this)
**Estimated files:** ~30 (22 renames + 5 new type files + 2 configs)

---

## Objective

Create all shared types, Supabase table schemas, configuration files, and rename every "Auditorium" reference to "Sanctum" across the codebase. This track provides the type foundation that every other track codes against.

---

## Files to Read First

- `backend-hono/src/types/riskflow.ts` — existing FeedItem, SubScoreBreakdown types
- `backend-hono/src/types/news-analysis.ts` — ParsedHeadline, IVScoreResult
- `backend-hono/src/types/volatility-taxonomy.ts` — VolatilityProfile, VixRegime
- `backend-hono/src/config/scoring-weights.json` — current event weights (v2.0)
- `backend-hono/src/config/volatility-taxonomy.json` — event profiles with decay regime multipliers
- `backend-hono/src/services/supabase-service.ts` — existing table interfaces
- `frontend/components/layout/NavSidebar.tsx` — NavTab type union
- `frontend/lib/layoutOrderStorage.ts` — NavTabId type

---

## Files to Create

### 1. `backend-hono/src/types/regime.ts` (NEW, ~80 lines)
```typescript
export const MARKET_REGIMES = [
  'BULL_TREND',
  'BEAR_TREND',
  'CONSOLIDATION',
  'GEO_TENSIONS',
  'MACRO_ECON',
  'RISK_OFF',
  'EARNINGS_SEASON',
  'ILLIQUID_STUPIDITY',
] as const;

export type MarketRegime = typeof MARKET_REGIMES[number];

export interface RegimeState {
  id: string;
  regime: MarketRegime;
  detectedBy: 'mdb_agent' | 'manual' | 'regime_detector';
  confidence: number;        // 0-1
  notes?: string;
  active: boolean;
  createdAt: string;
}

// Regime multiplier matrix: for each regime, how does each sentiment direction scale?
export interface RegimeMultiplierProfile {
  regime: MarketRegime;
  label: string;
  description: string;
  sentimentMultipliers: {
    bullish: number;    // e.g., 3.0 in BEAR_TREND (squeeze potential)
    bearish: number;    // e.g., 0.5 in BULL_TREND (dip-buy, muted)
    neutral: number;    // usually 1.0
  };
  eventTypeOverrides: Record<string, number>;  // event_type → multiplier override
}

export const DEFAULT_REGIME_MULTIPLIERS: Record<MarketRegime, RegimeMultiplierProfile> = {
  BULL_TREND: {
    regime: 'BULL_TREND', label: 'Bull Trend',
    description: 'Bear news muted, bull news normal, geo = reversal threat',
    sentimentMultipliers: { bullish: 1.0, bearish: 0.5, neutral: 0.8 },
    eventTypeOverrides: { geopolitical: 1.3, conflict: 1.3 },
  },
  BEAR_TREND: {
    regime: 'BEAR_TREND', label: 'Bear Trend',
    description: 'Bull news = MASSIVE squeeze potential, bear news continuation',
    sentimentMultipliers: { bullish: 3.0, bearish: 1.0, neutral: 0.8 },
    eventTypeOverrides: { geopolitical: 1.5, conflict: 1.5 },
  },
  CONSOLIDATION: {
    regime: 'CONSOLIDATION', label: 'Consolidation',
    description: 'All news moderate, breakout catalysts elevated',
    sentimentMultipliers: { bullish: 0.8, bearish: 0.8, neutral: 0.7 },
    eventTypeOverrides: { technicalBreak: 1.5 },
  },
  GEO_TENSIONS: {
    regime: 'GEO_TENSIONS', label: 'Geopolitical Tensions Heightened',
    description: 'War/sanctions/tariffs DOMINANT, econ data background noise',
    sentimentMultipliers: { bullish: 2.5, bearish: 1.5, neutral: 1.0 },
    eventTypeOverrides: {
      geopolitical: 1.5, tariffs: 1.5, conflict: 1.5, chinaTrade: 1.5,
      cpiPrint: 0.3, ppiPrint: 0.3, nfpPrint: 0.3, gdpPrint: 0.3, jobless: 0.3,
    },
  },
  MACRO_ECON: {
    regime: 'MACRO_ECON', label: 'Macro/Econ Driven',
    description: 'Fed/CPI/jobs DOMINANT, everything else muted',
    sentimentMultipliers: { bullish: 1.2, bearish: 1.2, neutral: 1.0 },
    eventTypeOverrides: {
      fedDecision: 1.5, fomc: 1.5, powellSpeak: 1.5, cpiPrint: 1.5, nfpPrint: 1.5,
      pcePrint: 1.3, ppiPrint: 1.3, gdpPrint: 1.3, jolts: 1.2,
      geopolitical: 0.5, tariffs: 0.5, conflict: 0.5,
    },
  },
  RISK_OFF: {
    regime: 'RISK_OFF', label: 'Risk-Off Flight',
    description: 'Safe haven bid, equities sell on any excuse, recovery signals explosive',
    sentimentMultipliers: { bullish: 2.0, bearish: 1.3, neutral: 0.9 },
    eventTypeOverrides: { liquidityStress: 1.5, bankStress: 1.5, creditSpreadWidening: 1.5 },
  },
  EARNINGS_SEASON: {
    regime: 'EARNINGS_SEASON', label: 'Earnings Season',
    description: 'Individual names drive index, Mag7 = crisis-level, macro muted',
    sentimentMultipliers: { bullish: 1.0, bearish: 1.0, neutral: 0.8 },
    eventTypeOverrides: {
      earningsHighImpact: 2.0, earningsMidCap: 1.5, earnings: 1.5,
      cpiPrint: 0.5, nfpPrint: 0.5, fedDecision: 0.7,
    },
  },
  ILLIQUID_STUPIDITY: {
    regime: 'ILLIQUID_STUPIDITY', label: 'Illiquid Stupidity',
    description: 'Almost a liquidity crisis. Repo/funding DOMINANT, everything correlates, Fed intervention = instant reversal',
    sentimentMultipliers: { bullish: 3.0, bearish: 2.0, neutral: 1.0 },
    eventTypeOverrides: {
      liquidityStress: 2.0, bankStress: 2.0, creditSpreadWidening: 1.8,
      fedDecision: 3.0, fomc: 2.5, powellSpeak: 2.5,
    },
  },
};
```

### 2. `backend-hono/src/types/commentator.ts` (NEW, ~40 lines)
```typescript
export const COMMENTATOR_TIERS = [1, 2, 3] as const;
export type CommentatorTier = typeof COMMENTATOR_TIERS[number];

export interface CommentatorEntry {
  id: string;
  name: string;
  aliases: string[];        // ["Jerome Powell", "Powell", "Fed Chair Powell"]
  tier: CommentatorTier;
  role?: string;            // "Fed Chair", "Treasury Secretary"
  institution?: string;     // "Federal Reserve", "US Treasury"
  weightMultiplier: number; // Tier 1 = 1.5, Tier 2 = 1.2, Tier 3 = 1.0
  active: boolean;
  createdAt: string;
}

export const TIER_DEFAULT_MULTIPLIERS: Record<CommentatorTier, number> = {
  1: 1.5,   // Market Movers — Fed Chair, Treasury Sec, POTUS
  2: 1.2,   // Notable Officials — Governors, key Cabinet, Timiraos
  3: 1.0,   // Color Providers — Regional Feds, analysts
};

export const UNTAGGED_MULTIPLIER = 0.8;
```

### 3. `backend-hono/src/types/calibration.ts` (NEW, ~50 lines)
```typescript
import type { MarketRegime } from './regime';

export interface CalibrationEntry {
  id: string;
  eventType: string;
  baseWeight: number;
  regimeOverrides: Partial<Record<MarketRegime, number>>;
  updatedAt: string;
  updatedBy: string;
}

export interface RefinementAnnotation {
  id: string;
  riskflowItemId: string;     // tweet_id reference
  comment?: string;
  flawTag?: FlawTag;
  suggestedScore?: number;
  createdAt: string;
  createdBy: string;
}

export type FlawTag =
  | 'overscored'
  | 'underscored'
  | 'wrong_type'
  | 'wrong_sentiment'
  | 'missing_context'
  | 'commentator_misweight'
  | 'regime_mismatch';

export interface CalibrationObservation {
  id: string;
  headline: string;
  eventType?: string;
  predictedIVScore?: number;
  actualPointsMove?: number;
  instrument: string;
  regimeAtTime?: MarketRegime;
  vixAtTime?: number;
  observedAt?: string;
  notes?: string;
  source: 'manual' | 'backfill' | 'live_correlation';
  createdAt: string;
}
```

### 4. `backend-hono/src/config/regime-multipliers.json` (NEW, ~20 lines)
```json
{
  "_note": "Regime multiplier defaults. Overridable via Refinement Engine UI.",
  "version": "1.0.0",
  "defaultRegime": "CONSOLIDATION",
  "tierMultipliers": {
    "1": 1.5,
    "2": 1.2,
    "3": 1.0,
    "untagged": 0.8
  }
}
```

### 5. `frontend/types/regime.ts` (NEW, ~20 lines)
Frontend-compatible version of the regime types. Re-export the regime enum and labels for UI components.
```typescript
export const MARKET_REGIMES = [
  'BULL_TREND', 'BEAR_TREND', 'CONSOLIDATION', 'GEO_TENSIONS',
  'MACRO_ECON', 'RISK_OFF', 'EARNINGS_SEASON', 'ILLIQUID_STUPIDITY',
] as const;

export type MarketRegime = typeof MARKET_REGIMES[number];

export const REGIME_LABELS: Record<MarketRegime, string> = {
  BULL_TREND: 'Bull Trend',
  BEAR_TREND: 'Bear Trend',
  CONSOLIDATION: 'Consolidation',
  GEO_TENSIONS: 'Geo Tensions Heightened',
  MACRO_ECON: 'Macro/Econ Driven',
  RISK_OFF: 'Risk-Off Flight',
  EARNINGS_SEASON: 'Earnings Season',
  ILLIQUID_STUPIDITY: 'Illiquid Stupidity',
};
```

---

## Files to Modify

### Auditorium → Sanctum Rename (22 files)

**Strategy:** Find-and-replace across all files. Rename component files AND update all imports/references.

**File renames:**
- `frontend/components/narrative/Auditorium.tsx` → `Sanctum.tsx`
- `frontend/components/narrative/AuditoriumHeader.tsx` → `SanctumHeader.tsx`
- `frontend/components/narrative/AuditoriumEconIntel.tsx` → `SanctumEconIntel.tsx`
- `frontend/components/narrative/AuditoriumChart.tsx` → `SanctumChart.tsx`
- `frontend/components/narrative/AuditoriumPresets.tsx` → `SanctumPresets.tsx`
- `frontend/components/narrative/AuditoriumBriefing.tsx` → `SanctumBriefing.tsx`
- `frontend/components/narrative/AuditoriumRiskAssessment.tsx` → `SanctumRiskAssessment.tsx`
- `frontend/components/narrative/AuditoriumTheses.tsx` → `SanctumTheses.tsx`
- `frontend/components/narrative/AuditoriumNarratives.tsx` → `SanctumNarratives.tsx`
- `frontend/components/narrative/AuditoriumKanban.tsx` → `SanctumKanban.tsx`
- `frontend/components/narrative/AuditoriumMacroStrip.tsx` → `SanctumMacroStrip.tsx`

**Import/reference updates (keep old files deleted):**
- `frontend/components/narrative/NarrativeFlow.tsx` — update Auditorium imports
- `frontend/components/narrative/NarrativeToolbar.tsx` — update references
- `frontend/components/consilium/ConsiliumHub.tsx` — update Auditorium reference
- `frontend/components/SettingsPanel.tsx` — update MiroFish references if any
- `frontend/types/mirofish.ts` — update AuditoriumPreset type name → SanctumPreset
- `src/lib/changelog.ts` — leave existing entries, add new entry
- `video/src/FintheonDemo.tsx` — update if referenced
- `video/src/scenes/S2_HeroShot.tsx` — update if referenced

**Rules:**
- Component names: `Auditorium` → `Sanctum` (PascalCase)
- Type names: `AuditoriumPreset` → `SanctumPreset`, etc.
- String labels: `"Auditorium"` → `"Sanctum"` (display text)
- Comments: update for clarity
- File paths in imports: update to match new file names

### Update Type Unions

- `frontend/lib/layoutOrderStorage.ts` — if NavTabId needs update for future tracks (T7 adds 'refinement')
- `frontend/components/layout/NavSidebar.tsx` — if NavTab type needs prep (T7 adds the actual entry)

---

## Key Rules / Corrections

- **Do NOT modify scoring logic.** This track is types + config + rename ONLY.
- **Do NOT add new routes.** T2/T3/T4 handle their own routes.
- **Do NOT touch iv-scorer.ts or iv-scoring-v2.ts.** T5 handles the rewire.
- **Preserve all existing Auditorium functionality** — only rename, don't restructure.
- **AuditoriumPreset type** in `frontend/types/mirofish.ts` becomes `SanctumPreset`. Export both names temporarily if needed for compat, but prefer clean rename.

---

## Verification

```bash
# 1. Zero "Auditorium" references remaining (excluding git history, node_modules, changelog entries)
grep -r "Auditorium" frontend/ backend-hono/src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v changelog

# 2. TypeScript compiles clean
cd /Users/tifos/Documents/Codebases/fintheon && npx tsc --noEmit

# 3. Build passes
cd /Users/tifos/Documents/Codebases/fintheon && bun run build

# 4. New type files importable
# Verify: import { MarketRegime } from '../types/regime' resolves
# Verify: import { CommentatorEntry } from '../types/commentator' resolves
# Verify: import { CalibrationEntry } from '../types/calibration' resolves
```

---

## Changelog Entry

```typescript
{ date: '2026-03-26T...', agent: 'claude-code', summary: 'S2-T1: Foundation types (regime, commentator, calibration) + Auditorium→Sanctum rename across 22 files', files: ['backend-hono/src/types/regime.ts', 'backend-hono/src/types/commentator.ts', 'backend-hono/src/types/calibration.ts', 'frontend/types/regime.ts', '...22 renamed Auditorium→Sanctum files'] }
```

---

## DO NOT

- Do NOT create any backend services or routes (T2/T3/T4 scope)
- Do NOT modify the scoring engine (T5 scope)
- Do NOT add UI components (T6/T7 scope)
- Do NOT add sidebar navigation entries (T7 scope)
- Do NOT create Supabase tables (T2/T3/T4 create their own table functions)
- Do NOT delete the Auditorium files — rename them (git mv or create new + delete old)
