# S71-T1: NarrativeFlow Full Catalyst Map + Narrative Boundaries

## Summary

Add a full-map view back to NarrativeFlow so users can view the complete catalyst universe, not only the query-generated sensemaking map. The view should preserve S71's chat-input-focused workflow while giving traders a canvas-level way to inspect all catalysts and their narrative groupings.

## Scope

- Add a NarrativeFlow full-map mode that renders all available catalysts on the canvas.
- Show per-narrative boundaries so each narrative cluster has a visible grouping region.
- Preserve the S71 attached-headline sensemaking flow and do not replace the default blank/chat-first canvas.
- Let users move between generated sensemaking maps and the full catalyst map without losing selected catalyst context.
- Keep catalyst detail interactions consistent with the S71 right-side detail card and catalyst drawer.

## Acceptance

- Users can open a full map view and see the complete catalyst set available to NarrativeFlow.
- Catalysts are visually grouped by narrative with clear per-narrative boundaries.
- Clicking a catalyst opens the same detail affordance used by the S71 sensemaking map.
- The default NarrativeFlow entry remains blank/chat-first with required RiskFlow headline attachments.
- React Flow canvas performance remains acceptable with large catalyst sets.

## References

- @sprint-md/S71-T1-narrativeflow-full-catalyst-map.md
- @frontend/components/narrative/NarrativeCanvas.tsx
- @frontend/components/narrative/NarrativeMap.tsx
- @backend-hono/src/routes/narrative/handlers.ts
