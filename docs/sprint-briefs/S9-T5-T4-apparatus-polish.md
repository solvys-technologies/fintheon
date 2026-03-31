# S9-T5 Track 4: Apparatus Quick Wins

**Sprint:** S9-T5 Sanctum Map Intelligence Overhaul
**Track:** T4 — Apparatus Polish
**Depends on:** Nothing — runs independently in parallel
**Estimated files:** 2 modified

---

## Objective

Two quick wins:
1. Remove the React Flow MiniMap from the bottom-right corner of the Apparatus constellation view
2. Ensure agent backstories (dossier teasers) are visible on collapsed agent cards — not hidden behind the expand toggle

---

## Files to Read First

1. `frontend/components/apparatus/ApparatusFlowMap.tsx` — constellation view with MiniMap (line 286-295)
2. `frontend/components/apparatus/ApparatusMap.tsx` — agent cards with bio, dossier, activeNarratives, notableInfo
3. `frontend/components/apparatus/types.ts` — `AgentNode` interface with `bio`, `dossier`, `record`, `activeNarratives`, `notableInfo` fields

---

## Task 1: Remove MiniMap

### File: `frontend/components/apparatus/ApparatusFlowMap.tsx`

Find and remove the `<MiniMap>` component (around lines 286-295):

```typescript
// DELETE this entire block:
<MiniMap
  position="bottom-right"
  nodeColor={(node) => {
    if (node.id === 'nucleus') return '#c79f4a';
    const agent = AGENTS.find(a => a.id === node.id);
    return agent?.accentColor ?? '#6B7280';
  }}
  style={{ backgroundColor: '#050402', borderColor: '#c79f4a20', borderRadius: 8 }}
  maskColor="#05040280"
/>
```

Also remove the `MiniMap` import from `@xyflow/react` at the top of the file:

```typescript
// Change this:
import { ReactFlow, Background, MiniMap, ... } from '@xyflow/react';
// To this:
import { ReactFlow, Background, ... } from '@xyflow/react';
```

---

## Task 2: Show Backstory Preview on Collapsed Cards

### File: `frontend/components/apparatus/ApparatusMap.tsx`

The agent cards currently show a bio snippet in collapsed view, but the user wants the **dossier** (origin story) to be more prominent. The current collapsed view shows:

1. Agent name + role
2. Bio snippet (first 2 lines, italic, dimmed)
3. First 2 memory facts
4. "+N more" link

**Change**: Add a dossier teaser below the bio snippet in the collapsed view. Show the first 2 sentences of the `dossier` field, styled as a brief narrative preview.

Find the collapsed card rendering section. Look for where `agent.bio` is rendered in the non-expanded state. Below it, add:

```typescript
{/* Dossier teaser — origin story preview */}
{agent.dossier && (
  <p className="text-[10px] leading-relaxed text-[var(--fintheon-text-muted)] mt-1.5 line-clamp-2 italic opacity-70">
    {agent.dossier.split('. ').slice(0, 2).join('. ')}.
  </p>
)}
```

### What this looks like in the collapsed card:

```
┌──────────────────────────────────┐
│ Harper                    CAO    │
│                                  │
│ "The only entity in recorded     │  ← bio (existing)
│  history to simultaneously..."   │
│                                  │
│ Forged in July 2024 CPI         │  ← dossier teaser (NEW)
│ rotation → Yen Flash Crash...   │
│                                  │
│ ● 547 consecutive Morning Briefs │  ← memory facts (existing)
│ ● 34% veto rate                  │
│ +3 more                          │
└──────────────────────────────────┘
```

The dossier teaser uses:
- `text-[10px]` — small but legible
- `line-clamp-2` — max 2 lines, truncated with ellipsis
- `italic opacity-70` — visually distinct from bio, reads as a subtitle/tagline
- First 2 sentences only (split by `. ` and rejoin)

---

## Verification

1. Navigate to Consilium → Apparatus tab
2. **MiniMap**: Confirm the preview map in the bottom-right corner is GONE
3. **Backstories**: Each agent card in collapsed state shows:
   - Name + role (existing)
   - Comedic bio snippet (existing)
   - **Dossier teaser** (NEW — 2 sentences of origin story, italic, dimmed)
   - Memory facts (existing)
4. Click expand on a card — full dossier, bio, record, etc. still render correctly
5. `npx tsc --noEmit` passes
6. `bun run build` passes

---

## Changelog Entry

```typescript
{ date: '2026-03-29T__:__:__', agent: 'claude-code', summary: 'fix(apparatus): remove minimap, add dossier teaser to collapsed agent cards', files: ['frontend/components/apparatus/ApparatusFlowMap.tsx', 'frontend/components/apparatus/ApparatusMap.tsx'] }
```

---

## DO NOT

- Do NOT touch any narrative/ files — those are T1/T2/T3 scope
- Do NOT touch ConsiliumHub.tsx — that's T2 scope
- Do NOT rewrite the expanded card view — it works fine, only add to the collapsed view
- Do NOT remove or modify the Commandments sidebar
- Do NOT change the React Flow constellation layout or node positions
