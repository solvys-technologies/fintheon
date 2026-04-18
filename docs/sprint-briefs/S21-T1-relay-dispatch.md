# Sprint Brief: S21-T1 — Relay Button Dispatch (Mirror Model)

## Context

Today the "relay" button in the sidebar chat's `ChatHeader` copies `currentConversationId` to the clipboard as a pickup code — user is expected to paste it into their mobile app manually. The sidebar chat has the button; the main Ask Harp chat has no relay entry point at all.

This sprint replaces that passive pickup-code flow with an **active mirror dispatch**:

1. Move the relay button out of the header and onto the chat input bar, placed in the left action cluster (near tools/personas/briefing). Applies to both the sidebar chat and the main Ask Harp chat.
2. Clicking relay when the user's mobile is reachable via the relay WebSocket sends a web-push to the paired mobile device, auto-opens the Fintheon PWA to the same `conversationId`, and switches desktop into **mirror mode**: desktop composer input is disabled, streaming messages typed on mobile appear on desktop in real time, a Disconnect button replaces the relay button.
3. Clicking Disconnect on desktop tears down the session, tells mobile to stop broadcasting, and re-enables the desktop composer.

Inline fixups: two Ultrareview findings against this same branch that touch adjacent code (dreams endpoint ordering + oracle feature-flag semantic conflict) are bundled into this single track to avoid a separate cleanup commit.

**Scope added mid-planning** — because dispatch lands the user on the mobile chat, the mobile chat must actually work. User reported that on last attempt the mobile chat input was non-functional (couldn't type, couldn't send). Additional in-scope work:

- Diagnose and fix the mobile chat input — textarea must accept input, send button must post to the correct endpoint, keyboard must not be blocked by z-index/focus/pointer-events issues.
- Verify mobile posts to the correct endpoint for the current connection mode: `/api/ai/chat` when the local backend is reachable directly, `/api/relay/chat` when the user is chatting via the hosted relay (mobile → Fly → relay-ws → local Electron). No silent 404s, no orphaned messages.
- Add a **RiskFlow headline picker modal** to the mobile composer, equivalent to desktop `HeadlinePickerPopover.tsx`. User taps an icon in the composer, a pop-up modal lists current RiskFlow items (from `GET /api/riskflow/feed`), user selects one or more, selected headlines attach as context to the next message so the agent can speak to them specifically.
- **Image attachments** on mobile — user can pick one or more images from the device camera roll (or take a new one), attachments are sent to the agent as vision input. End-to-end: picker → base64 or signed-URL upload → included in the chat request payload → agent actually receives and can describe the image in its reply.

## Branch Target

`s20-agent-swarm-platform-ops`

> Note: sprint number is S21 (new `/solvys-orchestrate` invocation = new sprint number) but work continues on the S20 branch rather than cutting a new branch. Commit prefix is `[v5.19.0] feat: S21-T1 …`.

## Scope — Included

### Desktop frontend

- [ ] `frontend/components/chat/ChatHeader.tsx` — remove the existing relay button (Radio icon + clipboard handler, lines 27–68). Briefing + new-chat + sessions buttons stay.
- [ ] `frontend/components/chat/FintheonComposer.tsx` — add a relay button + disconnect button to the left action cluster. Position: left of the briefing/MDB button if one exists in the composer; otherwise leftmost in the action cluster. Wire to new `useRelayDispatch` hook.
- [ ] `frontend/components/ChatInterface.tsx` — same placement for the main Ask Harp chat. When dispatched, show a "Chatting on iPhone" banner above the composer (or replace the composer textarea with a muted read-only view); pipe incoming mirror-message events into the existing thread renderer.
- [ ] `frontend/components/chat/FintheonFloatingChat.tsx` — same dispatched-state banner + read-only composer treatment for the sidebar surface.
- [ ] `frontend/hooks/useRelayDispatch.ts` — **new**. Polls `GET /api/relay/health` every 15s (gate the button enabled/disabled), exposes `{ isAvailable, isDispatched, deviceLabel, dispatch(), disconnect() }`. `dispatch()` POSTs `/api/relay/dispatch { conversationId }` and, on success, subscribes to a dedicated SSE stream (`GET /api/relay/mirror-stream?conversationId=…`) that emits `mirror-message` events from the mobile side.
- [ ] `frontend/stores/useRelayStore.ts` — **new**. Zustand store holding `{ isDispatched, dispatchedConversationId, pairedDeviceLabel, mirrorMessages: ChatMessageData[] }`. Reset on disconnect.
- [ ] `frontend/components/chat/FintheonThread.tsx` — render `mirrorMessages` from the store alongside normal messages when `isDispatched === true` for the current conversation. Tag mirrored messages with a subtle "from mobile" indicator (monochrome, no color — per [CLAUDE.md](CLAUDE.md)).

