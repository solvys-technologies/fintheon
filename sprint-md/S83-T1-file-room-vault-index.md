# Sprint Brief: S83-T1 -- File Room Vault Index

## Context

The vault/file base is the source of truth, but Fintheon should be the readable UI. The File Room needs desk-scoped sections for Weekly Tribune, agentic memos, NarrativeFlow summaries, uploaded PDFs, Notion wiki links, and agent SOUL files.

## Scope

- Use `@sprint-md/S83-T1-file-room-vault-index.md` in Linear issue descriptions.
- Branch target: `sprint/S83`.
- Add a backend file-room index endpoint that returns safe metadata, summaries, and bounded excerpts.
- Scope every item by `deskId` or `teamId`; default to `Priced In Capital` until multi-desk creation exists.
- Add File Room frontend sections as collapsible chevron groups:
  - Weekly Tribune
  - Agentic Memos
  - NarrativeFlow Summaries
  - Uploads
  - Notion Links
  - Agent SOUL Files
- Render memo and summary bodies with Streamdown.
- Include PDF and Notion wiki-link metadata without requiring a markdown source.

## Files

- Owned: `backend-hono/src/routes/file-room/*`, `backend-hono/src/services/file-room/*`, `frontend/components/file-room/*`, `frontend/lib/file-room.ts`.
- Reference: `backend-hono/scripts/export-agent-memory-obsidian.ts`, `backend-hono/scripts/export-riskflow-catalysts-obsidian.ts`, `backend-hono/src/services/ai/soul/*`, `frontend/components/chat/slots/StreamdownChat.tsx`.
- Avoid: direct Obsidian UI assumptions, raw vault dumps, and unrelated NarrativeFlow canvas changes.

## Acceptance

- `GET /api/file-room?deskId=priced-in-capital` returns sectioned safe metadata.
- File Room renders collapsible chevron groups by document type.
- Weekly Tribune, agentic memo, NarrativeFlow summary, upload, Notion link, and SOUL file types have distinct display labels and source metadata.
- Bounded excerpts are capped server-side.
- `cd backend-hono && bun run build` passes.
- `npx tsc --noEmit --project frontend/tsconfig.json` passes.
