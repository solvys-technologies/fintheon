# Sprint Brief: T4 — Chat Overhaul: Tool Call Cards + Rich Text + Braille Spinners

## Context

The chat interface needs a production-quality overhaul. Tool call text is 2.5x too large for its containers, runs wild without boundaries, and displays raw tool names ("Bash", "Read", "Edit"). These must become collapsible iOS-style rounded cards with thinking phrases as titles, click-to-reveal behavior, and persistent expand/collapse state. No "agent mind" text. Additionally, rich text rendering (**text** → bold) must work globally across all chat surfaces on web, mobile, and desktop. The braille spinner used on mobile (Nothing-style 2x2 sequential block fill) must replace the circular CSS spinner in all chat interfaces with theme-colored styling.

## Branch Target

`sprint/S66`

## Scope — Included

### Tool Call Card Redesign
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx` — Complete redesign of tool call rendering. **Collapsible iOS-style rounded cards**:
  - Container: `rounded-xl border border-[var(--fintheon-accent)]/15 bg-[rgba(5,4,2,0.45)] overflow-hidden` (frosted glass - dark theme base, translucent, thin gold accent border, no backdrop-blur needed for dark bg)
  - Header row (clickable): `flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-[var(--fintheon-accent)]/5 transition-colors`
  - Left side: Braille spinner (SegmentedSpinner, 2x2 block) when tool is running/pending, Check when done, AlertCircle when error
  - Center: Thinking phrase text (from `thinkingPhrases` list) — e.g., "Surveying the arena..." / "Processing market signals..." / "Cross-referencing events..."
  - Right side: ChevronDown/ChevronRight toggle icon
  - Expanded content area: `border-t border-[var(--fintheon-accent)]/10 px-3 py-2.5 text-[11px] text-zinc-400 font-mono whitespace-pre-wrap overflow-x-auto max-h-[200px] overflow-y-auto`
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx` — **Thinking phrases as titles**: Import the existing thinking phrases list from `frontend/lib/agentThinkingPhrases.ts` or `FintheonThinkingIndicator.tsx:5-21`. Use the phrase for the card header instead of tool name. Map tool names to a phrase: a generic phrase for unknown tools, specific phrases where appropriate.
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx` — **No "agent mind" text**: Remove any text that says "agent mind", "thinking", or similar from tool call headers. The thinking phrase IS the title. Nothing else.
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx` — **Click entire row to reveal**: The entire header row is a `<button>` (already the pattern at line 121 for ReadBlock). Ensure ALL tool call blocks use this pattern — click anywhere on the row to expand/collapse.
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx` — **Expand/collapse persistence per card**: Each card maintains its own expanded/collapsed state via a Map keyed by a card identifier (tool name + invocation ID). State persists within the session (doesn't reset when new messages arrive). Use a module-level Map or a state ref that survives re-renders.
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx` — **Auto-collapse when agent done**: When the agent finishes (all tool calls complete), auto-collapse all cards after a brief delay (2-3s). Use a useEffect that checks if all tool invocations in the current message are done, then collapses.
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx:302-311` — `ToolCallPartRenderer` dispatcher: Remove the tool-name-based dispatch (BashBlock, ReadBlock, EditBlock, SearchBlock). Replace with a single unified `ToolCallCard` component that handles ALL tool types. All blocks use the same iOS-style card design. The only variation is in the expanded content formatting.
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx` — **Fix text sizing**: Currently tool output text at line 96 (`text-xs`, 12px) is in `<pre>` which may render larger. Ensure all tool output text is `text-[11px]` consistently. The header row text stays at `text-[11px]` for thinking phrases.
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx` — **Bash/command variant**: For bash commands, show the command text in the header's secondary text (right of thinking phrase, muted color, truncated). The expanded content shows stdout/stderr.
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx:19-31` — Keep TOOL_COLORS map. Use tool color for the accent dot/bar on the card's left edge (a 2px colored bar on the left side of the card, similar to iOS-style list items).
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx:38-48` — `StatusIcon`: Update to use `SegmentedSpinner` instead of `BrailleSpinner` for pending/running states.

### Braille Spinners
- [ ] `frontend/components/chat/primitive/BrailleSpinner.tsx` — Replace the current circle-spinner implementation (lines 16-23: CSS `border` + `borderTopColor` + `spin` animation) with the Nothing-style 2x2 sequential block fill spinner from mobile.
- [ ] `frontend/components/chat/primitive/BrailleSpinner.tsx` — New implementation: Import `SegmentedSpinner` logic from `mobile/components/shared/SegmentedSpinner.tsx`. Re-export it from this file. The spinner renders a 2x2 CSS grid of blocks, rotating clockwise (TL → TR → BR → BL), 150ms per step. Active block gets ACCENT color, other blocks get muted/transparent. Props: `size` (default 8), `gap` (default 2).
- [ ] `frontend/components/chat/primitive/BrailleSpinner.tsx` — Replace ALL uses of the old circular spinner throughout the chat interface. The `BrailleSpinner` component is imported in: `FintheonThinkingIndicator.tsx:3`, `ToolCallPart.tsx:11`, `BrailleSpinnerCentered` (line 37). All should now use the 2x2 block spinner.
- [ ] `frontend/components/chat/primitive/BrailleSpinner.tsx` — **Theme-colored**: The active block uses `var(--fintheon-accent)` (Solvys Gold). The inactive blocks use `rgba(199,159,74,0.15)`. The spinner should be compact and clean — no glow, no pulse, just the 2x2 block fill.
- [ ] `frontend/components/chat/FintheonThinkingIndicator.tsx:59-61` — The thinking indicator already uses BrailleSpinner. The new 2x2 block spinner renders here next to the thinking phrase. Ensure the spinner aligns vertically with the text.
- [ ] `mobile/components/chat/ThinkingIndicator.tsx:27-66` — The mobile thinking indicator uses `SegmentedSpinner`. Ensure it still works and is the same component. If the mobile SegmentedSpinner is different from the desktop implementation, they should converge.
- [ ] `mobile/components/shared/SegmentedSpinner.tsx` — Verify it's unchanged. The desktop imports this pattern, not the mobile file itself.

### Rich Text Rendering (Global)
- [ ] `frontend/components/shared/RichTextRenderer.tsx` **[NEW file]** — Create a reusable component for rendering markdown-like inline formatting in chat text. Parses `**text**` as `<strong>` (bold). Parses `*text*` as `<em>` (italic, optional). Does NOT parse headings, lists, or links — text-only lightweight formatting. Props: `text: string`, `className?: string`.
- [ ] `frontend/components/shared/RichTextRenderer.tsx` — Implementation: Use a simple regex split to find `**...**` patterns and wrap in `<strong className="font-semibold">`. Text between matches passes through as plain spans. Handle edge cases: unmatched `**`, escaped `\**`, nested bold.
- [ ] `frontend/components/chat/TextPartRenderer.tsx` — Replace plain text rendering with `<RichTextRenderer text={content} />`. All chat message text now supports bold via `**text**`.
- [ ] `frontend/components/chat/parts/ToolCallPart.tsx` — Tool call output text (stdout, file content, etc.) also passes through RichTextRenderer so that any `**bold**` markers in tool output render correctly.
- [ ] `mobile/` — Mobile chat text rendering should also support **bold**. If mobile has its own TextPartRenderer, update it to use RichTextRenderer (or move RichTextRenderer to shared code).
- [ ] `frontend/components/chat/parts/ReasoningPart.tsx` — Reasoning/thinking text also supports **bold** via RichTextRenderer.
- [ ] `frontend/components/chat/CognitionPanel.tsx` — SSE-streamed cognition steps. Each step's text passes through RichTextRenderer.
- [ ] `frontend/components/arbitrum/ArbitrumChamber.tsx:326-329` — Digest text rendering (`chamberSummary`). Currently renders via `renderRichDigest` which already handles `**bold**`. Verify this still works and doesn't conflict with RichTextRenderer.

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/layout/TopHeader.tsx` — T3 owns toolbar overhaul
- `frontend/components/layout/NavSidebar.tsx` — T3 owns
- `frontend/components/narrative/DayCard.tsx` — T1 and T3 own
- `frontend/components/IVScoreCard.tsx` — T3 owns sizing
- `frontend/components/TraderNametag.tsx` — T3 owns sizing
- `backend-hono/` — No backend changes in T4
- `electron/` — No Electron changes
- `src/lib/changelog.ts` — T5 owns
- `frontend/contexts/SettingsContext.tsx` — T1 and T2 own additions

