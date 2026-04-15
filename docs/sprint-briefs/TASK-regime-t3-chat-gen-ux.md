# Task Brief: Regime Tracker T3 — Chat + Generation UX + Animations

**Date:** 2026-04-14
**Scope:** Add hybrid inline chat per regime card, glassmorphic AI generation overlay with thinking animation, smooth transitions, and new CSS keyframes
**Estimated files:** 3 new + 3 modified

## Context

Track 2 decomposed the regime tracker into glass-wrapped subcomponents. This track adds the interactive layer: a mini chat input on each regime card that can expand to the full sidebar, a glassmorphic "AI Generate" flow with a frosted overlay showing thinking phrases while Harper generates a new regime, and smooth CSS transitions for everything. This is the "feels" track — iOS26 energy, liquid glass dissolve effects, staggered animations.

**IMPORTANT:** This track depends on Track 2 being complete. The component files from T2 (`RegimeCard.tsx`, `RegimeTrackerModal.tsx`) must exist before starting. If they don't exist yet, wait or read the T2 brief to understand the expected structure.

## Files to Read First

- `frontend/components/regimes/RegimeCard.tsx` — Created by T2. Glass-wrapped card component. The mini-chat input goes at the bottom of this card.
- `frontend/components/regimes/RegimeTrackerModal.tsx` — Slimmed by T2. The AddRegimeForm is still inline here. The AI Generate button (around line 415 in the original) dispatches `fintheon:open-chat-skill`. This needs to be replaced with the glassmorphic pop-out flow.
- `frontend/components/ChatInterface.tsx` — Handles `fintheon:open-chat-skill` custom events. The mini-chat dispatches this same event to open the sidebar. Understand the event shape: `{ skillId: string, prompt: string }`.
- `frontend/components/chat/CognitionPanel.tsx` — Existing thinking animation pattern. Uses `fadeSlideIn` keyframe with staggered `animationDelay`. Pulsing gold dot during streaming. Auto-collapse after completion. Reuse this animation pattern.
- `frontend/components/ui/liquid-glass.tsx` — `GlassEffect` component. Used for the thinking overlay. Props: `blur` (number, default 20), `tint` (string), standard div props.
- `frontend/styles/custom.css` — Existing keyframes: `fadeSlideIn` (translateY 4px, opacity 0→1). Add new keyframes here: `glass-dissolve`, `glass-slide-up`.
- `frontend/lib/regimes.ts` — `TradingRegime` interface (updated by T2 with new bias types). Needed for regime context in chat dispatch.

## What to Build/Change

### 1. RegimeMiniChat Component

- **Path:** `frontend/components/regimes/RegimeMiniChat.tsx`
- **Action:** Create
- **Spec:**
  - Props: `regime: TradingRegime`, `onExpandToSidebar?: () => void`
  - Renders a compact chat input bar at the bottom of a regime card
  - Input: `<input>` with class `bg-transparent border border-[var(--fintheon-glass-border)] rounded-xl px-3 py-1.5 text-xs text-[var(--fintheon-text)] placeholder-zinc-600 focus:border-[var(--fintheon-accent)]/40 focus:outline-none w-full`
  - Placeholder: `"Ask about ${regime.name}..."`
  - Submit button: small send icon (lucide `Send`, w-3 h-3) inside the input, positioned absolute right
  - On submit: dispatch `fintheon:open-chat-skill` custom event with `detail: { skillId: "regimes", prompt: \`[Regime: ${regime.name} | ${regime.timeRange.start}-${regime.timeRange.end} ET | Bias: ${regime.bias} | Confidence: ${regime.confidence}%] ${userInput}\` }`
  - After dispatch: call `onExpandToSidebar?.()` which should close the modal (parent handles this)
  - Transition: input bar has `transition-all duration-200`. On focus, subtle glow: `shadow-[0_0_8px_rgba(212,175,55,0.08)]`
  - Idle state: collapsed to just a subtle "Ask Harper..." text button (text-[10px] text-zinc-600 hover:text-[var(--fintheon-accent)])
  - On click of idle text, expand to the full input bar with `transition-all duration-200 ease-out` (height 0→auto, opacity 0→1)
- **Max lines:** 80

### 2. RegimeThinkingOverlay Component

- **Path:** `frontend/components/regimes/RegimeThinkingOverlay.tsx`
- **Action:** Create
- **Spec:**
  - Props: `isVisible: boolean`, `onComplete?: () => void`, `isGenerating: boolean`
  - Full-modal frosted glass overlay that covers the RegimeTrackerModal content area
  - Uses `<GlassEffect blur={24} tint="rgba(5,4,2,0.7)" className="absolute inset-0 z-10 rounded-2xl flex flex-col items-center justify-center">`
  - Entry animation: the overlay slides up using CSS class `animate-[glass-slide-up_400ms_ease-out_forwards]`
  - Thinking phrases array (cycle through these with staggered appearance):
    1. "Analyzing institutional flow..."
    2. "Scanning COT positioning..."
    3. "Calibrating antilag confidence..."
    4. "Mapping regime time windows..."
    5. "Cross-referencing ORB history..."
  - Each phrase renders as: `<div style={{ animation: "fadeSlideIn 0.3s ease-out forwards", animationDelay: \`${idx \* 800}ms\`, opacity: 0 }} className="text-xs text-[var(--fintheon-text)]/70 tracking-wide">`
  - Gold pulsing dot centered above phrases: `<span className="w-2 h-2 rounded-full bg-[var(--fintheon-accent)] animate-pulse mb-4" />`
  - When `isGenerating` transitions from true to false (completion):
    1. All phrases fade out: add class `transition-opacity duration-200 opacity-0`
    2. After 200ms, the glass overlay gets class `animate-[glass-dissolve_500ms_ease-out_forwards]`
    3. After the dissolve (700ms total), call `onComplete?.()`
  - Use `useEffect` to track `isGenerating` state changes and trigger the completion sequence with `setTimeout`
  - When `!isVisible`, render nothing (return null)
