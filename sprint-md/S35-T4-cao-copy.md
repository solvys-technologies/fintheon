# Sprint Brief: T4 — Ask Harper → CAO Copy Sweep

## Context

Every user-visible string that says "Ask Harper" or "Harp" needs to become "CAO" (or "Ask CAO"). The CAO persona is named Harper internally — that stays — but the chat feature is called "CAO chat" and every UI label reflects that. One analytics event gets dual-emit for a 2-week migration window. This is a straight copy sweep; 7 files, no architectural changes.

## Branch Target

`s35-t4-cao-copy` (off `s34-unified`)

## Scope — Included

Seven exact edits:

1. `mobile/components/notifications/NotificationCard.tsx` line 270 — button label `ASK HARPER` → `ASK CAO`
2. `mobile/components/notifications/NotificationDrawer.tsx` line 3 — comment string `ASK HARPER for scored alerts / REVEAL ACTIONS for proposals` → `ASK CAO for scored alerts / REVEAL ACTIONS for proposals`
3. `mobile/App.tsx` line 143 — comment `"Ask Harper" swipe dispatches` → `"Ask CAO" swipe dispatches`
4. `frontend/components/regimes/RegimeMiniChat.tsx` line 52 — placeholder string `Ask Harper...` → `Ask CAO...`
5. `frontend/lib/relay-dispatch-store.ts` line 4 — comment `// and main Ask Harper chat so both surfaces render the same state.` → `// and main CAO chat so both surfaces render the same state.`
6. `frontend/lib/usage-emit.ts` line 138 — docstring/comment still says `action: opaque verb ("view", "click", "filter", "promote", "ask_harper", ...)`. Update to `action: opaque verb ("view", "click", "filter", "promote", "ask_cao", "ask_harper" [legacy, migrating 2wk], ...)`. ALSO: wherever a caller emits `action: "ask_harper"`, add a parallel emit with `action: "ask_cao"` so both events fire simultaneously (dual-emit pattern). The legacy `ask_harper` event stays for 2 weeks so analytics dashboards don't break. Document the sunset date in the comment: `// ask_harper deprecated 2026-05-08`.
7. `backend-hono/src/skills/quickscope.md` line 5 — text `User says "quickscope" in Ask Harp chat.` → `User says "quickscope" in CAO chat.`

## Scope — Excluded (DO NOT TOUCH)

- Any file NOT in the list above
- Agent ID `harper-opus` — stays (it's the database-level identifier, not user copy)
- Route `/api/harper/chat` — stays (internal route, not user-visible)
- Persona name "Harper" anywhere — stays (CAO IS Harper; only the chat feature label changes)
- CSS, styling, component structure — no visual changes, just copy

## Reuse Inventory

- `frontend/components/chat/PersonaDropdown.tsx:10` already has `PERSONA_META["harper"] = "CAO"` — no change needed, confirms the display mapping is correct
- Existing usage-emit callers — search `grep -rn "ask_harper" frontend/ mobile/` to find dual-emit insertion points

## Known Issues to Preserve

- The backend endpoint `/api/harper/chat` and agent id `harper-opus` are NOT copy — they are identifiers. Do not touch them.
- In `usage-emit.ts`, the dual-emit is additive — do NOT remove the `ask_harper` emit, just add `ask_cao` alongside. Sunset date 2026-05-08 documented in a comment.
- Mobile app strings — confirm the capitalization in NotificationCard.tsx:270 matches the surrounding button style (ALL-CAPS button vs Title Case). The current `ASK HARPER` is uppercase; use `ASK CAO` (uppercase) to match.

## Implementation Steps

1. Edit each of the 7 files per the exact changes listed above
2. For usage-emit.ts dual-emit:
   - Locate every call site that fires `action: "ask_harper"` (grep `ask_harper` across frontend/ and mobile/)
   - For each, insert a parallel emit with `action: "ask_cao"` using the same payload
   - Add a code comment near the emit function: `// S35-T4: ask_cao is the primary action name; ask_harper stays as legacy dual-emit until 2026-05-08`
3. Verify no other "Ask Harp" / "Ask Harper" strings leaked in — run:
   ```
   grep -rinE "(ask[ -]?harp|Ask Harper)" frontend/ mobile/ backend-hono/src/ 2>/dev/null | grep -v node_modules
   ```
   Expected result after your edits: zero live-code hits. Only changelog/sprint-briefs historical references remain.

## Acceptance Criteria

- [ ] All 7 files edited with the exact strings specified
- [ ] `grep -rnE "Ask Harper|ASK HARPER" frontend/ mobile/ backend-hono/src/` returns no live-code hits
- [ ] `frontend/lib/usage-emit.ts` dual-emits both `ask_cao` and `ask_harper` at every call site
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` clean
- [ ] `rm -rf frontend/dist && cd frontend && npx vite build` clean
- [ ] `cd backend-hono && bun run build` clean
- [ ] Visual: mobile notification card button reads "ASK CAO" (not "ASK HARPER")
- [ ] Visual: regime mini chat placeholder reads "Ask CAO..."

## Validation Commands

```bash
# Verify all 7 edits landed
grep -n "ASK CAO" mobile/components/notifications/NotificationCard.tsx
grep -n "ASK CAO" mobile/components/notifications/NotificationDrawer.tsx
grep -n "Ask CAO" mobile/App.tsx
grep -n "Ask CAO\\.\\.\\." frontend/components/regimes/RegimeMiniChat.tsx
grep -n "main CAO chat" frontend/lib/relay-dispatch-store.ts
grep -n "ask_cao" frontend/lib/usage-emit.ts
grep -n "CAO chat" backend-hono/src/skills/quickscope.md

# Zero live-code Ask Harper references
grep -rnE "(Ask Harper|ASK HARPER|ask_harp )" frontend/ mobile/ backend-hono/src/ 2>/dev/null | grep -v node_modules | grep -v changelog

# Builds
npx tsc --noEmit --project frontend/tsconfig.json
cd backend-hono && bun run build
```

## Commit Format

```
[v5.25.0-S35-T4] feat: Ask Harper -> CAO copy sweep (7 files)

Updates user-visible copy on mobile notification card/drawer swipe,
regime mini chat placeholder, relay dispatch store comment, and backend
quickscope skill. Dual-emits ask_cao + ask_harper from usage-emit for
2wk analytics migration window (sunset 2026-05-08). Persona "Harper"
stays as the CAO's name; only the feature label "CAO chat" changes.
Route /api/harper/chat and agent id harper-opus untouched (identifiers).
```
