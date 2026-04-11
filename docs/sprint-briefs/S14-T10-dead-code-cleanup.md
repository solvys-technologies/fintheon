# S14-T10: Dead Code Cleanup + Orphan Deletion

## Goal

Delete confirmed orphans, clean stale references, rename X labels, verify build.

## Delete These Files (confirmed 0 imports)

- `frontend/components/InterventionSidebar.tsx` (146 lines) — replaced by Notion MCP + Hermes
- `frontend/components/MainContent.tsx` (68 lines) — ancient tab switcher, imports dead components
- `frontend/components/NotFoundPage.tsx` (81 lines) — 404 page never wired into routing
- `frontend/components/executive/AgentChatroomView.tsx` — orphan with hardcoded localhost:8090
- `frontend/hooks/useCloudState.ts` (141 lines) — cloud sync hook, never imported
- `frontend/components/ui/SPQRStamp.tsx` — orphan stamp component

## DO NOT Delete (wired in other S14 tracks)

- `frontend/lib/artifact-parser.ts` -> T7 wires this
- `frontend/lib/boardroomThreadStore.ts` -> T2 wires this
- `frontend/lib/easter-eggs.ts` -> Sunday project
- `frontend/lib/FintheonModelCatalog.ts` -> wire into chat model config
- `frontend/lib/iv-agent.ts` -> future Hermes integration

## Rename "Rettiwt" / "Twitter" -> "X"

- All user-facing labels: footer status indicators, source filters, source badges on RiskFlow cards
- Grep for "Rettiwt", "Twitter", "twitter" in frontend/ — replace visible labels with "X"
- Backend string references in comments are fine to leave, but any user-facing API responses should say "X"
- @frontend/hooks/useSourceStatus.ts — likely has source label mapping
- @frontend/lib/shared-icons.tsx:73 — has `s === "twitter-cli"` check in SourceIcon

## Clean Stale References

- @backend-hono/src/services/riskflow/feed-service.ts — clean stale `twitter-cli` comments
- @backend-hono/src/services/riskflow/feed-poller.ts:7 — stale comment about twitter-cli

## Update Changelog

- @src/lib/changelog.ts — add S14 entry covering all tracks

## Verify

- `bun run build` passes
- `npx tsc --noEmit` in backend-hono passes
- No broken imports anywhere
- Footer shows "X" not "Rettiwt (X/Twitter)"
- Source badges on cards show "X"
