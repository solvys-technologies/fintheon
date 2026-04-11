# S14-T7: Artifact Parser + Chat Wiring

## Goal

Wire the existing artifact-parser.ts into chat interfaces so trade proposals, catalysts, and narrative items render as inline cards instead of raw JSON.

## Current State

`artifact-parser.ts` is fully implemented but has ZERO imports anywhere. It parses three artifact types from Claude responses: `catalyst`, `trade-proposal`, `narrative-item`. The chat currently shows raw markdown including artifact blocks.

## What to Do

1. **Wire into main chat**:
   - @frontend/components/chat/FintheonThread.tsx:121-137 — in FintheonTextPart component:
     - Call `parseArtifacts(textContent)` to extract artifact blocks
     - Call `stripArtifactBlocks(textContent)` for clean markdown display
     - Render extracted artifacts as inline cards below the message text

2. **Build ArtifactCard component**:
   - New: `frontend/components/chat/ArtifactCard.tsx`
   - Render `trade-proposal` artifacts as styled cards: bias, entry/stop/target, R:R, confidence
   - Render `catalyst` artifacts as compact catalyst cards: sentiment, severity, tags
   - Render `narrative-item` artifacts as narrative event summaries
   - Design: `/the-feels`

3. **Dispatch catalysts to NarrativeFlow**:
   - @frontend/contexts/NarrativeContext.tsx — already has `ADD_CATALYST` action (line 49-68)
   - When a `catalyst` artifact is parsed from chat, call `dispatch({ type: "ADD_CATALYST", ... })` using `toCatalystPayload(artifact)`

4. **Wire into boardroom**:
   - Boardroom agent panel renders streaming text — apply same artifact parsing to agent responses

## Key Context

- @frontend/lib/artifact-parser.ts — fully implemented: `parseArtifacts()`, `toCatalystPayload()`, `stripArtifactBlocks()`
- Artifact format: ` ```artifact:TYPE\n{...}\n``` ` fenced blocks in assistant responses
- @backend-hono/src/skills/quickscope.md:97 — references artifact:trade-proposal format

## Verify

- Send a message to Harper that triggers a trade proposal artifact
- Confirm it renders as a styled card in chat, not raw JSON
- Confirm catalyst artifacts dispatch to NarrativeFlow
- Boardroom agent responses also parse artifacts
