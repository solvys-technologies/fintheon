# Sprint Brief: S62-T11 — MiroShark Rename to Agent Desk

- **Linear**: SOL-49
- **Parent ORCH**: @sprint-md/S62-ORCH-platform-qa-hygiene.md
- **Branch**: `sprint/S62`
- **Assignee**: Sam Frederique
- **Wave**: 1 (parallel — no dependencies)

## Context

The MiroShark feature has been renamed to "Agent Desk" as the canonical name. This task performs a systematic rename of all user-facing and API-surface references to "MiroShark" across code, UI labels, docs, database comments, and API descriptions. Internal function/variable names that are purely convention (e.g., `miroshark` in a module path) should stay as-is — focus on strings visible to users, API consumers, and documentation readers.

## Branch Target

`sprint/S62`

## Scope — Included

- [ ] `backend-hono/src/routes/mcp/index.ts` — MCP server description strings
- [ ] `backend-hono/src/routes/data/index.ts` — Data route descriptions referencing MiroShark
- [ ] `backend-hono/src/services/supabase-service.ts` — Table name comments
- [ ] `backend-hono/src/config/feature-flags.ts` — Feature flag descriptions
- [ ] `backend-hono/src/boot/services.ts` — Service boot comments
- [ ] `backend-hono/migrations/011_context_bank.sql` — DB migration comments
- [ ] `frontend/components/narrative/SanctumRiskAssessment.tsx` — UI labels
- [ ] `frontend/components/apparatus/MemoryCard.tsx` — Desk agent references in UI
- [ ] `frontend/components/strategium/DayCardBulletinTab.tsx` — Bulletin tab labels
- [ ] `sprint-changelog/S56-BRIEF-arbitrum-settings-health-panel.md` — Doc references
- [ ] `docs/sprint-briefs/S20-*.md` — Historical doc references (flag, don't rewrite history)
- [ ] `src/lib/changelog.ts` — Changelog entry references
- [ ] `mobile/components/home/ArbitrumChamberSummary.tsx` — Mobile surface labels
- [ ] `frontend/components/agent-desk/AgentDeskPanel.tsx` — Verify this post-rename panel is consistent

## Scope — Excluded (DO NOT TOUCH)

- Internal function/variable names (e.g., `miroshark` in module paths, internal identifiers)
- Backend route paths — only descriptions and comments
- Any file not listed in Scope — search results may be false positives
- Other sprint briefs outside S62 — historical docs get a flag comment, not a rewrite

## Search Patterns

```
MiroShark  → Agent Desk
miroshark  → agent-desk (only in user-facing strings)
MIROSHARK  → AGENT_DESK (only in user-facing strings)
```

## Acceptance Criteria

- [ ] `rg -i "miroshark" --type ts --type tsx` returns only legitimate internal module/function references
- [ ] No user-facing stale "MiroShark" names remain in UI, API descriptions, or docs
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes

## Validation Commands

```bash
# Search for remaining references
rg -i "miroshark" --type ts --type tsx

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build
```

## Commit Format

```
[v.6.0.27-s62-t11] chore: rename MiroShark to Agent Desk (code + UI + docs)
```
