# S2 — RiskFlow Regime-Aware Scoring Engine

## Context

The IV scoring system is regime-blind. A CPI miss scores the same whether we're in a geopolitical crisis (where econ data is background noise) or a monetary policy cycle (where CPI is everything). The EVENT_WEIGHTS are hardcoded guesses, not calibrated from observed price action. There's no commentator-level weighting — Powell's words score the same as a random Regional Fed President. The system has no memory of what matters right now.

This sprint builds: (1) a market regime classification system with 8 regimes, (2) commentator tier infrastructure, (3) historical calibration DB, (4) a Refinement Engine UI for live scoring adjustment, (5) developer settings overhaul with password gate, and (6) rewires the IV scorer to be regime-aware.

**Triggered by:** TP identifying that implied point values are wrong, noise vs signal separation is poor, and the system lacks historical context for scoring calibration.

---

## Architecture Overview

```
                    ┌─────────────────────────┐
                    │   REGIME STATE (Supabase)│
                    │   Current: BEAR_TREND    │
                    └──────────┬──────────────┘
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │                          │                          │
    ▼                          ▼                          ▼
┌─────────┐          ┌────────────────┐          ┌───────────────┐
│ MDB sets │          │ IV Scorer V3   │          │ Refinement UI │
│ regime   │──auto───▶│ reads regime   │◀──manual─│ overrides     │
│ at 7am   │          │ + commentator  │          │ weights/regime│
└─────────┘          │ + calibration  │          └───────────────┘
                     │ multipliers    │
                     └───────┬────────┘
                             │
                     ┌───────▼────────┐
                     │ Scored Items   │
                     │ with regime    │
                     │ context        │
                     └────────────────┘
```

---

## Regime System (8 Regimes)

| ID | Label | Scoring Behavior |
|----|-------|-----------------|
| `BULL_TREND` | Bull Trend | Bear news muted (0.5x), bull news normal (1.0x), geo = reversal risk (1.3x) |
| `BEAR_TREND` | Bear Trend | Bull news MASSIVE (3.0x squeeze), bear news continuation (1.0x), geo amplified (1.5x) |
| `CONSOLIDATION` | Consolidation | All news moderate (0.8x), breakout catalysts elevated (1.5x) |
| `GEO_TENSIONS` | Geopolitical Tensions Heightened | War/sanctions/tariffs DOMINANT (1.5x), econ data background (0.3x), de-escalation = massive bull (2.5x) |
| `MACRO_ECON` | Macro/Econ Driven | Fed/CPI/jobs DOMINANT (1.5x), everything else muted (0.5x) |
| `RISK_OFF` | Risk-Off Flight | Safe haven bid, equities sell on any excuse (bear 1.3x), recovery signals explosive (2.0x bull) |
| `EARNINGS_SEASON` | Earnings Season | Individual names drive index (earnings 1.5x), Mag7 = crisis-level (2.0x), macro muted (0.5x) |
| `ILLIQUID_STUPIDITY` | Illiquid Stupidity | Almost a liquidity crisis. Repo/funding DOMINANT (2.0x), everything correlates, Fed intervention = instant reversal (3.0x) |

**Detection:** Agent-detected via MDB + manual override in Refinement Engine.

---

## Commentator Tier System (3 Tiers)

| Tier | Multiplier | Example Figures | Notes |
|------|-----------|-----------------|-------|
| 1 — Market Movers | 1.5x | TBD (deliberating with TP) | Fed Chair, Treasury Sec, POTUS-level |
| 2 — Notable Officials | 1.2x | TBD | Fed Governors, key Cabinet, Timiraos |
| 3 — Color Providers | 1.0x | TBD | Regional Feds, analysts, strategists |
| Untagged | 0.8x | — | Unknown source, generic headline |

**Roster:** Infrastructure only this sprint. Names filled in after TP reviews 500 historical posts.

---

## New Supabase Tables