## Reuse Inventory

- `agentThinkingPhrases.ts` at `frontend/lib/agentThinkingPhrases.ts` — Per-agent thinking phrases. T4 uses for tool call card titles.
- `THINKING_PHRASES` at `frontend/components/chat/FintheonThinkingIndicator.tsx:5-21` — 15 generic thinking phrases. T4 imports these for tool call card headers.
- `SegmentedSpinner` at `mobile/components/shared/SegmentedSpinner.tsx` — Nothing-style 2x2 block spinner. T4 ports this to desktop.
- `BrailleSpinner` at `frontend/components/chat/primitive/BrailleSpinner.tsx` — Current (incorrect) circular spinner. T4 replaces with SegmentedSpinner.
- `TOOL_COLORS` at `frontend/components/chat/parts/ToolCallPart.tsx:19-31` — Tool color map. T4 keeps for card accent bars.
- `renderRichDigest` at `frontend/components/arbitrum/ArbitrumChamber.tsx:62-87` — Existing rich text for digest. T4's RichTextRenderer should be compatible or this function adopts it.
- `FadingRuler` at `frontend/components/shared/FadingRuler.tsx` — Optional: use as separator between tool call cards.
- `MessagePartRenderer` at `frontend/components/chat/parts/MessagePartRenderer.tsx` — Tool call routing. T4 updates dispatch.

