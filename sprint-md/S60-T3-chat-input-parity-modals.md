# Sprint Brief: S60-T3 -- Chat Input Parity + Modal Ecosystem

## Context

After runtime migration, chat input behavior must remain feature-parity: plan mode, todo toggles, approval/custom-response flow compatibility, provider selection, skills/tools toggles, and connector controls. We also need dedicated plugin/MCP/provider modal affordances attached to the composer ecosystem without changing Fintheon layout language.

## Branch Target

`s60-openagents-plane-loop`

## Scope -- Included

- [ ] Preserve and verify plan mode UX and todo flow in composer.
- [ ] Preserve approvals/custom-response interaction path compatibility with runtime changes.
- [ ] Add/upgrade plugin + MCP + provider modal surfaces tied to input bar controls.
- [ ] Keep compact and full composer variants aligned.
- [ ] Maintain current provider/key hint behavior.

## Scope -- Excluded (DO NOT TOUCH)

- Runtime core wiring files (T2).
- Refinement Plane UI files (T1).
- Backend webhook/integration files (T4/T5).
- Shared route/changelog files (T6).

## File Ownership

- `frontend/components/chat/FintheonComposer.tsx`
- `frontend/components/ui/chatgpt-prompt-input.tsx`
- `frontend/components/chat/ProviderDropdown.tsx`
- `frontend/components/chat/ToolsDropdown.tsx`
- `frontend/components/chat/FintheonProviderModal.tsx` [NEW -- to create]
- `frontend/components/chat/FintheonMcpModal.tsx` [NEW -- to create]
- `frontend/components/chat/FintheonPluginModal.tsx` [NEW -- to create]

## Reuse Inventory

- `frontend/components/chat/FintheonComposer.tsx:101` -- plan mode state and todos.
- `frontend/components/ui/chatgpt-prompt-input.tsx:616` -- bottom toolbar structure and slots.
- `frontend/components/chat/ProviderDropdown.tsx:76` -- provider state hook + storage.
- `frontend/components/chat/ToolsDropdown.tsx:63` -- skills + connectors combined control.

## Known Issues to Preserve

- Keep compact-mode spacing behavior fixed in composer.
- Do not break slash command, history recall, or image attach flows.
- Preserve Solvys styling restrictions (no gradients/emojis/kanban borders).

## Implementation Steps

1. Extract provider/tool connector lists into modal-friendly data models where needed.
2. Add modal components for provider, MCP connectors, and plugins; keep them composer-anchored.
3. Wire modal triggers from existing toolbar controls (compact/full variants).
4. Ensure plan mode button and todo list behavior remains unchanged.
5. Ensure approvals/custom-response actions still pass through runtime APIs.
6. Verify keyboard shortcuts (`/plan`, `/stop`, arrow history, Cmd/Ctrl+K) still work.

## Acceptance Criteria

- [ ] Plan mode + todos work exactly as before.
- [ ] Provider selection and key-hint behavior unchanged.
- [ ] Skills/connectors are accessible through modalized controls from composer.
- [ ] Compact and full composer variants remain aligned and non-overflowing.
- [ ] No regression in slash commands, attachments, or send/stop controls.

## Validation Commands

```bash
# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf frontend/dist && cd frontend && bun run build && cd ..
```

## Commit Format

```
[v6.1.0-alpha] feat: T3 preserve composer parity and add input-bar modal controls
```
