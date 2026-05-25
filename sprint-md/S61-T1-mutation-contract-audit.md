# Sprint Brief: T1 -- Shared Mutation Contract + Audit Logger

## Context

Today's `tool-approval-store.ts` manages permissions and pending approvals but has no persistent audit trail -- it only records `approvedAt`/`approvedBy` for the current state, not decision history. No unified audit table exists anywhere. T1 builds the shared contract that T2/T3/T4 depend on: a Supabase audit table with local JSONL fallback, a typed Zod contract for mutation records, and an audit service that hooks into the existing approval flow without changing any existing signatures.

## Branch Target

`sprint/S61`

## Scope -- Included

- [ ] `supabase/migrations/20260507_s61_agent_audit_log.sql` [NEW] -- `agent_audit_log` table: id, agent_id, tool_name, tool_input, description, decision (approved/denied/timed_out), reason, surface, correlation_id, created_at, created_by. RLS: authenticated users read own records, service_role writes. Index on agent_id + created_at.
- [ ] `backend-hono/src/types/audit.ts` [NEW] -- Zod schemas: `AuditRecord`, `MutationContract` (agent_id, tool_name, tool_input, description, surface, correlation_id), `AuditDecision` (decision, reason)
- [ ] `backend-hono/src/services/audit-logger.ts` [NEW] -- `logAuditDecision(record: AuditRecord, decision: AuditDecision)` writes to Supabase; falls back to append-only `~/.fintheon/audit-log.jsonl` if Supabase unreachable. `queryAuditLog(filters?)` returns paginated results from Supabase with fallback to JSONL scan.
- [ ] `backend-hono/src/services/tool-approval-store.ts` [EDIT] -- add `logAuditDecision()` call inside `resolveApproval()` after decision is set, before emitting resolution event. No signature changes. Import and call the new audit logger.
- [ ] `backend-hono/src/routes/audit/index.ts` [NEW] -- GET `/api/audit/log?agentId=&surface=&decision=&limit=50&offset=0` (auth-gated), GET `/api/audit/log/:id` (single record)
- [ ] `backend-hono/src/routes/index.ts` [EDIT] -- mount audit routes at `/api/audit`

## Scope -- Excluded (DO NOT TOUCH)

- `backend-hono/src/services/strands/harper-tools.ts` -- T2 owns this
- `backend-hono/src/routes/arbitrum/` -- Arbitrum is out of scope
- `backend-hono/src/routes/harper/` -- existing approval routes untouched
- Any frontend file -- T4 owns frontend
- `backend-hono/src/services/ai/soul/*.md` -- T2 owns these

## Reuse Inventory (existing code to call, not reinvent)

- `resolveApproval()` at `backend-hono/src/services/tool-approval-store.ts:238` -- the decision point where audit logging hooks in. Signature: `(approvalId: string, decision: "approved" | "denied") => PendingApproval | null`
- `requestApproval()` at `backend-hono/src/services/tool-approval-store.ts:118` -- creates pending approval, emits SSE event. Signature: `(requestId, toolName, toolInput, description, opts?) => PendingApproval`
- `getSupabaseClient()` at `backend-hono/src/services/supabase-service.ts` -- existing DB client factory, do not duplicate
- `emitStep()` at `backend-hono/src/services/cognition-emitter.ts:12` -- `emitStep(requestId, step)` for SSE frontend observability
- `createLogger()` at `backend-hono/src/lib/logger.js` -- standard logger utility
- `homedir()` from `node:os` -- already imported in MCP routes, use same pattern for `~/.fintheon/` paths

## Known Issues to Preserve

- `withApprovalGate()` in `harper-tools.ts` wraps write tools -- must still work identically after audit hook
- `APPROVAL_TIMEOUT_MS = 30_000` -- timeouts must still emit audit records (decision=timed_out)
- Mobile lock-screen approval via `relay-quick.ts` no-auth endpoint -- must still work, audit records written regardless of auth path
- `PERMISSIONS_FILE = resolve(homedir(), ".fintheon", "tool-permissions.json")` -- permanent permissions grant/revoke must also be audited
- S60-T5 Plane outbound relay (just shipped May 6) -- must not be touched

## Implementation Steps

1. Create `supabase/migrations/20260507_s61_agent_audit_log.sql` with the audit table DDL, RLS policies, and indexes
2. Create `backend-hono/src/types/audit.ts` with Zod schemas for `AuditRecord`, `MutationContract`, `AuditDecision`
3. Create `backend-hono/src/services/audit-logger.ts`:
   - `async logAuditDecision(record: AuditRecord, decision: AuditDecision): Promise<void>` -- writes to Supabase, falls back to `~/.fintheon/audit-log.jsonl`
   - `async queryAuditLog(filters: AuditQueryFilters): Promise<{ rows: AuditRecord[], total: number }>` -- reads from Supabase, falls back to JSONL
   - Use `getSupabaseClient()` for DB access, `createLogger()` for logging
   - JSONL fallback: append line `JSON.stringify({...record, ...decision, logged_at: new Date().toISOString()})`
4. Edit `backend-hono/src/services/tool-approval-store.ts`:
   - Import `logAuditDecision` from new audit-logger
   - Inside `resolveApproval()` (after line `approval.resolution = decision`), call:
     ```typescript
     logAuditDecision(
       {
         agent_id: approval.submittedBy ?? "unknown",
         tool_name: approval.toolName,
         tool_input: approval.toolInput,
         description: approval.description,
         surface: approval.surface ?? "chat",
         correlation_id: approval.requestId ?? approval.id,
       },
       {
         decision: decision as "approved" | "denied" | "timed_out",
         reason: reason ?? null,
       },
     ).catch((err) => log.error("audit write failed", err));
     ```
   - In `grantPermission()`: add audit log call (decision=approved, tool_name="permission_grant")
   - In `revokePermission()`: add audit log call (decision=denied, tool_name="permission_revoke")
   - In the 30s timeout handler: add audit log call (decision=timed_out)
5. Create `backend-hono/src/routes/audit/index.ts`:
   - GET `/` -- parse query params (agentId, surface, decision, limit=50, offset=0), call `queryAuditLog()`, return `{ rows, total }`
   - GET `/:id` -- read single record by id
   - Auth: check `c.get("userId")` exists, return 401 if not
6. Edit `backend-hono/src/routes/index.ts`:
   - Import `createAuditRoutes` from new route file
   - Mount: `route("/audit", createAuditRoutes())` after auth middleware

## Acceptance Criteria

- [ ] Migration creates `agent_audit_log` table with RLS (auth users read own, service_role writes)
- [ ] `logAuditDecision()` writes to Supabase successfully
- [ ] When Supabase is unreachable, falls back to `~/.fintheon/audit-log.jsonl` without crashing
- [ ] Every `resolveApproval()` call (approve/deny/timeout) produces an audit record
- [ ] Every `grantPermission()` / `revokePermission()` call produces an audit record
- [ ] `GET /api/audit/log` returns paginated audit trail with filtering
- [ ] `GET /api/audit/log/:id` returns single record
- [ ] Existing `withApprovalGate()` behavior unchanged -- Harper tool approvals still work
- [ ] `cd backend-hono && bun run build` passes
- [ ] Live endpoint test: `curl -s http://localhost:8080/api/audit/log | head -c 200`

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Backend build
cd backend-hono && bun run build

# Restart backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Smoke test
curl -s http://localhost:8080/api/audit/log | head -c 200

# Diagnostics
curl -s http://localhost:8080/api/diagnostics
```

## Commit Format

```
[v6.0.17] feat: S61-T1 shared mutation contract + audit logger
```
