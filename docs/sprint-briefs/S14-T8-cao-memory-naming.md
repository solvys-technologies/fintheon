# S14-T8: CAO Memory System + Naming

## Goal

Per-user Chief Agentic Officer (default: Harper) with shared firm memory bank, interval-based flush, verbal flush, and rename capability.

## Existing Infrastructure (DO NOT REBUILD)

- `peer_shared_memory` table in Supabase — categories, TTL, CRUD, FTS index
- @backend-hono/src/services/peers/shared-memory.ts — shared memory service with DB + in-memory fallback, 500-entry cap, 30min cleanup cron
- @backend-hono/src/routes/memory/index.ts — memory CRUD routes (GET/PUT/DELETE /api/memory/shared)
- @backend-hono/src/services/agent-context-bank-service.js — agent context bank with memory types: observation, feedback, thought, instruction, briefing
- @backend-hono/src/routes/context-bank/index.ts — context bank routes
- @frontend/components/memory/SharedMemoryPanel.tsx — memory UI with dual modes (standard CRUD + fileroom read-only)

## What to Do

1. **CAO naming**:
   - Add `cao_name` field to user profile / team_members table (default: "Harper")
   - @frontend/components/team/TeamOnboarding.tsx — during team card creation, prompt: "Name your Chief Agentic Officer"
   - First chat open: if CAO unnamed, show modal reminder
   - Settings UI: always editable, persist via PUT endpoint
   - Frontend: CAO name replaces "Harper" / "Harper-Opus" everywhere — chat header, persona selector pill, sidebar chat, team panel

2. **Memory flush every 10 messages**:
   - Backend: after every 10th message in a conversation, scan the last 10 exchanges for saveable insights (trade ideas, analysis conclusions, market observations)
   - Auto-save to `peer_shared_memory` with user-scoped category
   - Sessions under 10 messages are NOT flushed
   - Track message count per conversation in the chat handler

3. **Verbal flush**:
   - Detect phrases like "remember this", "save this", "note this down" in user messages
   - CAO immediately saves the referenced content to shared memory
   - Confirm to user: "Saved to memory"

4. **Shared firm memory**:
   - Team-wide entries: category "firm" — visible to all CAOs across all users
   - Individual entries: category "personal-{userId}" — scoped to that user's CAO only
   - When CAO formulates responses, it can draw from both pools

## Verify

- Go to Settings, rename CAO from Harper to custom name — name updates everywhere
- Chat with CAO for 10+ messages — memory entries auto-appear in SharedMemoryPanel
- Say "remember this analysis" — CAO saves immediately, confirms
- Switch users — shared firm entries visible, individual entries scoped