### `market_regimes`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
regime_type TEXT NOT NULL,        -- enum: BULL_TREND, BEAR_TREND, etc.
detected_by TEXT NOT NULL,        -- 'mdb_agent' | 'manual' | 'regime_detector'
confidence DECIMAL(3,2),          -- 0.00-1.00
notes TEXT,
active BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ DEFAULT now()
```

### `commentator_registry`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name TEXT NOT NULL,
aliases TEXT[],                   -- ["Jerome Powell", "Powell", "Fed Chair Powell"]
tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 3),
role TEXT,                        -- "Fed Chair", "Treasury Secretary"
institution TEXT,                 -- "Federal Reserve", "US Treasury"
weight_multiplier DECIMAL(3,2) DEFAULT 1.0,
active BOOLEAN DEFAULT true,
created_at TIMESTAMPTZ DEFAULT now()
```

### `scoring_calibration`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
event_type TEXT NOT NULL UNIQUE,
base_weight DECIMAL(4,2) NOT NULL,
regime_overrides JSONB,           -- {"BEAR_TREND": 1.5, "GEO_TENSIONS": 0.3, ...}
updated_at TIMESTAMPTZ DEFAULT now(),
updated_by TEXT DEFAULT 'system'
```

### `refinement_annotations`
```sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
riskflow_item_id TEXT NOT NULL,   -- references tweet_id
comment TEXT,
flaw_tag TEXT,                    -- 'overscored' | 'underscored' | 'wrong_type' | 'wrong_sentiment' | 'missing_context'
suggested_score DECIMAL(4,2),
created_at TIMESTAMPTZ DEFAULT now(),
created_by TEXT DEFAULT 'tp'
```

### `calibration_observations`
```sql
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
source TEXT,                      -- 'manual' | 'backfill' | 'live_correlation'
created_at TIMESTAMPTZ DEFAULT now()
```

---

## Tracks (7 tracks, 4 waves)

### Wave 1 — Sequential (runs first)
| Track | Scope | Files |
|-------|-------|-------|
| **T1: Foundation + Sanctum** | Types, schemas, config v3, Auditorium→Sanctum rename | ~30 files (22 rename + 5 new type files + config) |

### Wave 2 — Parallel (after T1)
| Track | Scope | Files |
|-------|-------|-------|
| **T2: Regime Engine** | Regime service, detector, MDB integration, CRUD routes | ~6 new + 2 modified |
| **T3: Commentator Infra** | Speaker extractor, tier service, CRUD routes | ~5 new + 2 modified |
| **T4: Calibration DB** | Calibration service, bulk parser, upload context, observations | ~5 new + 2 modified |

### Wave 3 — After Wave 2
| Track | Scope | Files |
|-------|-------|-------|
| **T5: IV Scorer V3** | Regime multipliers in scoring, re-score endpoint, dynamic weights | ~3 modified + 1 new |
| **T6: Developer Settings** | Password gate, RiskFlow subsection, weight sliders, toggles | ~3 new + 1 modified |

### Wave 4 — After Wave 3
| Track | Scope | Files |
|-------|-------|-------|
| **T7: Refinement Engine** | Own sidebar tab, item annotation, regime control, re-score trigger | ~6 new + 3 modified |

---

## Shared File Conflicts (Unification Notes)

| File | Tracks | Resolution |
|------|--------|-----------|
| `backend-hono/src/services/supabase-service.ts` | T2, T3, T4 | Each adds new functions (additive). Merge all. |
| `backend-hono/src/routes/index.ts` | T2, T3, T4 | Each adds route imports. Merge all. |
| `frontend/components/layout/NavSidebar.tsx` | T1 (if needed), T7 | T7 adds refinement icon. |
| `frontend/components/layout/MainLayout.tsx` | T7 | T7 wires refinement view. |

---

## Git Strategy

- **Branch:** `v.8.25.4` (from current `v.8.25.3`)
- **Commit per track:** `[v.8.25.4] feat(riskflow): T{n} — {description}`
- **Merge target:** Current branch, then to `main` via PR

---

## Verification Checklist

- [ ] `npx tsc --noEmit` — zero errors
- [ ] `bun run build` — clean build
- [ ] All "Auditorium" references gone (grep returns 0)
- [ ] Developer Settings requires password "Pricedin,./"
- [ ] Regime CRUD: `curl POST /api/regime/set` works
- [ ] Commentator CRUD: `curl POST /api/commentator` works
- [ ] Re-score endpoint: `curl POST /api/riskflow/rescore` re-processes current feed
- [ ] Refinement Engine tab visible when toggled in Developer Settings
- [ ] Upload Context button visible in Sanctum header next to MiroFish Update
- [ ] Weight sliders in Developer Settings save to calibration table