### Backend

- [ ] `backend-hono/src/routes/relay.ts` — add three new routes (auth-required, same `/api/relay/*` mount point):
  - `POST /dispatch` — body `{ conversationId }`. Verify ownership via `getConversation(convId, userId)` (matches S20 IDOR fix). Register an active dispatch in `relayBridge`. Fire a web-push to the user's subscribed devices via `web-push-service` with payload `{ type: "relay-dispatch", conversationId, deepLink: "/chat/"+conversationId }`. Also emit a WebSocket message `{ type: "dispatch-begin", conversationId }` to the paired mobile if it's already connected (warm-start). Return `{ dispatchedAt, deviceLabel }`.
  - `POST /disconnect` — body `{ conversationId }`. Tear down dispatch in `relayBridge`, emit `{ type: "dispatch-end", conversationId }` to mobile, return `{ ok: true }`.
  - `GET /mirror-stream` — query `conversationId`. Verify ownership. Open SSE stream that re-emits any `mirror-message` published by `relayBridge` for that `conversationId + userId`. Close when dispatch ends or client disconnects.
- [ ] `backend-hono/src/services/relay-bridge.ts` — extend with `dispatches: Map<string, { conversationId, startedAt, deviceLabel }>` keyed by userId, and event emitters for `mirror-message`, `dispatch-begin`, `dispatch-end`. New methods: `beginDispatch(userId, convId, deviceLabel)`, `endDispatch(userId)`, `publishMirrorMessage(userId, convId, msg)`, `subscribeMirror(userId, convId, callback) -> unsubscribe`, `isDispatched(userId, convId) -> boolean`.
- [ ] `backend-hono/src/boot/relay-ws.ts` — handle two new inbound WS message types from mobile:
  - `mirror-message` — `{ conversationId, role, content, createdAt }`. Validate userId owns convId, call `relayBridge.publishMirrorMessage(userId, convId, msg)`.
  - `dispatch-ack` — `{ conversationId, deviceLabel }`. Confirms mobile received the dispatch-begin; updates `relayBridge.dispatches[userId].deviceLabel`.
- [ ] `backend-hono/src/services/web-push-service.ts` — new payload shape for `relay-dispatch` type if not already supported; existing T7 VAPID plumbing reused.

### Mobile

#### Dispatch + mirror receiver

- [ ] `mobile/public/service-worker.js` (or wherever the existing push handler lives — confirm first) — handle `{ type: "relay-dispatch" }` push. On click, open `deepLink` (= `/chat/:conversationId`).
- [ ] `mobile/stores/useChatStore.ts` — on open, if URL matches `/chat/:conversationId` and the conversation is dispatched (check via `GET /api/relay/health?dispatched=true` or equivalent), set `isMirrorActive = true`. Every outbound user message also WS-publishes a `mirror-message` to desktop. Every inbound assistant token/chunk ditto.
- [ ] `mobile/components/chat/ChatPage.tsx` — when `isMirrorActive`, show a small "Connected from desktop" badge at top; otherwise render as today. On WS `dispatch-end`, clear the badge.

#### Chat input rescue (regression fix — must ship with this track)

- [ ] `mobile/components/chat/ChatInput.tsx` — reproduce the reported breakage (textarea refuses input, send button inert). Likely suspects:
  - `disabled` or `readOnly` stuck `true` from a stale store value (connection state? keyboard state? dispatch state?)
  - `pointer-events: none` inherited from an overlay (activity status, push permission banner, bulletin FAB)
  - Focus being stolen by an ancestor on mount
  - `onChange` wired but `value` not updating because the store's setter is a no-op in the current branch
  - iOS PWA viewport-unit bug — input pushed out of bounds when on-screen keyboard opens
  - Send button calls a handler that throws synchronously and swallows — check devtools console
