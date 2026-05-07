# S61-ORCHESTRATION: Unified Agent Governance + Tooling Orchestration

## Intent

When S61 ships, every agent mutation across Fintheon flows through one pipeline: **draft → diff preview → user approval → persist → audit → reload context**. Harper selects specialists based on a runtime-enforced capability registry (not static text blocks). All 5 agents receive desk context preflight before external tool use. MCP tool routing follows deterministic selection order with standardized failure telemetry. An `agent_audit_log` table (Supabase + local JSONL fallback) records every decision.

## Branch

`sprint/S61` (shared -- orchestration + all tracks commit here)

## Scope -- Included

- [ ] T1: Shared mutation contract + audit logger (backend: 6 files)
- [ ] T2: Capability registry runtime + agent tool wiring (backend: 11 files)
- [ ] T3: Agent context preflight for all 5 agents (backend: 4 files)
- [ ] T4: Frontend approval UI (new components only: 5 files)

## Scope -- Excluded

- Arbitrum engine modifications
- RiskFlow pipeline changes
- Brief generation (MDB/ADB/PMDB/TWT)
- Sanctum/NarrativeFlow mutations (future track)
- Mobile PWA UI changes (CAO chat path is read-only)
- Electron shell changes
- Plane S60 integration modifications

## Known Issues to Preserve

- Harper chat tool approvals via `withApprovalGate()` in `harper-tools.ts`
- All 8 breakage surfaces: CAO chat, RiskFlow feed, briefs, Sanctum, mobile PWA, desktop install, Supabase RLS, Plane integration
- All 5 SOUL.md `native_home` identity blocks (S59-T2)
- Frontend existing components: ToolApprovalCard, ApprovalModal, ApprovalsPage (untouched)
- `tool-approval-store.ts` signatures: `requestApproval()` and `resolveApproval()` unchanged

## Track Definitions

### T1: Shared Mutation Contract + Audit Logger

| Attribute | Value |
|-----------|-------|
| **Files** | 6 (all backend) |
| **Complexity** | High |
| **Dependencies** | None (foundation) |
| **Owner** | T1 agent |

**Owns:** `supabase/migrations/20260507_s61_agent_audit_log.sql`, `backend-hono/src/types/audit.ts`, `backend-hono/src/services/audit-logger.ts`, `backend-hono/src/services/tool-approval-store.ts` (edit), `backend-hono/src/routes/audit/index.ts`, `backend-hono/src/routes/index.ts` (edit)

**Delivers:** `agent_audit_log` table with RLS, audit-logger service with Supabase + JSONL fallback, GET /api/audit/log endpoint, audit hooks in existing approval flow.

### T2: Capability Registry + Agent Tool Wiring

| Attribute | Value |
|-----------|-------|
| **Files** | 11 (all backend) |
| **Complexity** | High |
| **Dependencies** | Waits for T1 |
| **Owner** | T2 agent |

**Owns:** `backend-hono/src/services/capability-registry/types.ts`, `registry.ts`, `enforcer.ts`, `backend-hono/src/services/ai/agent-instructions/index.ts` (edit), `backend-hono/src/services/ai/soul/*.md` (5 edits), `backend-hono/src/services/strands/agent-factory.ts` (edit), `backend-hono/src/services/strands/agents/{oracle,feucht,consul,herald}.ts` (4 edits)

**Delivers:** Runtime-enforced capability registry, sub-agents with actual tool sets wired, prohibited tool blocking, registry-resolved cross-agent prompt block.

### T3: Agent Context Preflight

| Attribute | Value |
|-----------|-------|
| **Files** | 4 (all backend) |
| **Complexity** | Medium |
| **Dependencies** | Waits for T1 |
| **Owner** | T3 agent |

**Owns:** `backend-hono/src/services/desk-context/preflight.ts`, `agent-outputs.ts`, `backend-hono/src/services/hermes/context-engine.ts` (edit), `backend-hono/src/services/harper-handler.ts` (edit)

**Delivers:** Desk context preflight for all 5 agents, agent-specific context injection, graceful degradation on DB failure.

### T4: Frontend Approval UI (New Components Only)

| Attribute | Value |
|-----------|-------|
| **Files** | 5 (all new frontend) |
| **Complexity** | Medium |
| **Dependencies** | Waits for T1 |
| **Owner** | T4 agent |

**Owns:** `frontend/components/governance/UnifiedApprovalPipeline.tsx`, `DiffPreview.tsx`, `AuditTrailViewer.tsx`, `frontend/hooks/useAuditLog.ts`, `useUnifiedApproval.ts` (all NEW)

