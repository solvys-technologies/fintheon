# Claude Code Routines — Fintheon

Cloud-based autonomous agents running on Anthropic infrastructure via `/schedule` triggers.
Budget: **13 runs/day** (ceiling: 15/day on Pro+ research preview).

## MOVE Routines (migrated from backend)

| #   | Name                             | Trigger ID                      | Schedule (UTC)                      | Runs/Day | Backend Flag                           |
| --- | -------------------------------- | ------------------------------- | ----------------------------------- | -------- | -------------------------------------- |
| 1   | REFLECT Nightly Quality Analysis | `trig_01ND9msD2oyniTwgYMtqBMQB` | `3 4 * * *` (04:03 UTC daily)       | 1        | `REFLECT_VIA_ROUTINE=true`             |
| 2   | Prediction Resolver              | `trig_01QxEtsTB7exE9hZpmdEni3S` | `17 3,9,15,21 * * *` (4x daily)     | 4        | `PREDICTION_RESOLVER_VIA_ROUTINE=true` |
| 3   | Market Impact Enricher           | `trig_01UmqPKoqYmUQjHpZygWa4yg` | `3 22 * * 1-5` (22:03 UTC weekdays) | 1        | `MARKET_IMPACT_VIA_ROUTINE=true`       |

### Activation

Set the corresponding env flag on the backend to disable the local scheduler:

```bash
# In backend .env or Fly.io secrets
REFLECT_VIA_ROUTINE=true
PREDICTION_RESOLVER_VIA_ROUTINE=true
MARKET_IMPACT_VIA_ROUTINE=true
```

The backend scheduler checks these flags at startup. When `true`, the backend cron is skipped and the Routine handles execution.

## AUGMENT Routines (monitor/enrich existing)

| #   | Name                            | Trigger ID                      | Schedule (UTC)   | Local Time (ET)      | Runs/Day |
| --- | ------------------------------- | ------------------------------- | ---------------- | -------------------- | -------- |
| 4   | Dispatch Watchdog               | `trig_01TbyLqsb3MEFXngNcf9DGqA` | `3 11 * * 1-5`   | 7:03 AM ET weekdays  | 1        |
| 5   | Boardroom Synthesis             | `trig_012vcEGvYY4cdHSK2yMKp2wk` | `3 14 * * 1-5`   | 10:03 AM ET weekdays | 1        |
| 6   | MiroShark Meta                  | `trig_01UkDCRytVP42cd7C6tUzon1` | `17 15 * * 1-5`  | 11:17 AM ET weekdays | 1        |
| 7   | Poly/Kalshi Divergence Analysis | `trig_01LBtc1yHL8gEv4ofh4UP2eH` | `17 13,21 * * *` | 9:17 AM + 5:17 PM ET | 2        |
| 8   | Aquarium Deep Outlook           | `trig_01MgCTN6ALWt4Jr4eZkqimWi` | `33 12,20 * * *` | 8:33 AM + 4:33 PM ET | 2        |

**Total: 13 runs/day** (2 buffer within 15-run ceiling)

## Routine Details

### 1. REFLECT Nightly Quality Analysis

- **Replaces**: `startReflectScheduler()` in backend
- **What**: Analyzes 7 days of scoring observations across 5 metrics (direction accuracy, score calibration, scoring bias, macro level accuracy, tag coverage)
- **Output**: Writes to `reflect_reports` table in Supabase. Summary feeds into Harper's morning standup via `buildReflectContext()`
- **MCP**: Supabase (for DB writes)

### 2. Prediction Resolver

- **Replaces**: `startPredictionResolver()` in backend
- **What**: Checks pending Polymarket predictions against live market prices. Resolves markets where `yesPrice >= 0.95` (YES) or `<= 0.05` (NO)
- **Output**: Updates `polymarket_predictions` table (resolved, actual_outcome, result, resolved_at)
- **MCP**: Supabase (for DB updates)

### 3. Market Impact Enricher

- **Replaces**: `startMarketImpactEnricher()` in backend
- **What**: Finds scored RiskFlow items with `macro_level >= 3` older than 24h, enriches with /NQ /ES /YM daily close impact data
- **Output**: Updates `scored_riskflow_items.market_impact` JSONB column
- **MCP**: Supabase (for DB updates)

### 4. Dispatch Watchdog

- **Monitors**: `startDispatchScheduler()` MDB generation
- **What**: At 7 AM ET, verifies today's MDB was generated. If missing, triggers regeneration via `POST /api/data/brief/generate`. Checks service health via `/api/diagnostics`
- **Output**: Status report (MDB_OK / MDB_REGENERATED / MDB_FAILED)

### 5. Boardroom Synthesis

- **Monitors**: `startBoardroomScheduler()` standup rounds
- **What**: At 10 AM ET (after all 5 standup rounds complete), synthesizes key takeaways into a digest with regime read, themes, risk flags, agent consensus, and action items
- **Output**: Writes to `consolidated_briefs` table

### 6. MiroShark Meta

- **Monitors**: `startMiroSharkDaily()` and `startAquariumScheduler()`
- **What**: Daily health check on MiroShark simulations. Detects stale predictions, agent convergence/groupthink risk, prediction drift, and outlier signals
- **Output**: Report with convergence score and freshness status

### 7. Poly/Kalshi Divergence Analysis

- **Monitors**: `startDivergenceDetector()` (15-min polling)
- **What**: 2x/day deep analysis on persistent prediction market divergences (>= 10%). Investigates root causes (liquidity, jurisdiction, timing lag) and actionable signals
- **Output**: Structured report with top 3 divergence deep dives

### 8. Aquarium Deep Outlook

- **Monitors**: Aquarium AI scheduler + Context Bank
- **What**: 2x/day full Context Bank synthesis + calibration preview. Compares predicted vs actual instrument movement, generates calibration score and 24h forward outlook
- **Output**: Writes to `desk_reports` table (desk='aquarium-deep')

## Infrastructure

- **Environment**: Default (Anthropic Cloud)
- **Model**: claude-sonnet-4-6
- **Repo**: https://github.com/solvys-technologies/fintheon
- **MCP**: All routines have Supabase MCP connector attached
- **API Base**: https://fintheon.fly.dev (all routines call this for data)

## Management

```bash
# List all routines (via Claude Code /schedule skill)
/schedule list

# Run a routine manually
/schedule run <trigger_id>

# Disable a routine
/schedule update <trigger_id> --disable

# View/manage in browser
# https://claude.ai/code/scheduled/<trigger_id>
```