- [ ] `mobile/stores/useChatStore.ts` — audit `input`, `setInput`, `isComposing`, `isSending` state flags. Make sure the composer's local state is not getting clobbered by a `reset` triggered by unrelated store events. Confirm `isSending` actually clears after the SSE stream closes.
- [ ] Verify endpoint selection: mobile should POST to `/api/relay/chat` when the mobile PWA is talking to the hosted Fly relay (production), or direct to the local backend's equivalent if the app detects a LAN-reachable backend. Grep the mobile client for `/api/` calls; fix any that are 404ing or going to a stale path. No `/api/harper/chat` from mobile unless specifically intended.
- [ ] Verify `/chat/:conversationId` route actually mounts `ChatPage.tsx` — last branch reshuffled mobile routing and this may have drifted.

#### RiskFlow headline picker modal

- [ ] `mobile/components/chat/HeadlineAttachModal.tsx` — **new**. Bottom-sheet style modal (monochrome, flat, no gradients). Fetches `GET /api/riskflow/feed?limit=50`, groups by source/category, user can multi-select. Selected items persist into composer local state as `attachedHeadlines: RiskFlowItem[]`.
- [ ] `mobile/components/chat/ChatInput.tsx` — add a Newspaper/rss icon button that opens `HeadlineAttachModal`. Above the textarea (or inside an expanding action sheet), show a row of chips for currently attached headlines with X buttons to remove.
- [ ] Payload: include `attachedHeadlines` in the chat request body (`body.riskFlowContext` if the existing relay payload already carries a field named that, reuse it; otherwise add `body.headlines: { id, title, source, url, scoredAt }[]`). Backend: confirm the `/api/relay/chat` → local backend handoff and `/api/ai/chat` both accept + forward this into the Harper/Opus system prompt with a clear "ATTACHED HEADLINES" block so the agent knows these are user-selected context, not ambient feed.
- [ ] Mobile API client (`mobile/lib/backendClient.ts` or equivalent) — add a helper `getRiskFlowFeed(limit)` with auth header. No bare `fetch` from the modal.

#### Image attachments

- [ ] `mobile/components/chat/ChatInput.tsx` — add a Camera/Paperclip icon button. On tap, open a native file picker (`<input type="file" accept="image/*" capture="environment">`) that supports camera + library. Multiple selection supported.
- [ ] Preview row above the textarea: thumbnails with X buttons. Tap thumbnail to expand; tap X to remove.
- [ ] Upload strategy: for the size budget, convert to base64 data URLs up to ~1 MB per image (resize client-side if larger), pass in request as `body.images: string[]` (matches existing relay payload field in `routes/relay.ts`). Anything above ~4 MB total aborts with a user-facing toast — don't silently drop.
- [ ] Backend wiring sanity: confirm `/api/relay/chat` forwards `images` through to the local backend's chat handler; confirm the Harper/Opus chat path actually sends images as vision content blocks (Anthropic `image` content type) — if it's been dropping them upstream, fix at the point of origin, not by papering over in mobile.
- [ ] Do NOT commit any uploaded test images. Confirm `.gitignore` covers `mobile/public/test-images/` or similar if used for dev.

### Inline Ultrareview fixups (batched into this track)