## Known Issues to Preserve

- S65 T2 (Strip Peer Chat) may have removed peer-related components. T4 should not re-add any peer chat code. Verify that `MessagePartRenderer` still routes tool calls correctly.
- The existing `DefaultBlock` at `ToolCallPart.tsx:257` uses `part.toolName` as the title. T4 replaces with thinking phrases — the `part.toolName` is still used internally for color mapping.
- `CognitionPanel.tsx` uses a different rendering path (SSE-streamed). Do not break its streaming behavior when adding RichTextRenderer.
- The existing `StatusIcon` uses `BrailleSpinner` with `size={13}`. The new SegmentedSpinner uses `size={8}` (block size). Ensure the overall spinner display size stays similar (~14px) by having SegmentedSpinner accept a container-level `size` prop or by adjusting the gap.
- Mobile `SegmentedSpinner` uses `var(--text-display)` and `var(--border)` CSS variables. Desktop should use `var(--fintheon-accent)` and `rgba(199,159,74,0.15)` to match Solvys Gold palette.

## Implementation Steps

1. **Create RichTextRenderer** (`frontend/components/shared/RichTextRenderer.tsx`): `function RichTextRenderer({ text, className })` that splits on `/(\*\*[^*]+\*\*)/g` and wraps matches in `<strong>`.
2. **Update BrailleSpinner** (`frontend/components/chat/primitive/BrailleSpinner.tsx`): Replace circular CSS spinner with 2x2 block grid. 4 blocks, rotating clockwise at 150ms intervals. Active block: `var(--fintheon-accent)`. Inactive: `rgba(199,159,74,0.15)`. Size defaults to 8px per block, 2px gap.
3. **Design ToolCallCard** (`frontend/components/chat/parts/ToolCallPart.tsx`): Replace all existing blocks (BashBlock, ReadBlock, EditBlock, SearchBlock) with a single `ToolCallCard` component.
4. **ToolCallCard header**: Braille spinner + thinking phrase + tool color accent bar. Click whole row to expand/collapse.
5. **ToolCallCard body**: Tool output formatted with RichTextRenderer. Font mono where appropriate (bash), sans where appropriate (read).
6. **Expand/collapse persistence**: Module-level `Map<string, boolean>` keyed by `part.toolInvocationId + part.toolName`. Auto-collapse all after agent done (check via useEffect watching message's done state).
7. **Update StatusIcon**: Replace BrailleSpinner import with the new SegmentedSpinner version.
8. **Wire RichTextRenderer**: Through TextPartRenderer, MessagePartRenderer, ReasoningPart, CognitionPanel, and any mobile equivalents.
9. **Update FintheonThinkingIndicator**: The existing thinking indicator line 60 already uses BrailleSpinner. After T4's changes, it will use the 2x2 block spinner.
10. **Mobile convergence**: Update mobile ThinkingIndicator.tsx to import from the same shared BrailleSpinner (or keep SegmentedSpinner as the canonical, have desktop import it).
11. **Build + validate frontend + mobile**.

## Acceptance Criteria

- [ ] Tool call cards are iOS-style rounded (frosted glass base, accent border, accent left bar)
- [ ] Tool call headers show thinking phrases (not tool names)
- [ ] No "agent mind" or similar text anywhere in tool calls
- [ ] Clicking anywhere on the header row expands/collapses the card
- [ ] Expand/collapse state persists per card within the session
- [ ] All tool call cards auto-collapse when agent finishes
- [ ] Tool call text is properly sized (11px, not the current oversized text)
- [ ] Braille spinner is a 2x2 Nothing-style block fill (not a circle)
- [ ] Braille spinner uses Solvys Gold accent color, visible in all chat interfaces
- [ ] `**text**` renders as bold in all chat messages, globally (web + mobile + desktop)
- [ ] `**text**` renders correctly in tool call outputs
- [ ] Rich text works in reasoning/cognition panels
- [ ] Mobile chat spinner matches desktop (both are 2x2 block fill)
- [ ] `npx tsc --noEmit` passes on frontend and mobile
- [ ] `rm -rf dist && npx vite build` passes on frontend and mobile

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

```bash
cd mobile && npx tsc --noEmit && rm -rf dist && npx vite build
```

## Commit Format

```
[v6.2.0] feat: T4 chat overhaul — tool call cards, rich text, braille spinners
```
