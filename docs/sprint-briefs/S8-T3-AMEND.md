# S8-T3 AMENDMENT: Rope Engine — Apparatus Ropes

**Branch**: `v.8.28.1`
**Context**: T3 is 86% done. All Observatory ropes work. Only Apparatus ropes are missing.

## THE GAP

### Apparatus Ropes (NOT DONE)
The brief called for rope connections between related commandments in `ApparatusPage.tsx`. Current implementation is a card-based grid — no constellation visualization, no ropes between cards.

## FILE TO MODIFY
- `frontend/components/apparatus/ApparatusPage.tsx`

## IMPLEMENTATION
The Apparatus doesn't need a full React Flow constellation. Instead, add SVG connection lines between related agent cards when expanded:

1. Read the `CONNECTIONS` array already defined in ApparatusPage.tsx (~line 147-155)
2. When an agent card is expanded, draw subtle SVG lines from that card to its connected agents
3. Use the same rope visual style as Observatory: `smoothstep`-like bezier, thread-colored, 0.15 opacity, breathing animation
4. Implementation approach:
   - Add an SVG overlay `<svg className="absolute inset-0 pointer-events-none">` inside the grid container
   - For each connection where `from` or `to` matches `expandedAgent`, draw a `<path>` using card bounding rects
   - Use `AGENT_COLORS` or agent `accentColor` for stroke color
   - Animate with `rope-breathe` class from index.css

## VERIFICATION
1. Click an agent card to expand it
2. SVG lines appear connecting to related agents
3. Lines are subtle (low opacity), colored, breathing
4. Lines disappear when card collapses
5. `npx vite build` — clean

## DO NOT
- Do NOT convert Apparatus to React Flow — keep the card grid
- Do NOT modify Observatory ropes (they work)
- Do NOT touch backend
