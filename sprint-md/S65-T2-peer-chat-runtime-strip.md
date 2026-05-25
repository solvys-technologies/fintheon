# Sprint Brief: T2 -- Strip Peer Chat from Runtime App

## Context

Peer Chat was added to the app-facing Apparatus surface, but the user clarified it should never have been a frontend/backend product feature. The only intended peer communication path is development-only agent coordination for other developers' agents. This track removes Peer Chat UI, API endpoints, service code, and runtime type surface while preserving non-chat peer functionality that still supports Team, desks, voice, round-robin registration, and RiskFlow worker coordination.

## Branch Target

`sprint/S65`

## Scope -- Included

- [ ] Remove `peer-chat` from Apparatus navigation in `frontend/components/consilium/ConsiliumTabConfig.ts`.
- [ ] Remove `PeerChat` imports/rendering and local peer hook usage in `frontend/components/consilium/ConsiliumHub.tsx`.
- [ ] Delete `frontend/components/peers/PeerChat.tsx` if no live imports remain.
- [ ] Remove `/api/peers/chat/*` endpoints and `peer-chat` service imports from `backend-hono/src/routes/peers/index.ts`.
- [ ] Delete `backend-hono/src/services/peers/peer-chat.ts` if no live imports remain.
- [ ] Remove Peer Chat message/conversation/handoff-only types from `backend-hono/src/types/peers.ts`.
- [ ] Update `.cursor/rules/agent-orchestration.md` to describe development-only agent coordination through the repo/MCP workflow, not app runtime UI.
- [ ] Sweep user-visible labels/comments that say Peer Chat is visible in the app.

## Scope -- Excluded (DO NOT TOUCH)

- Do not delete `backend-hono/src/services/peers/peer-registry.ts`, `desk-manager.ts`, `voice-room.ts`, or `shared-memory.ts` unless a reference is purely chat-only and proven dead.
- Do not delete `frontend/components/peers/DeskPanel.tsx`, `VoiceWidget.tsx`, `VoiceAudioRenderer.tsx`, or `types.ts` unless no runtime import remains and the user explicitly expands scope.
- Do not remove peer bootstrap scripts, Team panel registration, RiskFlow round-robin behavior, bulletin tables, or any non-chat "peer" concept.
- Do not edit settings, layout chrome, updater, terminal, or RiskSignal files owned by other tracks.

## Reuse Inventory

- Apparatus sub-view union at `frontend/components/consilium/ConsiliumTabConfig.ts:21` currently includes `"peer-chat"`.
- Apparatus menu entry at `frontend/components/consilium/ConsiliumTabConfig.ts:110` labels Peer Chat as product UI.
- Peer Chat render path at `frontend/components/consilium/ConsiliumHub.tsx:1015` mounts the app UI.
- Peer Chat endpoints start at `backend-hono/src/routes/peers/index.ts:230`.
- Peer Chat service starts at `backend-hono/src/services/peers/peer-chat.ts:1`.
- Peer Chat backend types start at `backend-hono/src/types/peers.ts:59`.
- Agent orchestration rule currently says peers are visible in the app at `.cursor/rules/agent-orchestration.md:42`.

## Known Issues to Preserve

- There is broader "Claude Peers" infrastructure that is not the same as Peer Chat. Preserve registration, desk assignment, voice room, shared memory, and round-robin feed coordination unless a symbol is exclusively chat.
- The user specifically wants development coordination to be repo/dev-only, not a frontend or production backend dependency.
- Keep file removals surgical. Broad `rg peer` results include valid features and historic changelog entries.
- Do not rewrite old changelog history except adding the final S65 changelog entry in unification.

## Implementation Steps

1. Run `rg -n "PeerChat|peer-chat|peers/chat|Peer Chat|PeerConversation|PeerChatMessage|PeerHandoff" frontend backend-hono .cursor AGENTS.md CLAUDE.md WORKSPACE.md` and save the relevant hits for verification.
2. In `ConsiliumTabConfig.ts`, remove the `Radio` import if it is only for Peer Chat, remove `"peer-chat"` from `ApparatusSubView`, and delete the Peer Chat menu entry.
3. In `ConsiliumHub.tsx`, remove the `PeerChat` import, remove `useLocalPeer` usage if no longer needed, and delete the `displayedApparatusSub === "peer-chat"` render branch.
4. Confirm `frontend/hooks/useLocalPeer.ts` is not imported elsewhere. If it becomes dead and only existed for Peer Chat, delete it.
5. Delete `frontend/components/peers/PeerChat.tsx` after confirming no imports remain.
6. In `backend-hono/src/routes/peers/index.ts`, remove the `peer-chat.js` service import block and delete the `/chat/send`, `/chat/conversations`, `/chat/messages/:conversationId`, `/chat/conversations/:id/read`, `/chat/unread/:peerId`, and `/chat/conversation` handlers.
7. Delete `backend-hono/src/services/peers/peer-chat.ts` after confirming no imports remain.
8. In `backend-hono/src/types/peers.ts`, remove chat-only types/interfaces. Keep `User`, `ClaudePeer`, `Desk`, `PeerRegistration`, and `HeartbeatPayload`.
9. Rewrite `.cursor/rules/agent-orchestration.md` section lines 35-124 so it no longer claims an in-app Peer Chat panel or runtime `/api/peers/chat/*` protocol. Document dev-only coordination through repository instructions and MCP/Claude Peers if configured.
10. Run the verification commands and rerun `rg` to confirm no live runtime Peer Chat path remains.

## Acceptance Criteria

- [ ] No `Peer Chat` item appears in Consilium/Apparatus UI.
- [ ] No frontend import of `PeerChat` remains.
- [ ] No `/api/peers/chat/*` runtime endpoints remain.
- [ ] Peer registration, Team panel, desk assignment, voice room, and RiskFlow peer/round-robin behavior still compile.
- [ ] `.cursor/rules/agent-orchestration.md` frames agent coordination as development-only.
- [ ] `rg -n "PeerChat|peer-chat|peers/chat|Peer Chat"` returns only archived changelog/history or explicitly dev-only docs.

## Validation Commands

```bash
# Confirm runtime references are gone or dev-only
rg -n "PeerChat|peer-chat|peers/chat|Peer Chat" frontend backend-hono .cursor AGENTS.md CLAUDE.md WORKSPACE.md

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build
```

## Commit Format

```text
[v6.1.0] fix: S65-T2 strip peer chat from runtime app
```
