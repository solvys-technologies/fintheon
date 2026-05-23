# Sprint Brief: S79-T3 -- Loaded Session Workspace

## Context

Once a desk narrative is opened or created, NarrativeFlow should load into a focused workspace: canvas on the left and a resizable right drawer showing the agentic desk's work. The drawer has exactly three tabs: Flow, Timeline, and Docs. This track builds that loaded-session shell and the visual representations for timeline and docs, leaving final route/API wiring to S79-T5.

The Orchestra reference is useful for interaction grammar: a persistent research transcript, top-level artifact tabs, graph cards with type/status chips, a compact canvas toolbar, and artifact panes that feel like structured work rather than settings panels. For Fintheon, reduce that grammar to the requested right drawer: Flow, Timeline, Docs. Do not carry over Agents, Experiments, or Files tabs.

## Linear Scope

- **Issue naming**: `S79-T3: Loaded Session Workspace`
- **Beta Phase**: Closed Beta
- **Linear Project**: Beta -- Sanctum & Arbitrum UX
- **Linear Initiative**: Beta Closed
- **Cycle**: Cycle 8 - Beta Closed
- **Due date**: 2026-05-23
- **Assigned owner**: Codex Cloud
- **Brief reference**: `@sprint-md/S79-T3-loaded-session-workspace.md`

## Branch Target

`sprint/S79`

## Scope -- Included

- [ ] Build loaded NarrativeFlow workspace shell.
- [ ] Build width-resizable right work drawer.
- [ ] Build three tabs: Flow, Timeline, Docs.
- [ ] Flow tab shows canvas metadata, selected narrative/catalyst context, agent work events, and canvas controls inspired by Orchestra's `Organize` / `All` toolbar.
- [ ] Timeline tab shows RiskFlow timeline rows/cards with conflict badges, fading vertical ruler lines, and compact visual cards.
- [ ] Docs tab shows report, relevant web/report links, non-technical synthesis, and footer link to Fintheon home page.
- [ ] Keep a compact research transcript/chat column available in loaded-session mode if S79-T5 chooses to preserve it beside the canvas.
- [ ] Support node-level hover/quick-action chips for catalyst follow-ups, similar to Orchestra's node action strip, but with Fintheon actions like `Compare`, `Challenge`, `Promote`, `Link`.

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/components/narrative/NarrativeCanvas.tsx` - owned by S79-T5.
- `frontend/components/narrative/NarrativeSensemakingComposer.tsx` - owned by S79-T2.
- `backend-hono/**` and `supabase/**` - owned by S79-T1 and S79-T4.
- React Flow map internals unless creating a new wrapper component.

## Reuse Inventory

- Current right panel at `frontend/components/narrative/NarrativeSensemakingDetail.tsx:13` - replace or wrap this behavior in a tabbed drawer.
- Current timeline payload shape at `frontend/components/narrative/sensemaking-types.ts:37` - use as initial input shape.
- Current flow card shape in `frontend/components/narrative/NarrativeSensemakingMap.tsx:129` - keep the same catalyst vocabulary.
- Existing `ReactFlow` surface at `NarrativeSensemakingMap.tsx:75` - do not duplicate map rendering unless needed for a wrapper.

## Solvys Feels Constraints

- No gradients, shadows, blur, sparkles, thick borders, or emoji chrome.
- Drawer resize handle must be subtle: 1px line, low-opacity gold hover, no glow.
- Timeline conflict colors apply to values/badges only, never the whole container.
- Use compact tab labels: `Flow`, `Timeline`, `Docs`.
- Node cards should use type/status chips like `MAIN`, `THEORY`, `CATALYST`, `In Progress`, `Conflict`, but with Fintheon market vocabulary.
- Hover action chips should be inline and dark, with 1px borders. No popover shadow and no glowing tooltips.

## File Ownership

- `frontend/components/narrative/NarrativeSessionWorkspace.tsx` [NEW]
- `frontend/components/narrative/NarrativeWorkDrawer.tsx` [NEW]
- `frontend/components/narrative/NarrativeTimelineTab.tsx` [NEW]
- `frontend/components/narrative/NarrativeDocsTab.tsx` [NEW]
- `frontend/components/narrative/NarrativeFlowTab.tsx` [NEW]
- `frontend/components/narrative/NarrativeSensemakingDetail.tsx`

## Implementation Steps

1. Create `NarrativeSessionWorkspace.tsx` with props:
   - `session`
   - `response`
   - `selectedNodeId`
   - `onSelectNode`
   - `onRename`
   - `children` for the canvas/map area.
2. Create `NarrativeWorkDrawer.tsx`:
   - internal `activeTab` state
   - width state default 380px
   - min 320px, max 620px
   - pointer drag resize handle on the left edge
   - localStorage persistence key `narrativeflow:work-drawer-width`.
3. Create `NarrativeTimelineTab.tsx`:
   - group `anchorCatalysts` and `relatedCatalysts` by chronological order.
   - render conflict labels from props, defaulting to `NEEDS CLASSIFICATION`.
   - include a fading vertical ruler between cards.
4. Create `NarrativeDocsTab.tsx`:
   - sections: Report, Web Links, Quick Share.
   - Quick Share must be non-technical and have a footer link to Fintheon home.
   - Links are plain anchors; no external fetch in this track.
5. Create `NarrativeFlowTab.tsx`:
   - summarize active narrative color, session title, selected catalyst, catalyst counts, and generated timestamp.
   - include agent work events from S79-T1 as compact rows.
   - expose `Organize` and `All` controls as callbacks, even if no-op until S79-T5.
   - expose node quick actions as callbacks for S79-T5 to wire.
6. Update `NarrativeSensemakingDetail.tsx` only if needed to export helper pieces or shim to the new drawer. Do not wire into `NarrativeCanvas.tsx`.
7. Keep files under 300 lines.

## Acceptance Criteria

- [ ] Loaded workspace renders with a canvas area and right drawer.
- [ ] Drawer resizes horizontally and persists width.
- [ ] Tabs are exactly Flow, Timeline, Docs.
- [ ] Timeline shows fading vertical ruler lines and conflict badges.
- [ ] Docs tab contains report, web links, non-technical synthesis, and Fintheon home footer link.
- [ ] Flow tab can show agent work events and canvas controls without adding extra top-level tabs.
- [ ] Hovering/selecting a node can reveal compact action chips without shifting canvas layout.
- [ ] No backend or session persistence files are touched.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

## Commit Format

```bash
[v6.7.10] feat: S79-T3 loaded narrative workspace
```
