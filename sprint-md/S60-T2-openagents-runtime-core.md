# Sprint Brief: S60-T2 -- Open-Agents Runtime Core Migration

## Context

Global chat runtime currently flows through assistant-ui + `useAISDKRuntime` + Strands/Hermes transport wrappers. We need to replace the runtime layer with open-agents.dev SDK globally (analysis chat, sidebar chat, floating chat) while preserving message flow, conversation persistence, request IDs, and surface-specific session isolation.

## Branch Target

`s60-openagents-plane-loop`

## Scope -- Included

- [ ] Add open-agents SDK runtime dependency for frontend.
- [ ] Introduce runtime adapter hook that maps open-agents runtime APIs to current thread usage.
- [ ] Migrate `ChatInterface`, `ChatSidebar`, and `FintheonFloatingChat` to the new runtime provider.
- [ ] Preserve existing conversation hydration behavior and per-surface conversation IDs.
- [ ] Preserve request ID propagation for cognition panel use.

## Scope -- Excluded (DO NOT TOUCH)

- Composer toolbar/modals/plan-mode UX files (T3).
- Refinement/Plane UI files (T1).
- Backend integration/webhook files (T4/T5).
- Shared route mounts and changelog (T6).

## File Ownership

- `frontend/package.json`
- `frontend/bun.lock` (or lockfile used by package manager)
- `frontend/components/chat/useHermesRuntime.ts`
- `frontend/components/chat/hooks/useHermesChat.ts`
- `frontend/components/ChatInterface.tsx`
- `frontend/components/chat/ChatSidebar.tsx`
- `frontend/components/chat/FintheonFloatingChat.tsx`
- `frontend/components/chat/hooks/useOpenAgentsRuntime.ts` [NEW -- to create]

## Reuse Inventory

- `frontend/components/chat/useHermesRuntime.ts:11` -- current runtime boundary.
- `frontend/components/chat/hooks/useHermesChat.ts:79` -- transport + hydration semantics.
- `frontend/components/ChatInterface.tsx:269` -- runtime provider mount.
- `frontend/components/chat/ChatSidebar.tsx:240` -- sidebar runtime provider mount.
- `frontend/components/chat/FintheonFloatingChat.tsx:151` -- floating runtime provider mount.

## Known Issues to Preserve

- Conversation hydration fallback on 404 must still clear stale IDs.
- DeepSeek direct provider routing for Harper remains intact.
- Existing `X-Request-Id` capture and cognition stream behavior must not regress.

## Implementation Steps

1. Add open-agents SDK package(s) to frontend dependencies.
2. Create `useOpenAgentsRuntime.ts` adapter that:
   - wraps existing send/stop/stream lifecycle,
   - keeps current conversation ID and error semantics,
   - exposes a provider-compatible runtime object.
3. Update `useHermesRuntime.ts` to delegate runtime creation to open-agents adapter.
4. Update `ChatInterface`, `ChatSidebar`, and `FintheonFloatingChat` runtime provider imports/usages.
5. Keep `useHermesChat` transport semantics intact unless adapter requires minimal shape changes.
6. Validate all three chat surfaces send/receive and stop stream correctly.

## Acceptance Criteria

- [ ] Analysis chat, sidebar chat, and floating chat all run on open-agents runtime.
- [ ] Conversation history still hydrates across reload/surface switching.
- [ ] Stop/cancel behavior still interrupts active streams.
- [ ] Cognition panel still receives request IDs and updates.
- [ ] No visible UI regression in message render/composer placement.

## Validation Commands

```bash
# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf frontend/dist && cd frontend && bun run build && cd ..
```

## Commit Format

```
[v6.1.0-alpha] feat: T2 migrate global chat runtime to open-agents adapter
```
