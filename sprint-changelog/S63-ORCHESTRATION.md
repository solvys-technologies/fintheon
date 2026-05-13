# S63-ORCHESTRATION -- Dock & Lockout Suite

**Version stamp:** `v.5.13.2-TP`

**Owner:** TP (solo, single feature branch `sprint/S63`)

**Previous S63 ORCH files:** S63-ORCH-theme-intelligence-phase-1/2/3 (separate sprints)

## Wave Sequence

### Wave 1 (parallel -- no file overlap)

T1 + T2 run in parallel. T1 owns frontend + backend lockout routes. T2 owns capability registry + agent instructions + desk-context preflight + SOUL files. Zero file overlap.

```
@sprint-md/S63-T1-lockout-button-trading-controls.md
```

```
@sprint-md/S63-T2-agent-desk-plan-fixes.md
```

### Wave 2 (after T1)

T3 depends on T1's lockout API. Must wait for T1 to ship the lockout endpoint and TradingTab lockout controls.

```
@sprint-md/S63-T3-dock-integration.md
```

### Unification Pass

Since TP is solo on a single branch, no actual merge step is needed. After all tracks are complete:

1. Run full validation suite
2. Add changelog entry to `src/lib/changelog.ts`
3. Run `/install-maintenance` to audit for env var drift

## Track Dependency Graph

```
T1 ──┬──> T3
     │
T2 ──┘ (no dependency on T1, no file overlap)
```

## File Ownership Map

| File                                                        | Owner                  |
| ----------------------------------------------------------- | ---------------------- |
| `frontend/components/layout/TopHeader.tsx`                  | T1                     |
| `frontend/components/settings/TradingTab.tsx`               | T1 (+ T3 quick access) |
| `frontend/hooks/useLockout.ts` (new)                        | T1                     |
| `backend-hono/src/routes/lockout/index.ts` (new)            | T1                     |
| `backend-hono/src/routes/index.ts`                          | T1                     |
| `backend-hono/src/types/lockout.ts` (new)                   | T1                     |
| `backend-hono/src/services/capability-registry/types.ts`    | T2                     |
| `backend-hono/src/services/capability-registry/registry.ts` | T2                     |
| `backend-hono/src/services/desk-context/preflight.ts`       | T2                     |
| `backend-hono/src/services/harper-handler.ts`               | T2                     |
| `backend-hono/src/services/ai/soul/*.md`                    | T2                     |
| `electron/dock-menu.cjs` (new)                              | T3                     |
| `electron/main.cjs`                                         | T3                     |
| `electron/preload.cjs`                                      | T3                     |
| `frontend/contexts/SettingsContext.tsx`                     | T1 + T3                |

**Shared file `SettingsContext.tsx`:** T1 adds `lockoutDefaultDuration`. T3 adds `quickAccessUrl`. Add both fields in sequence (T1 first, T3 second) to avoid merge conflicts.