- [ ] `backend-hono/src/routes/agent-bus/dreams.ts:57` — change `.order("created_at", { ascending: true })` → `.order("created_at", { ascending: false })`. Matches in-memory fallback semantics and the migration's `idx_agent_dreams_created (created_at desc)` index. 1-line fix.
- [ ] `backend-hono/src/services/feature-flag-service.ts:25` — add `envInverse: true` to the `oracle_research` registry entry so `getFlag("oracle_research")` returns `true` when `ORACLE_RESEARCH_ENABLED` is unset, matching the scheduler's `!== "false"` opt-out semantics at [oracle-research-scheduler.ts:81](backend-hono/src/services/cron/oracle-research-scheduler.ts:81). Consider also flipping the registry `default` to `true` for coherence. 1-line fix.

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/agent-memory/outcome-tracker.ts` — already fixed in commit `b9482f9` (passthrough validator). Ultrareview re-flagging it is a stale snapshot; do not revert or duplicate.
- `backend-hono/src/services/agent-memory/feedback-composer.ts` and `types.ts` — already fixed in `b9482f9`.
- `.cursor/environment.json` and `.cursor/install.sh` — landed in `5640773` and work; leave alone.
- `mobile/components/home/HomePage.tsx` and all non-chat mobile surfaces — out of scope.
- The briefing/MDB button logic itself — keep its current wiring; only its neighbor (relay) is changing location.
- The pickup-code clipboard flow can be preserved as a fallback for cold-mobile cases, but this sprint does not require it. If removed, add a regression note in the commit body.

## Known Issues to Preserve (from changelog)

- **S23-T3 Aquarium surface flag** in `FintheonComposer.tsx` — when editing the composer, do not drop the `activeConnectors.includes("aquarium")` auto-append or the `surface` prop forwarding. The new relay button renders in the action cluster; leave the Aquarium wiring untouched.
- **S20-T6 conversation persistence** in `backend-hono/src/routes/relay.ts` — the existing `POST /chat` handler now has an IDOR ownership check (my S21 security fix). The three new routes in this brief follow the same ownership pattern. Do not weaken `/chat`'s check when adding new routes.
- **Doto digits revert** in `frontend/fonts.css` — do not reintroduce Doto for digits anywhere, including the new "Chatting on iPhone" banner or disconnect button label.
- **No gradients, no colored emojis, no Kanban borders** — dispatched banner uses flat Solvys Gold text on BG; disconnect button is a flat outlined button.

## Implementation Steps

### Wave A — Backend plumbing (start here, least UI-dependent)

1. Extend `relay-bridge.ts` with dispatch state + mirror-message pub/sub. Pure TS, no routes yet.
2. Add `POST /dispatch`, `POST /disconnect`, `GET /mirror-stream` to `relay.ts`. Each calls into `relayBridge`. All three ownership-gated by `getConversation(convId, userId)`.
3. Extend `relay-ws.ts` to handle inbound `mirror-message` and `dispatch-ack` WS frames.
4. `cd backend-hono && bun run build` — must be clean before touching frontend.
5. Smoke test each route with `curl` against localhost (`launchctl unload` / `load` the plist first).

### Wave B — Frontend hook + store + UI

6. Create `frontend/stores/useRelayStore.ts` (zustand).
7. Create `frontend/hooks/useRelayDispatch.ts` that consumes the store, polls `/api/relay/health`, and wraps `dispatch()` / `disconnect()` calls plus SSE subscription to `/mirror-stream`.
8. Remove relay button JSX + `handleRelay` from `ChatHeader.tsx`.
9. Add relay button JSX to `FintheonComposer.tsx`'s left action cluster. Disconnect variant renders in the same slot when `isDispatched === true`. Use a single button with icon swap (Radio → PlugZap / X), no color-theme violations.
10. Mirror the same addition to `ChatInterface.tsx` for the main Ask Harp surface.
11. Render "Chatting on {deviceLabel}" banner above the composer in both surfaces when `isDispatched`.
12. Pipe `mirrorMessages` from the store into `FintheonThread.tsx` rendering when the active conversation is dispatched.

### Wave C — Mobile (expanded: chat input rescue + headline picker + images)

13. **First — reproduce the chat input failure** on a real device or iOS simulator / Chrome DevTools mobile emulation. Capture the exact symptom: is the textarea focusable? Does `onChange` fire? Does send button trigger any network call (check devtools Network tab)? Write one sentence of root cause before changing code.
14. Fix the chat input breakage in `mobile/components/chat/ChatInput.tsx` + `mobile/stores/useChatStore.ts`. Confirm: tap input → keyboard opens → characters appear in textarea → tap send → network request fires → SSE stream returns tokens → assistant bubble renders.
15. Verify mobile endpoint delivery: `/api/relay/chat` (when via hosted Fly relay) vs `/api/ai/chat` (direct). Trace one send end-to-end with the Network tab and confirm the request lands on the intended handler in backend logs.
16. Extend the mobile service worker push handler to recognize `relay-dispatch` payloads and open the deep link.
17. In `useChatStore.ts`, detect mirror mode and WS-publish outbound/inbound messages.
18. Add "Connected from desktop" badge to `ChatPage.tsx`.
19. Build `HeadlineAttachModal.tsx`; wire icon button in `ChatInput.tsx` to open it; persist selections into composer state; include in outgoing payload.
20. Add image picker (file input + camera) to `ChatInput.tsx`; client-side resize/base64 encode; include as `images[]` in payload; render thumbnails above textarea.
21. End-to-end verify: send a message with (a) 2 attached RiskFlow headlines and (b) 1 camera-roll image → Harper's reply references the specific headline titles and describes the image content. If Harper ignores them, fix the upstream prompt assembly.

### Wave D — Ultrareview fixups

22. Flip `dreams.ts` GET ordering to `{ ascending: false }`.
23. Add `envInverse: true` to `oracle_research` flag entry in `feature-flag-service.ts`.

### Wave E — Validation + changelog + commit

24. `rm -rf frontend/dist && npx vite build --config frontend/vite.config.ts`.
25. `rm -rf mobile/dist && cd mobile && bun run build` — mobile build must be clean.
26. `cd backend-hono && bun run build`.
27. `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist && launchctl load …` — restart local backend.
28. **Desktop → mobile dispatch E2E**: click relay on desktop with mobile paired → push arrives → mobile opens to chat → desktop composer locks, banner shows → type message on mobile → appears on desktop in real time → click disconnect on desktop → mobile badge clears, desktop composer re-enables.
29. **Mobile chat input E2E (regression guard)**: open mobile chat → type a message → send → observe SSE tokens streaming in → assistant response renders. Must work both when connected via relay AND when connected directly.
30. **RiskFlow headline attach E2E**: open mobile chat → tap headline icon → modal loads RiskFlow items → select 2 → send a message referencing them → Harper's reply names the specific headlines.
31. **Image attach E2E**: open mobile chat → tap camera icon → pick a real photo → send with a short caption → Harper's reply describes the image content. Also try with a headline attached at the same time — both context types co-exist.
32. Dreams endpoint sanity: `curl -s http://localhost:8080/api/agent-bus/dreams | jq '.dreams | [.[0].created_at, .[-1].created_at]'` — first element must be most recent.
33. Oracle flag sanity: `ORACLE_RESEARCH_ENABLED` unset → `getFlag("oracle_research")` returns `true`.
34. Add one changelog entry in `src/lib/changelog.ts` summarizing the batch (dispatch + mobile input fix + headline attach + image attach + 2 fixups).
35. Commit + push to `s20-agent-swarm-platform-ops`. Tag as `v5.19.0`.

