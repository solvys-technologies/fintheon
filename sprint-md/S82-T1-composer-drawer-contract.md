# Sprint Brief: S82-T1 -- Composer Drawer Contract

## Context

All chat input bars should behave like one product surface. The current NarrativeFlow skills/connectors drawer is the visual anchor, but it must be slightly wider than the input, darker, and shared across main chat, NarrativeFlow, attachment, RiskFlow, queue/todo, modal, toast, popover, and sidebar panel surfaces.

## Scope

- Use `@sprint-md/S82-T1-composer-drawer-contract.md` in Linear issue descriptions.
- Linear issue: `SOL-185`.
- Branch target: `sprint/S82`.
- Replace full-width black footer/header slabs with bounded fades that do not cover content.
- Make NarrativeFlow composer match the main CAO chat composer and remove catalyst count/status text from the bar.
- Use one darker overlay surface token for drawers, modals, toasts, popovers, sheets, and liquid panels.
- Ensure composer drawers are 5-8% wider than the input bar and remain responsive.

## Files

- Owned: `frontend/index.css`, `frontend/components/ChatInterface.tsx`, `frontend/components/ui/chatgpt-prompt-input.tsx`, `frontend/components/chat/*`, `frontend/components/narrative/NarrativeInputBar.tsx`, `frontend/components/narrative/NarrativeFlowLanding.tsx`.
- Avoid: Econ Calendar iframe logic and backend mention service.

## Acceptance

- Main chat skills/connectors, attachments, RiskFlow attachments, NarrativeFlow opener, and loaded NarrativeFlow workspace share the same drawer geometry.
- No infinitely wide black strip appears above or below main content.
- `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- `rm -rf frontend/dist && cd frontend && bun run build` passes.
