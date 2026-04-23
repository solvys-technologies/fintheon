# Sprint Brief: S29-T3 — Chat Interface Modernize

## Context

The Performance tab is getting a major facelift (T2). The chat interface hasn't been touched in a while and needs to level up to match — **visually only**. Logic, streaming, auth, message handling all stay exactly as-is. This is a pure aesthetic refactor to bring chat in line with the Solvys design system.

You are working in **parallel** with three other Claude Desktop windows (T1 data layer, T2 calendar UI, T4 catalyst panel). Your lane is strictly `frontend/components/chat/**` **visual** files.

## Branch Target

`feat/s29-t3-chat-modernize-W`

Create from `main`:

```bash
cd /Users/freethefranks/Documents/Fintheon
git checkout main && git pull
git checkout -b feat/s29-t3-chat-modernize-W
```

## Scope — Included

- [ ] Audit every component under `frontend/components/chat/` for visual consistency with Solvys design tokens
- [ ] Replace ad-hoc Tailwind colors with solvys-feels tokens (from `.claude/skills/solvys-feels/reference/css-tokens.md`)
- [ ] Modernize message bubbles (user, assistant, tool-call, streaming state)
- [ ] Modernize input bar (textarea, send button, attachment/voice toggles)
- [ ] Modernize chat header (conversation title, model indicator, new-chat button)
- [ ] Modernize streaming indicator (pulse dot pattern, same as auth callback page — `#c79f4a` pulse on dim bg)
- [ ] Update any sub-components that clearly don't match (inline tool results, error states, empty state)
- [ ] Append changelog entry

## Scope — Excluded (DO NOT TOUCH)

- **All chat logic hooks** — `useChatWithAuth.ts`, `useHermesChat.ts`, `useAgentRouter.ts`, anything under `chat/hooks/`
- **Transport layer** — `DefaultChatTransport`, `useChat` from `@ai-sdk/react`, any `fetchWithAuth` wrappers
- **Backend chat handlers** — `backend-hono/src/routes/ai/handlers/chat.ts`, `harper-handler.ts`
- `frontend/components/journal/**` (T2 owns)
- Backend files (T1 owns)
- `CatalystSlideOut/` (T4 owns)

**Rule:** if you touch a file that has React state, effects, or calls to `useChat` / `fetch`, you are breaking scope. Back out.

## Known Issues to Preserve

- **Chat streaming works** — do not change the SSE stream parser, message deltas, or finish handling. If the chat stops streaming after your changes, you touched logic. Revert.
- **Harper + VProxy fallback** — chat routes to `/api/ai/chat` which currently goes through Harper with VProxy-preferred / OpenRouter-fallback. Your changes must not affect this.
- **Electron desktop only** — verify via rebuild + launch, not a dev server
- **Solvys design principles** (from `.claude/skills/solvys-feels/`):
  - No gradients, no shadows, no blur, no emojis in UI chrome
  - Flat OKLCH colors only
  - BG `#050402`, Text `#f0ead6`, Accent `#c79f4a` (Solvys Gold)
  - Industrial warmth — precise but not cold
  - No AI sparkles, glitter, or aurora effects

## Implementation Steps

### 1. Read the solvys-feels reference first

Before touching anything, read:

```
.claude/skills/solvys-feels/SKILL.md
.claude/skills/solvys-feels/reference/css-tokens.md
.claude/skills/solvys-feels/reference/solvys-gold-palette.md
.claude/skills/solvys-feels/reference/solvys-themes.md
.claude/skills/solvys-feels/reference/font-kit.md
```

These define the EXACT tokens you use. No color values in components — tokens only.

### 2. Inventory the current chat components

```bash
ls frontend/components/chat/
find frontend/components/chat -type f -name "*.tsx" -exec wc -l {} \;
```

For each component, identify what's visual-only vs mixed. Your refactor stays in the pure-visual files or in visual sections of mixed files.

### 3. Message bubble refactor

Typical mistakes to fix:

- Bubble uses `bg-gradient-to-br` → replace with flat `var(--solvys-bg-raised)`
- Avatar has `shadow-lg` → remove; use 1px border in token color instead
- User bubble uses generic blue → use `#c79f4a` (Solvys Gold) as subtle accent
- Assistant bubble uses pure white → use `#f0ead6` (warm beige) for text, token-bg

### 4. Input bar refactor

- Textarea: flat bg, 1px border in token color, no shadow on focus — instead brighten border to Solvys Gold on focus
- Send button: flat Solvys Gold bg, warm beige text, no icon unless it's a line-style glyph (no filled emoji)
- Attachment/voice toggles: icon buttons, 1px border, no fills

### 5. Header refactor

- Title: Cinzel font (from font-kit.md), letter-spaced, dimmed text
- Model indicator: small pill, flat, token bg
- New-chat button: outline only, no fill

### 6. Streaming indicator

The auth callback page uses this pattern — replicate in chat:

```html
<span class="pulse"></span>
<style>
  .pulse {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #c79f4a;
    animation: p 1.5s ease-in-out infinite;
  }
  @keyframes p {
    0%,
    100% {
      opacity: 0.3;
    }
    50% {
      opacity: 1;
    }
  }
</style>
```

Use this wherever the chat shows "thinking" / "streaming". No spinners, no skeleton shimmer, no aurora.

### 7. Verify chat still works end-to-end

After every batch of changes, relaunch Fintheon and ask Harper a trading-relevant question:

```bash
curl -s -X POST http://localhost:8080/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Origin: null" \
  -d '{"messages":[{"role":"user","content":"What is the current VIX level?"}]}' | head -c 500
```

You should see streaming `text-delta` events with a real response about VIX. If chat breaks, you touched logic. Revert.

### 8. Changelog

Append to `src/lib/changelog.ts`:

```typescript
{
  date: "2026-04-22T<HH:MM>:00",
  agent: "T3/Wealth",
  summary: "S29-T3: Modernized chat interface to Solvys design system (visual-only, no logic changes)",
  files: [
    "frontend/components/chat/**/*.tsx",
  ],
},
```

## Acceptance Criteria

- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` clean
- [ ] `rm -R dist && npx vite build` completes
- [ ] Chat streams correctly after rebuild (verified via curl test above AND eyeballing a real message in the relaunched app)
- [ ] No gradients, shadows, blur, or emojis in any chat UI component
- [ ] All colors are token references, not raw hex
- [ ] No hook files (`useChatWithAuth.ts`, etc.) are modified
- [ ] No backend files are modified
- [ ] Streaming indicator uses the pulse-dot pattern
- [ ] Visual consistency with the rest of the app (compare to Performance tab, Sanctum, Strategium after rebuild)

## Validation Commands

```bash
cd /Users/freethefranks/Documents/Fintheon/frontend
npx tsc --noEmit
rm -R dist
npx vite build

# Rebuild + launch
cd /Users/freethefranks/Documents/Fintheon
npx electron-builder --mac dmg
cd /Applications && rm -R Fintheon.app 2>/dev/null
cp -R /Users/freethefranks/Documents/Fintheon/desktop-dist/mac-arm64/Fintheon.app /Applications/
open /Applications/Fintheon.app

# Smoke test chat after launch
sleep 18
curl -s -X POST http://localhost:8080/api/ai/chat \
  -H "Content-Type: application/json" \
  -H "Origin: null" \
  -d '{"messages":[{"role":"user","content":"ping"}]}' | head -c 400
```

## Commit Format

```
[T3] style: modernize chat bubbles to solvys tokens
[T3] style: modernize chat input bar
[T3] style: modernize chat header + streaming indicator
```

No version stamps on branch commits. Final unification will tag `v.5.22.9W`.
