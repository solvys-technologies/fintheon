# S48 — News Feed Pipeline Control + Econ Calendar + Kalshi + CountdownFuse

## Orchestration Plan

**4 parallel tracks + 1 unification. Zero file conflicts across tracks.** Branch from `main` at `23129632` (`v5.34.0`).

### Wave 1 — All 4 tracks run in parallel

| Track | Title                                               | Surface  | Files | Est. LOC |
| ----- | --------------------------------------------------- | -------- | ----- | -------- |
| T1    | Econ Pipeline Fix + Backfill + Data Layer           | Backend  | 20    | ~500     |
| T2    | Kalshi Whale Tracker + Wire Filters + Treasury + UW | Backend  | 8     | ~350     |
| T3    | Pipeline UI + CountdownFuse + Econ Filter Editor    | Frontend | 10    | ~500     |
| T4    | Layout Fixes + S47 Deferred UI                      | Frontend | 9     | ~350     |

### Wave 2 — Unification

| Track | Title                    | Files | Est. LOC |
| ----- | ------------------------ | ----- | -------- |
| T5    | Unification + Validation | 4     | ~150     |

### Conflict Prevention

- **`content-guard.ts`**: T1 owns it (market relevance fix). T2 writes `speculation-filter.ts` as a standalone module with its own export. T5 wires the import into `content-guard.ts` during unification.
- **`RefinementEngine.tsx`**: T3 owns it (NotchedFuse removal, PipelineHealth, PipelineToggles). T4 does not touch it.
- **`MainLayout.tsx`**: T4 owns it (app frame border, strategium drawer).
- **No other file collisions across any tracks.**

### Shared Reuse Inventory (all tracks reference these)

| Item                                 | Path                                                          | Use                                                                                                |
| ------------------------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `NothingFuse`                        | `frontend/components/shared/NothingFuse.tsx`                  | T3: CountdownFuse wraps this. T1/T2: do not modify.                                                |
| `colorForSeverity` / `colorForScore` | `frontend/lib/fuse-palette.ts`                                | T3: theme colors for beat/miss states. Read-only.                                                  |
| `CSS tokens`                         | `frontend/index.css:46-56`                                    | T3/T4: `--fintheon-accent`, `--fintheon-bullish`, `--fintheon-bearish`, `--fintheon-glass-border`. |
| `CatalystStatsDrawer`                | `frontend/components/refinement/CatalystStatsDrawer.tsx`      | T3: add web URL source section. T4: do not touch.                                                  |
| `kalshi-service.ts`                  | `backend-hono/src/services/kalshi-service.ts`                 | T2: add Econ+Politics filter, RiskFlow pipe. T1: do not touch.                                     |
| `headline-parser.ts`                 | `backend-hono/src/services/headline-parser.ts`                | T1: use `parseEconData()` for FJ backfill parsing.                                                 |
| `rettiwt-poller-econ.ts`             | `backend-hono/src/services/riskflow/rettiwt-poller-econ.ts`   | T1: FJ tweet matching for backfill.                                                                |
| `unusual-whales.ts`                  | `backend-hono/src/services/market-data/unusual-whales.ts`     | T2: already integrated. Update agent prompts only.                                                 |
| `user-polling-registry.ts`           | `backend-hono/src/services/riskflow/user-polling-registry.ts` | T1: add `cookieRefreshedAt` field, round-robin rotation.                                           |

### Non-Regression Gates (must NOT break)

- CAO chat must keep streaming + conversation history
- RiskFlow feed must keep approved X/wire items
- MDB/ADB/PMDB/TWT brief routes must survive
- Supabase JWT + super-admin gates must not be bypassed
- Desktop install/update flow untouched
- No OpenRouter, FMP, MSM, or Exa reintroduction
- No emojis, gradients, Kanban borders, or AI-sparkle ornamentation

### After All Waves Complete

1. Run full validation suite (T5)
2. Add changelog entry to `src/lib/changelog.ts`
3. Apply migration to Supabase
4. Restart local backend
5. Smoke: `/api/diagnostics`, `/api/admin/pipelines`, `/api/admin/pipeline-stats`

### Commit Format

```
[v5.35.0] feat: S48 pipeline control + econ fix + Kalshi whale tracker + CountdownFuse
```
