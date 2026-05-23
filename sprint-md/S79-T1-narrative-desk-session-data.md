# Sprint Brief: S79-T1 -- Narrative Desk Session Data

## Context

NarrativeFlow needs to stop behaving like a disposable generated map and start behaving like shared desk memory. This track creates the Supabase-backed desk/session/document/timeline/canvas foundation that later UI tracks can read and write. Keep the team feature lightweight: one default desk, `Priced In Capital`, with future-compatible desk membership rows, but no invite UI or multi-team administration in this track.

## Linear Scope

- **Issue naming**: `S79-T1: Narrative Desk Session Data`
- **Beta Phase**: Closed Beta
- **Linear Project**: Beta -- Sanctum & Arbitrum UX
- **Linear Initiative**: Beta Closed
- **Cycle**: Cycle 8 - Beta Closed
- **Due date**: 2026-05-23
- **Assigned owner**: local Solvys Agent
- **Brief reference**: `@sprint-md/S79-T1-narrative-desk-session-data.md`

## Branch Target

`sprint/S79`

## Scope -- Included

- [ ] Add Supabase migrations for desk-scoped NarrativeFlow sessions, artifacts, catalysts, and narrative tags.
- [ ] Seed the default `Priced In Capital` desk.
- [ ] Add backend service modules for session CRUD, rename/color updates, catalyst attachment, artifact persistence, and session history reads.
- [ ] Add narrative API routes under `/api/narrative/desks` or `/api/narrative/sessions`.
- [ ] Add frictionless delete/refine endpoints so the workspace can delete a narrative, remove catalysts, replace the catalyst set, and save edited workspace artifacts.
- [ ] Enforce minimum 3 RiskFlow catalysts when creating a new session.
- [ ] Persist the session conversation/research transcript and agent work events separately from generated artifacts.
- [ ] Persist docs/report links so Docs can survive reloads and cross-user desk viewing.
- [ ] Preserve existing `narrative_threads` and `narrative_card_links` behavior.

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/components/narrative/NarrativeCanvas.tsx` - owned by S79-T5.
- `frontend/components/narrative/NarrativeSensemakingComposer.tsx` - owned by S79-T2.
- `frontend/components/narrative/NarrativeSensemakingDetail.tsx` - owned by S79-T3.
- Any invite, billing, admin, or multi-team onboarding UI.
- Full RLS hardening beyond clear owner/member columns and service-side guards, unless it is a tiny additive policy.

## Reuse Inventory

- `narrative_threads` in `backend-hono/migrations/027_narrative_threads.sql:5` - existing narrative registry with `slug`, `title`, `color`, `keywords`, and status.
- `narrative_card_links` in `backend-hono/migrations/027_narrative_threads.sql:32` - existing many-to-many catalyst to narrative mapping.
- `readSensemakingCatalysts` at `backend-hono/src/services/narrative-sensemaking/catalyst-reader.ts:20` - already reads selected RiskFlow anchors and related pool items.
- `buildSensemakingMap` at `backend-hono/src/services/narrative-sensemaking/sensemaker.ts:14` - existing response builder that can become the session generation core.
- `createNarrativeRoutes` at `backend-hono/src/routes/narrative/index.ts:24` - mount new route files here.

## Existing Schema Facts

- Default narratives already exist: `rate-cut-cycle`, `price-stability`, and `maximum-employment` are seeded in `backend-hono/migrations/027_narrative_threads.sql:81`, `:93`, and `:99`.
- Existing catalyst source is `scored_riskflow_items`, read by `catalyst-reader.ts`.
- Existing review actions live in `supabase/migrations/20260517180000_narrative_review_actions.sql`; do not replace that table.

## Implementation Steps

1. Add migration `supabase/migrations/20260522160000_narrative_desk_sessions.sql`.
2. Create tables:
   - `narrative_desks`: `id`, `name`, `slug`, `color`, `created_by`, timestamps. Seed `priced-in-capital`.
   - `narrative_desk_members`: `desk_id`, `user_id`, `role`, timestamps. Keep role as text, not enum.
   - `narrative_sessions`: `id`, `desk_id`, `title`, `color`, `status`, `created_by`, `updated_by`, `last_opened_at`, `generated_at`, timestamps.
   - `narrative_session_catalysts`: `session_id`, `riskflow_item_id`, `role`, `conflict_score`, `conflict_label`, `selected_by`, timestamps.
   - `narrative_session_artifacts`: `session_id`, `artifact_type` (`flow`, `timeline`, `docs`, `situation-map`, `agent-work`), `payload jsonb`, `version`, `created_by`, timestamps.
   - `narrative_session_messages`: `session_id`, `role`, `content`, `metadata jsonb`, `created_by`, timestamps.
   - `narrative_agent_work_events`: `session_id`, `agent_name`, `event_type`, `summary`, `payload jsonb`, timestamps.
   - `narrative_session_links`: `session_id`, `url`, `title`, `source`, `summary`, timestamps.
   - `narrative_session_tags`: `session_id`, `tag`, `confidence`, `source`, timestamps.
3. Add backend service folder `backend-hono/src/services/narrative-sessions/` with small files:
   - `types.ts`
   - `session-store.ts`
   - `artifact-store.ts`
   - `default-desk.ts`
   - `session-generator.ts`
4. Add route folder `backend-hono/src/routes/narrative/sessions/` with handlers:
   - `GET /sessions?deskId=...`
   - `POST /sessions`
   - `GET /sessions/:id`
   - `PATCH /sessions/:id`
   - `POST /sessions/:id/catalysts`
   - `POST /sessions/:id/messages`
   - `GET /sessions/:id/work-events`
   - `PUT /sessions/:id/artifacts/:type`
   - `DELETE /sessions/:id`
   - `PUT /sessions/:id/catalysts`
   - `DELETE /sessions/:id/catalysts/:riskflowItemId`
5. Update `backend-hono/src/routes/narrative/index.ts` only to mount the new route module.
6. In `POST /sessions`, reject fewer than 3 catalyst ids with HTTP 400 and message `Attach at least 3 RiskFlow catalysts to begin.`
7. Reuse `buildSensemakingMap` to produce initial flow/timeline/doc payloads, then persist them as artifacts.
8. Keep file lengths under 300 lines. Split store, validation, and route handlers early.

## Agent HOW -- Narrative Delete / Refine / Workspace

When wiring UI or another agent tool, use these calls directly. Do not add a confirmation maze or a second persistence path.

- Delete a narrative session: `DELETE /api/narrative/sessions/:id`. This hard-deletes the session row and relies on cascade deletes for catalysts, artifacts, transcript messages, work events, links, and tags.
- Rename/recolor a narrative: `PATCH /api/narrative/sessions/:id` with `{ "title": "...", "color": "#c79f4a" }`.
- Add catalysts without disturbing the current list: `POST /api/narrative/sessions/:id/catalysts` with either `{ "catalystIds": ["riskflow-id"] }` or `{ "catalysts": [{ "riskflowItemId": "riskflow-id", "role": "anchor" }] }`.
- Replace/refine the catalyst list in one move: `PUT /api/narrative/sessions/:id/catalysts` with the same body shape. This is the low-friction "make this the list now" path for picker edits.
- Remove one catalyst from a session: `DELETE /api/narrative/sessions/:id/catalysts/:riskflowItemId`.
- Save workspace edits: `PUT /api/narrative/sessions/:id/artifacts/:type` where `:type` is `flow`, `timeline`, `docs`, `situation-map`, or `agent-work`, with `{ "payload": { ... } }`. Each save creates a new artifact version; `GET /api/narrative/sessions/:id` returns latest artifacts plus all versions.
- Record transcript/research notes: `POST /api/narrative/sessions/:id/messages` with `{ "role": "user" | "agent" | "system", "content": "...", "metadata": {} }`.

Creation still requires at least 3 RiskFlow catalysts, but refinement endpoints are intentionally lighter so TP can remove, swap, and save while already inside the workspace.

## Acceptance Criteria

- [ ] A default desk called `Priced In Capital` exists or is created idempotently.
- [ ] `POST /api/narrative/sessions` rejects fewer than 3 catalyst ids.
- [ ] A valid session persists selected catalysts, generated timeline/flow/docs payloads, and can be fetched by id.
- [ ] Session detail includes transcript messages, agent work events, and docs/report links when present.
- [ ] `PATCH /api/narrative/sessions/:id` renames and recolors the narrative.
- [ ] `DELETE /api/narrative/sessions/:id` deletes a narrative without leaving orphaned session data.
- [ ] Catalyst refinement supports add, replace, and single-catalyst removal.
- [ ] Workspace artifact edits can be saved as new versions for `flow`, `timeline`, `docs`, `situation-map`, and `agent-work`.
- [ ] Existing `/api/narrative/sensemaking` remains backward compatible.
- [ ] No frontend files are modified by this track.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

## Commit Format

```bash
[v6.7.10] feat: S79-T1 narrative desk session data
```