**Victory condition: every E2E in steps 28–31 passes on a real mobile browser or device. Do not claim done from `tsc --noEmit` alone.**

## Acceptance Criteria

### Relay dispatch (desktop ↔ mobile)

- [ ] Relay button appears in the chat input bar of both the sidebar chat and the main Ask Harp chat. Not in `ChatHeader` anymore.
- [ ] Button is disabled (monochrome + tooltip "Connect Fintheon mobile") when `/api/relay/health` reports mobile offline.
- [ ] Clicking relay when mobile is online sends a web-push, switches the desktop surface into mirror mode, and replaces the relay button with a Disconnect button.
- [ ] Messages typed on mobile appear on the desktop thread in real time while dispatched.
- [ ] Desktop composer textarea is disabled (not just hidden) while dispatched; placeholder reads "Chatting on {device} — click Disconnect to resume here".
- [ ] Clicking Disconnect on desktop fires `POST /api/relay/disconnect`, the mobile badge clears, the desktop composer re-enables, and the conversation remains in both histories.

### Mobile chat (baseline must work)

- [ ] Mobile chat textarea accepts keyboard input and visibly updates on every keystroke.
- [ ] Mobile send button posts to the correct endpoint for the current connection mode (relay vs direct), no 404s, no orphaned messages.
- [ ] Assistant response streams in via SSE and renders progressively (not all at once at the end, not never).
- [ ] `isSending` state clears after stream close; user can immediately send a follow-up message.

