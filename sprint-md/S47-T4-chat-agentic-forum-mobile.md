# Sprint Brief: T4 -- Chat, Agentic Forum, Mobile Response, Attachments, and Approvals

## Context

Chat and Agentic Forum are showing raw JSON, losing completed runs, resetting greetings, and failing on mobile response render. This track owns conversational UX and persistence, excluding the voice-engine replacement and shared icon/spinner system.

## Branch Target

`s47-wave2-chat-forum`

## Scope -- Included

- [ ] Fix chat greeting/suggestion chips reappearing after send.
- [ ] Purge visible Omi connector references and dead connectors.
- [ ] Add PDF and `.md` document attachment support for CAO chat.
- [ ] Fix attach modal/jump-to-bottom false positive.
- [ ] Fix mobile chat final response rendering after thinking completes.
- [ ] Replace RiskFlow Chat CTA raw JSON injection with preview card context.
- [ ] Add approval modal for tools/Narratives/Catalyst Watch/Refinement edits with admin password gate.
- [ ] Rework Agentic Forum run UX: no raw JSON, persistent expandable run cards, run history, plan-mode preflight.
- [ ] Remove Agentic Forum search, refresh, activity, and thinking buttons.
- [ ] Replace online/offline status with progress/elapsed thought-time.

## Scope -- Excluded (DO NOT TOUCH)

- Voice engine/VibeVoice and commentary transcript ingestion owned by T5.
- Shared spinner/icon primitives owned by T6.
- Arbitrum visual cards outside Agentic Forum owned by T3.
- Backend market-data/source filtering owned by T1.

## Reuse Inventory

- `ChatInterface` at `frontend/components/ChatInterface.tsx:196` -- main CAO chat wrapper.
- `FintheonComposer` at `frontend/components/chat/FintheonComposer.tsx` -- chat input/composer.
- `FintheonThread` at `frontend/components/chat/FintheonThread.tsx` -- message rendering/reasoning panes.
- `ChatGreeting` at `frontend/components/chat/ChatGreeting.tsx` -- greeting/suggestion chip source.
- `HeadlinePickerPopover` at `frontend/components/chat/HeadlinePickerPopover.tsx` -- existing headline context picker.
- `PromptBox` at `frontend/components/ui/chatgpt-prompt-input.tsx` -- Boardroom/Agentic composer.
- `AgentChattr` at `frontend/components/consilium/AgentChattr.tsx:216` -- Agentic Forum UI.
- `BoardroomAgentPanel` at `frontend/components/consilium/BoardroomAgentPanel.tsx:86` -- per-agent streaming panel with JSON suppression.
- `parseAgentText` at `frontend/lib/agentStreamParser.ts:44` -- strips JSON and derives KPIs.
- `useBoardroomDAG` at `frontend/hooks/useBoardroomDAG.ts` -- DAG run streaming hook.
- `boardroomThreadStore` at `frontend/lib/boardroomThreadStore.ts` -- completed DAG persistence.
- `boardroom-store.ts` at `backend-hono/src/services/boardroom-store.ts` -- boardroom session/message storage.
- `backend-hono/src/routes/documents/index.ts` -- existing documents route if present for attachment reuse.

## Known Issues to Preserve

- CAO chat history and auth must not regress.
- Mobile PWA input fixes in prior changelog must not be reverted.
- The Agentic Forum may still use `boardroom` route names internally; visible copy should be Agentic Forum where appropriate.
- No emoji icons in agent messages; backend `boardroom-spawner.ts` currently has emoji strings and must be cleaned if touched.

## Implementation Steps

1. Fix greeting state: only render greeting/suggestion chips when the active thread has zero user/assistant messages and no in-flight request.
2. Audit connector source list in chat. Remove Omi and dead connectors. Keep VProxy/Hermes/MCP/API tools that actually work plus RiskFlow.
3. Add attachment accept rules to composer: `.pdf`, `.md`, MIME PDF and Markdown/plain text only. Reject all others client-side with toast.
4. Add/extend backend document parsing route. Use existing document route if suitable; otherwise create narrow route with auth, size limit, file type validation, text extraction, and summary handoff. Do not parse arbitrary binary formats.
5. Pass parsed document context to Harper request metadata; avoid dumping full large documents into every prompt when a summary/context id is available.
6. Fix jump-to-bottom visibility/position when attach modal is open by checking modal open state and scroll container bounds.
7. Reproduce mobile chat failure. Trace mobile hook from send to stream done to final assistant append. Fix the final state transition that drops response after thinking.
8. Replace RiskFlow `Chat CTA` payload with a structured preview card: headline, notched fuse value, source, time ago, and hidden structured context.
9. Add shared approval modal component for tool/add/edit approvals with admin password gate. Use existing `RefinementEditLockModal`/dev-settings auth as reference.
10. In Agentic Forum, remove search, refresh, activity, and thinking button controls. Add run-history button.
11. Add run record type/table or reuse `boardroom_threads` only if it can store run prompt, plan, agent outputs, KPIs, elapsed time, status, timestamps, and markdown final card.
12. Add pre-run plan modal: multiple-choice run type/reason, CAO markdown plan in right popover, CTAs `Send to desk` and `Keep editing`.
13. Stop auto-collapsing analyst panels when Harper begins. Completed outputs must persist as expandable cards.
14. Ensure no raw JSON renders. Prompt agents to output prose plus structured metadata, and keep parser as defensive cleanup.
15. Add/update changelog entry.

## Acceptance Criteria

- [ ] Chat greeting does not reappear after sending a message.
- [ ] Mobile chat renders the final assistant response after thinking.
- [ ] PDF/Markdown attachments parse and pass safe context to CAO chat.
- [ ] RiskFlow chat CTA inserts a preview card, not raw JSON.
- [ ] Agentic Forum runs persist, expand, and reopen from history.
- [ ] No raw JSON is visible in Agentic Forum panels/cards.

## Validation Commands

```bash
# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Mobile type/build gate if mobile files changed
cd mobile && npx tsc --noEmit

# Clean frontend build
rm -rf dist && npx vite build

# Backend build if routes/services changed
cd backend-hono && bun run build
```

## Commit Format

```bash
[v5.34.0] fix: T4 repair chat and Agentic Forum UX
```
