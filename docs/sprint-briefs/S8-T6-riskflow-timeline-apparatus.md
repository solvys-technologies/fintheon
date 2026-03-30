# S8-T6: RiskFlow + Timeline + Apparatus Polish

**Sprint**: S8 — The Mega Sprint
**Track**: T6 (after T1)
**Branch**: `v.8.28.1`

## Context
RiskFlow needs infinite scroll + toggles + indicator cleanup. Timeline shows 0 events despite 628 in the DB (T1 fixes the data flow, this track handles the UI polish). Apparatus has undersized Rules of Engagement, empty "9 more" button, missing background stories, and no ropes (T3 handles rope rendering, this track handles content).

## Files to Read First
- `frontend/components/RiskFlowPanel.tsx` — main RiskFlow panel, "Polling Sources..." text, toggle area
- `frontend/components/feed/NewsSection.tsx` — full-page RiskFlow feed
- `frontend/contexts/RiskFlowContext.tsx` — polling logic, `loadMore()`, `hasMore`
- `frontend/components/narrative/TimelinePanel.tsx` (323 lines) — 2-col paginated timeline
- `frontend/components/apparatus/ApparatusPage.tsx` — constellation view
- `frontend/components/apparatus/commandments-data.ts` — commandment definitions

## Files to Modify
- `frontend/components/RiskFlowPanel.tsx` — infinite scroll, toggles, descriptions, indicator
- `frontend/components/feed/NewsSection.tsx` — infinite scroll on full feed
- `frontend/components/narrative/TimelinePanel.tsx` — shimmer tickers, title sizing, content fix
- `frontend/components/apparatus/ApparatusPage.tsx` — text sizing, "9 more" content, background stories

## Implementation

### 1. RiskFlow Infinite Scroll
**Main RiskFlow feed tab** (sidebar → full page `NewsSection.tsx`):
- Add `IntersectionObserver` at bottom of feed list
- When visible → call `loadMore()` from RiskFlowContext
- Respect `hasMore` flag to stop fetching
- Show loading spinner at bottom while fetching

**Dashboard full feed** (RiskFlowPanel at bottom of strategium):
- Same `IntersectionObserver` pattern
- Only active when the full feed version is expanded

**Infinite Scroll Toggle:**
- New toggle next to auto polling toggle
- Label: "Infinite Scroll"
- When off: show "Load More" button at bottom instead of auto-loading
- Store preference in `SettingsContext` or localStorage

### 2. Auto Polling Toggle Descriptions
- Where toggles appear (main RiskFlow feed, toggle section): add description text for auto polling: "Automatically refreshes the feed every 30 seconds"
- Everywhere auto polling toggle appears EXCEPT strategium: show "auto" label next to it
- Skip description in strategium (right panel) — just the toggle, no extra text

### 3. RiskFlow Indicator Cleanup
- Remove "CLI" from "X CLI" indicator → just "X"
- Add "Risk Flow" title text to the LEFT of the X indicator
- Status indicator should fire according to backend source availability:
  - Check `curl localhost:8080/api/riskflow/sources` which returns `{ notion, twitterCli, xApi }`
  - Green dot = source active. Gray/red dot = source down.
  - Same pattern as footer status lights (Gateway, AI, Database, Feed, X, auth, Chat, fintheon)

### 4. Timeline UI Polish
After T1 fixes the data flow (events actually appearing):
- **Shimmer tickers**: Next to "TIMELINE" title, add:
  - `{eventCount}` with shimmer effect on the number only (no background, no border)
  - "events" in regular text
  - `{narrativeCount}` with shimmer effect on the number only
  - "narratives" in regular text
  - Shimmer = CSS animation similar to name tag shimmer, subtle gold pulse
- **Title sizing**: Make "TIMELINE" text bigger (~+4px from current)
- **Subheader**: "Structured Narrative View" → increase by 4-5px
- **Tickers**: slightly smaller than "TIMELINE" text relatively

Shimmer CSS (add to index.css):
```css
@keyframes text-shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.shimmer-number {
  background: linear-gradient(90deg, var(--fintheon-accent) 0%, var(--fintheon-text) 50%, var(--fintheon-accent) 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: text-shimmer 3s linear infinite;
}
```

### 5. Apparatus Fixes
**Rules of Engagement text size:**
- When commandment cards expand, the text is too small
- Increase body text to 13-14px (from likely 11px)
- Heading text to 16px

**"9 more" button:**
- Currently leads to nothing — populate with the remaining commandments
- All commandments should be in `commandments-data.ts`
- If data is missing, add placeholder content that reflects PIC trading commandments

**Background stories:**
- Each commandment card should have a background story explaining WHY this rule exists
- Pull from existing documentation or create concise origin stories
- Display: expandable section within each card, beneath the main rule text
- Format: italicized context paragraph, ~2-3 sentences

### 6. RiskFlow Toast Notification Refactor
- Refactor toast notifications to look like RiskFlow items in the Strategium panel (same card structure, layout, badges)
- Maintain the frosted glass aesthetic (`backdrop-filter: blur(16px)`, semi-transparent bg)
- Bullish/bearish coloring on the implied point value at the footer: `var(--fintheon-bullish)` / `var(--fintheon-bearish)`
- Theme-sensitive: colors change with user's selected theme
- Match: headline styling, source badge, severity indicator, macro level, timestamp — same as Strategium RiskFlow items
- Add: frosted glass overlay (`bg-[var(--fintheon-surface)]/80 backdrop-blur-xl`) so they float over content elegantly
- Check `frontend/components/NotificationToast.tsx` and reference `frontend/components/RiskFlowPanel.tsx` for the Strategium item layout

## Verification
1. `bun run build` — clean
2. RiskFlow main feed: scroll to bottom → new items auto-load
3. Infinite scroll toggle visible next to auto polling toggle
4. Auto polling has description text where toggles show
5. "X" indicator (no "CLI"), "Risk Flow" title visible
6. Timeline: events rendering, shimmer numbers visible, title bigger
7. Apparatus: Rules of Engagement readable when expanded, "9 more" has content, background stories show

## Changelog Entry
```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S8-T6: RiskFlow infinite scroll + toggles + indicator, Timeline shimmer tickers + sizing, Apparatus text sizing + 9 more content + background stories', files: ['frontend/components/RiskFlowPanel.tsx', 'frontend/components/feed/NewsSection.tsx', 'frontend/components/narrative/TimelinePanel.tsx', 'frontend/components/apparatus/ApparatusPage.tsx', 'frontend/components/apparatus/commandments-data.ts', 'frontend/index.css'] }
```

## DO NOT
- Do NOT fix RiskFlow data loading (T1 handles "Polling Sources..." fix)
- Do NOT fix Timeline data flow (T1 handles event rendering)
- Do NOT add rope rendering to Apparatus (T3 handles that)
- Do NOT touch NarrativeFlow canvas (T2 owns that)
- Do NOT modify Aquarium/Sanctum (T4 owns that)