### RiskFlow headline attach

- [ ] Mobile composer has a headline icon that opens `HeadlineAttachModal`.
- [ ] Modal lists current RiskFlow items with title + source + time-ago.
- [ ] User can multi-select, selections show as removable chips above the textarea.
- [ ] Send includes the selected headlines in the payload; Harper's reply names the specific headlines the user attached.

### Image attach

- [ ] Mobile composer has a camera/attach icon that opens a file picker (camera + library).
- [ ] Selected images render as thumbnails above the textarea, removable.
- [ ] Payload includes `images[]`; total size capped with user-facing error if exceeded (no silent drop).
- [ ] Harper actually describes the image content in its reply (vision pipeline is wired).

### Fixups

- [ ] `/api/agent-bus/dreams` returns newest-first in the Supabase branch, matching the in-memory fallback.
- [ ] With `ORACLE_RESEARCH_ENABLED` unset, both the scheduler runs AND `getFlag("oracle_research")` returns `true`.

### Build + style

- [ ] Frontend `tsc --noEmit` clean, mobile `tsc --noEmit` clean, backend `bun run build` clean.
- [ ] `rm -rf frontend/dist && vite build` succeeds; `rm -rf mobile/dist && bun run build` in `mobile/` succeeds.
- [ ] One changelog entry added.
- [ ] No introduction of gradients, colored emojis, or Kanban borders per [CLAUDE.md](CLAUDE.md).
- [ ] **All E2E scenarios in Implementation steps 28–31 executed on a real device or mobile-emulated browser. Green-path AND one failure-path each.** Don't declare victory without this.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf frontend/dist && npx vite build

# Backend build
cd backend-hono && bun run build && cd ..

# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
sleep 3 && curl -s http://localhost:8080/api/diagnostics | head -c 400

# Relay dispatch smoke test (requires a valid Supabase JWT in $TOKEN)
curl -s -X POST http://localhost:8080/api/relay/dispatch \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"conversationId":"<uuid>"}'

# Dreams ordering check
curl -s http://localhost:8080/api/agent-bus/dreams | \
  jq '.dreams | [.[0].created_at, .[-1].created_at]'

# Oracle flag check (after restart with ORACLE_RESEARCH_ENABLED unset)
# Expect: scheduler logs "Oracle research scheduler started" AND getFlag returns true
grep 'Oracle research scheduler' /tmp/fintheon-backend.log | tail -2
```

## Commit Format

```
[v5.19.0] feat: S21-T1 relay dispatch mirror (desktop ↔ mobile) + Ultrareview fixups

- Move relay button from ChatHeader to composer action cluster on both
  sidebar and main Ask Harp chats.
- Add POST /api/relay/dispatch + /disconnect + GET /mirror-stream, all
  ownership-gated via getConversation().
- Extend relay-bridge with dispatch state + mirror-message pub/sub; relay-ws
  handles inbound mirror-message and dispatch-ack from mobile.
- Web-push payload {type:"relay-dispatch"} opens mobile PWA to the conversation;
  mobile auto-enters mirror mode, WS-publishes every message back to desktop.
- Desktop locks composer while dispatched, shows "Chatting on {device}" banner,
  renders mirrored messages in the thread, disconnect button tears down session.
- Fixup: backend-hono/src/routes/agent-bus/dreams.ts — GET now orders
  created_at DESC (was ASC, returned oldest 50 once table exceeded 50 rows).
- Fixup: backend-hono/src/services/feature-flag-service.ts — oracle_research
  entry gets envInverse:true so getFlag() matches the scheduler's opt-out
  semantics on ORACLE_RESEARCH_ENABLED.
```

## Unification

This is a single-track sprint. **No separate unification track.** The orchestrating Claude Code instance (the one implementing T1) is responsible for end-to-end integration verification in Wave E steps 18–23. If implementation slips (e.g., mobile work can't land in the same pass), split it out as S21-T2 in a follow-up `/solvys-orchestrate` and re-plan.
