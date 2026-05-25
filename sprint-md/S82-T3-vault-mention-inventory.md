# Sprint Brief: S82-T3 -- Vault Mention Inventory

## Context

The hidden full Narrative/Theme map should become a growing source of important market memory. Users and agents need a shared `@` drawer that can cite narratives, docs, skills, connectors, RiskFlow headlines, instruments, tickers, and safe Obsidian vault note metadata.

## Scope

- Use `@sprint-md/S82-T3-vault-mention-inventory.md` in Linear issue descriptions.
- Linear issue: `SOL-187`.
- Branch target: `sprint/S82`.
- Add a safe mention inventory endpoint at `/api/context/mentions`.
- Return metadata only: no raw vault dumps, credentials, private DB rows, or unfiltered note bodies.
- Add a composer-attached `@` drawer for main CAO chat and NarrativeFlow input bars.
- Mention selection inserts a stable token and carries selected metadata into CAO chat context.

## Files

- Owned: `backend-hono/src/routes/context-mentions/*`, `backend-hono/src/services/context-mentions/*`, `frontend/lib/context-mentions.ts`, `frontend/components/chat/ContextMentionDrawer.tsx`, integration points in the composer files.
- Avoid: direct vault write/edit UI and migrations unless persistence is explicitly required later.

## Acceptance

- `/api/context/mentions?q=rate` returns safe mention items from available sources.
- Typing `@` in main chat and NarrativeFlow opens the shared mention drawer.
- Selecting a mention inserts a readable token and preserves metadata for CAO context injection.
- `cd backend-hono && bun run build` passes.
- `npx tsc --noEmit --project frontend/tsconfig.json` passes.
