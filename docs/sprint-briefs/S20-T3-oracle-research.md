# Sprint Brief: T3 — Oracle Scheduled Research

## Context

Oracle is supposed to be the most research-heavy agent after Harper, but currently has zero autonomous research capability. This track builds Oracle's prediction market scanning cycle — a cron job that scans Kalshi/Polymarket while the user is offline, cross-references with the IV scoring engine and RiskFlow context, and stores findings for Harper review and Oracle's own deliberation prompts.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] New `backend-hono/src/services/oracle-research/scanner.ts` — prediction market scanning
- [ ] New `backend-hono/src/services/oracle-research/arb-detector.ts` — IV cross-reference for arb detection
- [ ] New `backend-hono/src/services/oracle-research/types.ts` — interfaces
- [ ] New `backend-hono/src/services/oracle-research/index.ts` — public API
- [ ] New `backend-hono/src/services/cron/oracle-research-scheduler.ts` — cron trigger
- [ ] New `supabase/migrations/20260416_oracle_research.sql` — `oracle_research_findings` table
- [ ] Update `backend-hono/src/boot/services.ts` — add Oracle research scheduler to boot sequence
- [ ] New API endpoint: `GET /api/oracle/research` — returns recent findings

## Scope — Excluded (DO NOT TOUCH)

- `base-prompts.ts`, `agent-instructions/dossiers/` (T1 owns)
- `miroshark-template.ts`, `miroshark-client.ts` (T2 owns)
- `agent-memory/` (T4 owns)
- `mobile/` files (T6/T7 own)

## Known Issues to Preserve

- Existing `polymarket-kalshi-divergence.ts` already detects price divergences between the two platforms at 15-minute intervals. Oracle research should consume these divergence alerts as input, not duplicate the detection.
- Existing `polymarket-prediction-resolver.ts` resolves prediction outcomes. Oracle research should reference resolved predictions for accuracy context.
- The IV scoring engine is at `iv-scoring-v2.ts` (1954 lines, will be refactored in T9). Use the public API, not internal functions.
- `boot/services.ts` is also modified by T4. Coordinate: T3 adds Oracle research scheduler, T4 adds outcome resolver. Both add lines to `bootServices()` — no conflict if each adds to the end.

## Implementation Steps

1. Read existing services to understand integration points:
   - `polymarket-kalshi-divergence.ts` — existing divergence detection
   - `polymarket-prediction-resolver.ts` — outcome resolution
   - `iv-scoring-v2.ts` — IV scoring engine (public functions only)
   - `riskflow/feed-service.ts` — scored items access
   - `strands/invoke-helper.ts` — agent invocation pattern
2. Create `oracle_research_findings` Supabase table:
   ```sql
   CREATE TABLE oracle_research_findings (
     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
     finding_type VARCHAR(50) NOT NULL, -- 'arb_opportunity', 'divergence_analysis', 'market_signal'
     platform VARCHAR(20), -- 'kalshi', 'polymarket', 'cross'
     contract_id VARCHAR(255),
     contract_title TEXT,
     current_price DECIMAL(5,4),
     iv_cross_score DECIMAL(4,2), -- IV scoring engine assessment
     riskflow_correlation TEXT, -- matching RiskFlow themes
     analysis TEXT NOT NULL, -- Oracle's assessment
     confidence DECIMAL(3,2),
     created_at TIMESTAMPTZ DEFAULT NOW(),
     expires_at TIMESTAMPTZ,
     status VARCHAR(20) DEFAULT 'active' -- 'active', 'resolved', 'expired'
   );
   ```
3. Build `scanner.ts`:
   - Query Polymarket + Kalshi APIs for active contracts
   - Filter by categories matching Oracle's subjects (macro, monetary-policy, prediction-markets, regime)
   - Identify contracts with significant volume or price movement
4. Build `arb-detector.ts`:
   - Cross-reference contract themes with scored RiskFlow items (same subject-tag matching from T2)
   - Compare market-implied probability vs IV-scoring-derived probability
   - Flag mismatches > 15% as arb opportunities
   - Use `invokeAgent()` with Oracle persona for analysis narrative
5. Build `cron/oracle-research-scheduler.ts`:
   - Configurable via `ORACLE_RESEARCH_ENABLED` env var (default: true)
   - Configurable interval via `ORACLE_RESEARCH_INTERVAL_MS` (default: 4 hours)
   - Only runs during extended market hours (6 AM - 8 PM ET, weekdays)
   - Stores findings to `oracle_research_findings` table
6. Add to `boot/services.ts` with env var gate
7. Add GET endpoint for Harper/frontend to query findings

## Acceptance Criteria

- [ ] Cron runs every 4 hours during market hours
- [ ] Scans both Polymarket and Kalshi active contracts
- [ ] Cross-references with IV scoring and RiskFlow themes
- [ ] Stores findings in `oracle_research_findings` table
- [ ] Each finding has: type, platform, analysis, confidence, IV cross-score
- [ ] API endpoint returns recent findings (last 24h)
- [ ] Gated by `ORACLE_RESEARCH_ENABLED` env var
- [ ] Does NOT duplicate existing divergence detection (consumes it as input)
- [ ] All new files under 300 lines

## Validation Commands

```bash
cd backend-hono && bun run build
# Manual: set ORACLE_RESEARCH_ENABLED=true, trigger manually via endpoint, check Supabase table
```