**Delivers:** Solvys-styled governance components: diff preview, audit trail viewer, unified approval pipeline component. Zero edits to existing frontend files.

## File Ownership Matrix (Conflict Prevention)

| File | T1 | T2 | T3 | T4 | Notes |
|------|----|----|----|----|-------|
| `supabase/migrations/20260507_*.sql` | X | - | - | - | New |
| `backend-hono/src/types/audit.ts` | X | - | - | - | New |
| `backend-hono/src/services/audit-logger.ts` | X | - | - | - | New |
| `backend-hono/src/services/tool-approval-store.ts` | X | - | - | - | Edit - add audit hooks |
| `backend-hono/src/routes/audit/index.ts` | X | - | - | - | New |
| `backend-hono/src/routes/index.ts` | X* | - | - | - | Edit - mount /api/audit |
| `backend-hono/src/services/capability-registry/` | - | X | - | - | New directory |
| `backend-hono/src/services/ai/agent-instructions/index.ts` | - | X | - | - | Edit |
| `backend-hono/src/services/ai/soul/*.md` | - | X | - | - | 5 edits |
| `backend-hono/src/services/strands/agent-factory.ts` | - | X | - | - | Edit |
| `backend-hono/src/services/strands/agents/*.ts` | - | X | - | - | 4 edits |
| `backend-hono/src/services/desk-context/` | - | - | X | - | New directory |
| `backend-hono/src/services/hermes/context-engine.ts` | - | - | X | - | Edit |
| `backend-hono/src/services/harper-handler.ts` | - | - | X | - | Edit |
| `frontend/components/governance/` | - | - | - | X | New directory |
| `frontend/hooks/useAuditLog.ts` | - | - | - | X | New |
| `frontend/hooks/useUnifiedApproval.ts` | - | - | - | X | New |

\* T1 takes `index.ts` mount edit. T2/T3 don't touch routes.

## Execution Sequence

### Wave 1: T1 (foundation, must land first)

```
@sprint-md/S61-T1-mutation-contract-audit.md
```

T1 builds the audit table, audit-logger service, and audit API endpoint. It also adds audit hooks to the existing approval store. **No other track can run until T1 lands** because T2/T3/T4 all import from or depend on the audit infrastructure.

### Wave 2: T2, T3, T4 (parallel after T1 lands)

```
@sprint-md/S61-T2-capability-registry-agent-wiring.md
```

```
@sprint-md/S61-T3-agent-context-preflight.md
```

```
@sprint-md/S61-T4-frontend-approval-ui.md
```

T2/T3/T4 have zero file overlap. They can run in parallel.

### Wave 3: Integration & Ship

After all 4 tracks land on `sprint/S61`:

1. Merge all commits
2. Run full build: `cd backend-hono && bun run build` + `npx tsc --noEmit --project frontend/tsconfig.json` + `rm -rf dist && npx vite build`
3. Restart backend: `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist && launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`
4. Smoke test:
   - `curl -s http://localhost:8080/api/audit/log`
   - `curl -s -X POST http://localhost:8080/api/harper/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"test"}]}'`
   - `curl -s http://localhost:8080/api/diagnostics`
5. Verify no frontend regressions (existing ToolApprovalCard still works)
6. Add changelog entry to `src/lib/changelog.ts`
7. Archive to `sprint-changelog/S61-ORCHESTRATION.md`

## Acceptance Criteria

- [ ] `agent_audit_log` table created and writable
- [ ] Every approve/deny/timeout writes an audit record
- [ ] `GET /api/audit/log` returns paginated trail
- [ ] Capability registry loads at startup, enforces at runtime
- [ ] Sub-agents have wired tool sets (not bare agents)
- [ ] Prohibited tools blocked (run_command denied for oracle/feucht/consul)
- [ ] All 5 agents receive desk context preflight
- [ ] New governance UI components render (DiffPreview, AuditTrailViewer, UnifiedApprovalPipeline)
- [ ] Zero edits to existing frontend components
- [ ] All 8 breakage surfaces preserved
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] Changelog entry added

## Commit Format

```
[v6.0.17] feat: S61 unified agent governance + tooling orchestration
```

## Integration Validation

```bash
# Backend build
cd backend-hono && bun run build

# Restart backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Audit endpoint smoke
curl -s http://localhost:8080/api/audit/log | head -c 200

# Harper chat smoke
curl -s -X POST http://localhost:8080/api/harper/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"test"}]}' | head -c 200

# Diagnostics
curl -s http://localhost:8080/api/diagnostics

# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Frontend build
rm -rf dist && npx vite build
```
