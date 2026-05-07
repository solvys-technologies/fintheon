# Sprint Brief: T4 -- Frontend Approval UI (New Components Only)

## Context

Existing approval UI (`ToolApprovalCard.tsx` in chat, `ApprovalModal.tsx` for sensitive actions, `ApprovalsPage.tsx` admin inbox) must remain untouched. T4 builds new standalone components for the unified governance surface: a diff preview for mutation actions, an audit trail viewer, and a unified approval pipeline component. These are additive -- they don't replace or edit any existing component. All components use the Solvys industrial-luxe aesthetic: frosted-glass surfaces, thin `#c79f4a` accent borders, no gradients, no shadows.

## Branch Target

`sprint/S61`

## Scope -- Included

- [ ] `frontend/components/governance/UnifiedApprovalPipeline.tsx` [NEW] -- single component that renders: draft summary → diff preview → approve/deny buttons → status transition → audit record link. Props: `mutation: MutationPayload`, `onApprove: () => void`, `onDeny: () => void`. States: pending, approved, denied, expired, error.
- [ ] `frontend/components/governance/DiffPreview.tsx` [NEW] -- before/after diff view for mutation payloads. Props: `before: unknown`, `after: unknown`, `label?: string`. Shows additive (green-gold), removal (red-muted), and change lines. Solvys-styled with monospace font for code-like diffs.
- [ ] `frontend/components/governance/AuditTrailViewer.tsx` [NEW] -- paginated table reading from `GET /api/audit/log`. Props: `limit?: number`. Columns: timestamp, agent, tool, surface, decision (with colored badge), details. Frosted-glass rows with gold accent borders. Empty state: "No audit records yet."
- [ ] `frontend/hooks/useAuditLog.ts` [NEW] -- `useAuditLog(filters?: AuditQueryFilters)` fetch hook for `/api/audit/log`. Returns `{ rows: AuditRecord[], total: number, isLoading, error, refetch }`. Pagination via `offset`/`limit` params.
- [ ] `frontend/hooks/useUnifiedApproval.ts` [NEW] -- `useUnifiedApproval()` hook wrapping the unified approval flow: `submitMutation(payload)` → SSE listen for approval event → `execute()` on approve → `logResult()`. Returns `{ submitMutation, pendingApproval, isPending, error }`.

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/components/chat/ToolApprovalCard.tsx` -- existing chat approval card, must not be edited
- `frontend/components/shared/ApprovalModal.tsx` -- existing shared modal, must not be edited
- `frontend/components/admin/ApprovalsPage.tsx` -- existing admin inbox, must not be edited
- `frontend/components/chat/FintheonThread.tsx` -- existing chat thread, must not be edited
- `frontend/components/chat/hooks/useToolApprovals.ts` -- existing hook, must not be edited
- Any existing component, hook, or page -- this is additive only

## Reuse Inventory (read from, do not edit)

- `useToolApprovals()` at `frontend/components/chat/hooks/useToolApprovals.ts:156` -- reference for SSE event stream listening pattern. Listens to `/api/ai/cognition/stream?requestId=...`, parses `tool-approval-needed` events. Use the same SSE URL for `useUnifiedApproval`.
- `ApprovalModal` at `frontend/components/shared/ApprovalModal.tsx:225` -- reference for Solvys frosted-glass styling patterns, button layout, Deny + Approve button pair
- `ToolApprovalCard` at `frontend/components/chat/ToolApprovalCard.tsx:223` -- reference for approval state transitions (pending→approved→executing→done/denied), status badge colors
- `NothingFuse` at `frontend/components/shared/NothingFuse.tsx` -- reuse for severity/confidence indicators in audit trail
- `emitStep()` at `backend-hono/src/services/cognition-emitter.ts:12` -- SSE emission used by backend for frontend observability. New audit events will emit through this channel.
- `/api/audit/log` endpoint (built by T1) -- the data source for `useAuditLog` hook
- `/api/harper/tool-decision` endpoint -- existing approval resolution endpoint, used by `useUnifiedApproval`

## Aesthetic Rules (Solvys Industrial-Luxe)

- **Canvas**: `bg-[#050402]/80 backdrop-blur-md` (frosted-glass warm near-black)
- **Borders**: `border border-[#c79f4a]/20` (thin, low-opacity Solvys Gold)
- **Text**: `text-[#f0ead6]` primary, `text-[#f0ead6]/60` secondary/muted
- **Accent**: `#c79f4a` for approve buttons, active states, focus rings, decision badges
- **No**: gradients, emojis, Kanban borders, AI sparkles, generic box-shadows, drop-shadows
- **Typography**: `font-sans`, tabular numbers for timestamps, monospace for diff content
- **Spacing**: consistent 12px/16px/24px grid per `/solvys-feels`
- **States**: loading (subtle surface pulse, no spinner), empty (muted text), error (inline bar with retry, no modal), success (brief green flash)

### Component Layouts

**UnifiedApprovalPipeline** (vertical stack, max-w-2xl):
```
┌──────────────────────────────────────────┐
│ [tool icon] [tool name]        [pending] │  ← frosted-glass header
│──────────────────────────────────────────│
│ Mutation summary text                    │
│──────────────────────────────────────────│
│ DiffPreview (expandable)                 │  ← collapsible section
│──────────────────────────────────────────│
│ [Deny]                    [Approve]      │  ← gold approve, muted deny
└──────────────────────────────────────────┘
```

**AuditTrailViewer** (paginated table):
```
┌──────────────────────────────────────────────────────────┐
│ Timestamp          Agent     Tool          Decision      │
│──────────────────────────────────────────────────────────│
│ 2026-05-07 14:23   harper   write_file    ✓ approved    │  ← frosted row
│ 2026-05-07 14:22   oracle   get_quote     ✓ approved    │
│ 2026-05-07 14:20   feucht   run_command   ✗ denied      │  ← red badge
│ ...                                                      │
│──────────────────────────────────────────────────────────│
│               ← Prev   Page 1 of 3   Next →              │
└──────────────────────────────────────────────────────────┘
```

**DiffPreview** (code-diff style):
```
┌──────────────────────────────────────────┐
│ Before                    After           │
│──────────────────────────────────────────│
│ - removed line            + added line    │  ← monospace
│   unchanged line            unchanged line│
│ - old_value               + new_value     │
└──────────────────────────────────────────┘
```

## Implementation Steps

1. Create `frontend/hooks/useAuditLog.ts`:
   - `useAuditLog(filters?: { agentId?, surface?, decision?, limit?, offset? })`
   - Fetches `GET /api/audit/log?agentId=...&surface=...&decision=...&limit=50&offset=0`
   - Returns `{ rows: AuditRecord[], total: number, isLoading, error, refetch }`
   - Handles loading, error, empty states
   - Export `AuditRecord` type matching `backend-hono/src/types/audit.ts`

2. Create `frontend/hooks/useUnifiedApproval.ts`:
   - `useUnifiedApproval()` hook
   - `submitMutation(payload: MutationPayload)`: POSTs to trigger approval flow, opens SSE stream
   - Listens for `tool-approval-needed` + `tool-approval-resolved` SSE events
   - `sendDecision(approvalId, decision)` posts to `POST /api/harper/tool-decision`
   - Returns `{ submitMutation, pendingApproval, isPending, error }`

3. Create `frontend/components/governance/DiffPreview.tsx`:
   - Accepts `before: unknown`, `after: unknown`, `label?: string`
   - Renders side-by-side or unified diff (unified is cleaner for Solvys)
   - Green-gold for additions, red-muted for removals
   - Monospace font (`font-mono`) for code-like content
   - Collapsible when diff is large (>20 lines, show "Show all N changes")
   - Empty state: "No changes to display" (when before === after)

4. Create `frontend/components/governance/AuditTrailViewer.tsx`:
   - Uses `useAuditLog` hook
   - Renders paginated table with frosted-glass rows
   - Decision column: colored badge (approved=gold `#c79f4a`, denied=red, timed_out=amber)
   - Timestamp column: relative time ("2m ago") with absolute tooltip
   - Loading state: subtle pulse on table body, no spinner
   - Empty state: "No audit records yet" with muted text
   - Error state: inline error bar "Failed to load audit trail" with Retry button

5. Create `frontend/components/governance/UnifiedApprovalPipeline.tsx`:
   - Uses `useUnifiedApproval` hook
   - Renders the full approval lifecycle: draft → preview → decide → execute → audit
   - Tool icon + name in header row (frosted glass)
   - `DiffPreview` in collapsible section (auto-expanded for writes, collapsed for reads)
   - Approve button: `#c79f4a` background, "Approve" text
   - Deny button: muted border, "Deny" text
   - Status badge: pending (amber), approved (gold), denied (red), executed (green), error (red)
   - After resolution: link to audit record in `AuditTrailViewer`
   - All 4 states handled: pending, approved, denied, error

## Acceptance Criteria

- [ ] All 3 new components render without errors
- [ ] `DiffPreview` shows before/after for mutation payloads with color-coded diff
- [ ] `AuditTrailViewer` fetches and displays paginated audit log from `/api/audit/log`
- [ ] `UnifiedApprovalPipeline` handles all states: pending, approved, denied, expired, error
- [ ] No existing component is edited -- `git diff --stat` shows only new files in `frontend/components/governance/` and `frontend/hooks/`
- [ ] All components match Solvys aesthetic: frosted-glass, thin `#c79f4a` borders, no gradients, no shadows, no emojis
- [ ] Loading states use surface pulse (no spinner), empty states show muted text, error states show inline bar
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Verify no existing files touched
git diff --stat HEAD -- frontend/
```

## Commit Format

```
[v6.0.17] feat: S61-T4 unified approval pipeline UI components
```