- **Max lines:** 100

### 3. New CSS Keyframes

- **Path:** `frontend/styles/custom.css`
- **Action:** Modify (append at end)
- **Spec:** Add these keyframes:

  ```css
  /* [claude-code 2026-04-14] Regime tracker glassmorphic generation UX */
  @keyframes glass-dissolve {
    from {
      backdrop-filter: blur(24px) saturate(1.3);
      -webkit-backdrop-filter: blur(24px) saturate(1.3);
      opacity: 1;
    }
    to {
      backdrop-filter: blur(0px) saturate(1);
      -webkit-backdrop-filter: blur(0px) saturate(1);
      opacity: 0;
    }
  }

  @keyframes glass-slide-up {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
  ```

- **Max lines:** 20 (appended)

### 4. Integrate Mini-Chat into RegimeCard

- **Path:** `frontend/components/regimes/RegimeCard.tsx`
- **Action:** Modify
- **Spec:**
  - Import `RegimeMiniChat` from `./RegimeMiniChat`
  - Add `onExpandToSidebar?: () => void` to RegimeCard props
  - Render `<RegimeMiniChat regime={regime} onExpandToSidebar={onExpandToSidebar} />` at the bottom of the card, below the stats+actions row
  - Add a subtle separator before it: `<div className="h-px bg-[var(--fintheon-accent)]/5 my-2" />`
- **Max lines:** 150 (modified from T2's ~130)

### 5. AI Generate Glassmorphic Flow in Modal

- **Path:** `frontend/components/regimes/RegimeTrackerModal.tsx`
- **Action:** Modify
- **Spec:**
  - Import `RegimeThinkingOverlay` from `./RegimeThinkingOverlay`
  - Add state: `const [isGenerating, setIsGenerating] = useState(false)`, `const [showThinking, setShowThinking] = useState(false)`
  - Replace the current `handleAIGenerate` function:
    1. Set `setShowThinking(true)` and `setIsGenerating(true)`
    2. Dispatch `fintheon:open-chat-skill` event (same as before but don't close modal)
    3. After a 4-second timeout (simulated generation time), set `setIsGenerating(false)`
    4. When `RegimeThinkingOverlay` calls `onComplete`, set `setShowThinking(false)`
  - Render `<RegimeThinkingOverlay isVisible={showThinking} isGenerating={isGenerating} onComplete={() => setShowThinking(false)} />` inside the modal container (absolute positioned, covers the body area)
  - The modal container needs `position: relative` for the overlay to position against
  - "AI Generate" button styling: change to use `<GlassButton>` from liquid-glass.tsx instead of plain button. Text stays "AI Generate".
  - AddRegimeForm: wrap the form area in a container that dims (`opacity-30 transition-opacity duration-300`) when `showThinking` is true
  - Pass `onExpandToSidebar={onClose}` to each `<RegimeCard>` so the mini-chat can close the modal when expanding to sidebar
- **Max lines:** 280

## Key Rules

- Reuse `fadeSlideIn` keyframe from `custom.css` — do NOT create a duplicate
- Use CSS variables for all colors (var(--fintheon-accent), var(--fintheon-bullish), etc.)
- Use `GlassEffect` from `../../components/ui/liquid-glass` — do NOT recreate glassmorphism manually
- The `fintheon:open-chat-skill` event is the bridge to the main chat. Shape: `new CustomEvent("fintheon:open-chat-skill", { detail: { skillId: string, prompt: string } })`
- Timing: glass-slide-up 400ms, phrase stagger 800ms each, completion fade 200ms + dissolve 500ms = 700ms total exit
- No framer-motion dependency needed — pure CSS animations are sufficient and more performant for these effects
- No gradients, no colored emojis

## DO NOT

- Touch any backend files
- Modify the bias system or OrbRecord — T2 handles those
- Add new npm dependencies (no framer-motion, no animation libraries)
- Create new CSS files — append to existing `custom.css`
- Change the TradingRegime interface — T2 already did that
- Make the chat actually stream responses inline (that's a future feature). For now, dispatching the event and closing/expanding to sidebar is sufficient.

## Verification

```bash
# Build
bun run build

# Visual verification (start dev server):
# 1. Open regime tracker modal
# 2. Each card should have a subtle "Ask Harper..." text at bottom
# 3. Clicking it expands to an input bar with smooth transition
# 4. Typing and submitting should close modal and open chat sidebar with regime context
# 5. "AI Generate" button should trigger frosted glass overlay
# 6. Thinking phrases should appear one by one with staggered animation
# 7. Gold pulsing dot should be visible above phrases
# 8. After ~4 seconds, phrases fade out and glass dissolves smoothly
# 9. Modal content should be dimmed while generating
# 10. No console errors
```

## Changelog Entry

```typescript
{
  date: '2026-04-14T18:00:00',
  agent: 'claude-code',
  summary: 'T3: Added hybrid mini-chat per regime card, glassmorphic AI generate overlay with thinking animation and glass-dissolve effect, new CSS keyframes',
  files: ['frontend/components/regimes/RegimeMiniChat.tsx', 'frontend/components/regimes/RegimeThinkingOverlay.tsx', 'frontend/components/regimes/RegimeCard.tsx', 'frontend/components/regimes/RegimeTrackerModal.tsx', 'frontend/styles/custom.css']
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
