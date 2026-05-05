# Shared Context

## Active Focus

- **S38-T1 Chat Foundation** (v.05.04.00): COMPLETE

## Current State

- S38-T1 COMPLETE: 14 SSE event types, Cmd+K palette, slash commands, ↑↓ history, message queue, plan mode toggle, dispatch removal
- Backend + Frontend typescript clean; Mobile has 1 pre-existing error in SkillsDrawer.tsx
- Sub-agent rules integrated into .cursor/rules.
- Project standards consolidated.
- Domain knowledge documented.

## Global Environment

- Frontend: Vercel (Auto-deploy)
- Backend: Fly.io (App: fintheon)
- DB: Optional — app works without DATABASE_URL (in-memory fallback)
- Auth: BYPASS_AUTH=true for local/Electron — no Supabase credentials needed
- ONLY required env var: OPENROUTER_API_KEY
