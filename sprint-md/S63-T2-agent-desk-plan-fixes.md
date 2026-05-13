# Sprint Brief: T2 -- Agent Desk Plan Fixes + Lockout Tool

## Context

Fix agent capabilities for desk plan modification and wire lockout awareness into agent context. The 5 agents (Harper, Oracle, Feucht, Consul, Herald) claim they can modify desk plans but the mutation path goes through the unified approval pipeline without clear instructions. This track:

1. Adds a `lockout` tool to the capability registry so agents can read/modify lockout state based on desk plan analysis
2. Injects current lockout state into desk-context preflight so agents know what's locked
3. Fixes desk plan regeneration in the Harper handler to ensure all `DayPlan` fields populate correctly
4. Updates SOUL files to accurately reflect desk plan modification capabilities

## Branch Target

`sprint/S63` (single feature branch)

## Scope -- Included

- [ ] Add lockout-related tool(s) to capability registry (types + registry entries)
- [ ] Update desk-context preflight to inject lockout state alongside desk plan
- [ ] Audit Harper handler regeneration path: verify all DayPlan fields populated
- [ ] Update all 5 SOUL files with accurate desk plan tool descriptions
- [ ] Wire lockout aware flag into agent context for Feucht (risk manager) and Harper (CAO)

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/` -- no frontend changes in this track
- `electron/` -- T3 owns Electron changes
- `backend-hono/src/services/day-plan/day-plan-service.ts` -- core generation is correct, don't touch
- `backend-hono/src/routes/day-plan/handlers.ts` -- existing handlers work, don't touch
- `backend-hono/src/routes/lockout/` -- T1 creates this, don't touch handlers
- `backend-hono/src/services/cron/` -- cron schedules unchanged

## Reuse Inventory (existing code to call, not reinvent)

- `backend-hono/src/services/capability-registry/types.ts` -- add `LockoutTool` to the tool union
- `backend-hono/src/services/capability-registry/registry.ts` -- add lockout tool entries for Harper + Feucht
- `backend-hono/src/services/capability-registry/enforcer.ts` -- no changes needed unless tool routing changes
- `backend-hono/src/services/desk-context/preflight.ts` -- add lockout state block to the context injection (parallel to desk-context block)
- `backend-hono/src/services/harper-handler.ts` lines 389-578 -- audit the regenerate path, fix any missing DayPlan fields
- `backend-hono/src/services/ai/soul/harper.md` -- update desk plan tool description
- `backend-hono/src/services/ai/soul/feucht.md` -- update desk plan + add lockout tool description
- `backend-hono/src/services/ai/soul/oracle.md` -- update desk plan tool description
- `backend-hono/src/services/ai/soul/consul.md` -- update desk plan tool description
- `backend-hono/src/services/ai/soul/herald.md` -- update desk plan tool description

## Known Issues to Preserve

- SOUL fileroom was recently reworked (2026-05-07) — do not change SOUL file format or schema, only tool descriptions
- Capability registry was also recently reworked (S61-T2) — follow existing registry patterns exactly
- Desk context preflight injects into all 5 agents at respond time — maintain that architecture

## Implementation Steps

1. **Capability registry types** -- Open `backend-hono/src/services/capability-registry/types.ts`. Add `"lockout"` to tool name union. Add `LockoutToolSpec` interface with `{ action: "read" | "toggle" | "set_duration"; durationMinutes?: number }`.
2. **Capability registry entries** -- Open `backend-hono/src/services/capability-registry/registry.ts`. Add `lockout` to Harper's tools (optional, defaultDuration: 30). Add `lockout` to Feucht's tools (optional, defaultDuration: 60). Mark as requiring approval (goes through existing approval pipeline).
3. **Desk-context preflight** -- Open `backend-hono/src/services/desk-context/preflight.ts`. After fetching today's DayPlan, also fetch `/api/lockout/status` (or call the lockout service directly). Append a `<lockout-context>` block showing current state: locked/unlocked, remaining time. If locked, the agent context notes that trading actions are blocked.
4. **Harper handler audit** -- Open `backend-hono/src/services/harper-handler.ts`. Inspect the `regenerateDayPlan` call at lines ~400-408. Verify: (a) it passes `{ overrideReason }`, (b) the returned plan has all `DayPlanWindow` fields (entries, invalidation, profitTarget, pricesOfInterest), (c) the context rendered by `renderRegeneratedPlanContext()` includes all window details. Fix any missing field propagation.
5. **SOUL file updates** -- Open each SOUL file and update the "Desk Plans" capability to describe the actual mutation path: "Desk Plans: review current plan and request modifications via the unified approval pipeline. You cannot directly mutate day_plan tables. Use `requestDeskPlanChange(reason, suggestedLevels)` which routes through human-in-the-loop approval."

## Acceptance Criteria

- [ ] Capability registry has lockout tool defined with types
- [ ] Desk-context preflight injects lockout state into agent context
- [ ] Harper handler regeneration passes all DayPlan window fields correctly
- [ ] All 5 SOUL files accurately describe desk plan modification path
- [ ] Backend builds clean: `cd backend-hono && bun run build`
- [ ] No regressions in Harper CAO chat flow

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build
```

## Commit Format

```
[v.5.13.2] fix: T2 agent desk plan fixes + lockout tool wiring
```
