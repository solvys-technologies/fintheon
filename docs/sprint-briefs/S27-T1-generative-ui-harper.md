# S27-T1 — Generative UI for Harper (Track A, primary)

## Inspiration

[vercel-labs/json-render](https://github.com/vercel-labs/json-render) — LLMs emit tagged JSON blocks, the frontend renders them as typed React components.

## The Gap

`backend-hono/src/services/harper-handler.ts:144` already instructs Harper to "output structured JSON blocks the frontend can render." **But no parser is wired** — every reply falls through `MessagePartRenderer` → `TextPartRenderer` and renders as markdown. Result: Harper speaks in prose about price levels, probabilities, and risk flags instead of rendering them as scan-able cards.

## Branch / Worktree / CWD

- **Worktree**: `/Users/tifos/Desktop/Codebases/fintheon-s27-a`
- **Branch**: `s27-a-harper-ux` off `v5.22`
- Merge target: `v5.22` → ship tag `v.27.1`

## Scope — Included

### 1. Shared card schema

Create [`shared/harper-cards.ts`](shared/harper-cards.ts) at the repo root (new top-level `shared/` dir). Exports Zod schemas + TS types for six card variants. Both `frontend/` and `backend-hono/` import from here. Track B depends on this file landing first.

Card variants (MVP):

- `probability-table` — headline + rows of `{label, p, note?, delta?}`. Used by Oracle-style outputs.
- `price-level` — symbol + list of `{label, price, type: 'support'|'resistance'|'trigger', distance}`. Feucht outputs.
- `agent-handoff` — `{from, to, question, preview}` rendered as a pill card with a spinner until Track B's A2A tool returns.
- `risk-flag` — `{severity: 'low'|'med'|'high'|'critical', headline, body, iv_context?}`. Herald / RiskFlow promotion.
- `backtest-result` — `{strategy, period, pnl, win_rate, max_dd, trades_shown}`.
- `narrative-thread` — `{catalyst, symbols: string[], confidence, last_update}` — link through to Sanctum thread.

Schema rule: every card has `{kind: 'fintheon-card', variant: '<one above>', id: string, data: …}`. Unknown `variant` falls back to `<pre>` block with a "unknown card" banner (no silent drop).

### 2. Stream fence

Harper streams text via SSE. Cards are emitted inside fences:

```
<<card>>{"kind":"fintheon-card","variant":"price-level", …}<<endcard>>
```

Extend the stream assembler in [`frontend/lib/harper/stream-parser.ts`](frontend/lib/harper/stream-parser.ts) (audit or create) so:

- While inside `<<card>>…<<endcard>>`, buffer JSON bytes into a pending part; do not flush to the text renderer.
- On `<<endcard>>`, `JSON.parse` + Zod-validate against the schema. Success → emit a `card` part to the message-part array. Failure → emit a text part with the raw payload in a code block + a console warn.
- Partial-card buffering: if the stream ends mid-fence (connection drop), treat buffered bytes as text and emit a warning part.

### 3. Renderer branch

Add `CardPartRenderer` to [`frontend/components/chat/parts/`](frontend/components/chat/parts/) — new file `CardPartRenderer.tsx`. Dispatches to six variant components under `frontend/components/chat/cards/*` (one file each, all glassmorphic, all following `solvys-feels`).

Wire into [`frontend/components/chat/ChatMessageBubble.tsx:59`](frontend/components/chat/ChatMessageBubble.tsx:59)'s `MessagePartRenderer`. New branch: `part.type === 'card'` → `<CardPartRenderer card={part.card} />`.

Style: every card is `bg-[color-mix(in_srgb,var(--fintheon-surface)_72%,transparent)] backdrop-blur-md border border-[var(--fintheon-accent)]/18 rounded-xl`. No gradients, no emojis (per CLAUDE.md). Dense typographic hierarchy with the accent gold for primary numerics.

### 4. Harper prompt update

Update [`backend-hono/src/services/harper-handler.ts:144`](backend-hono/src/services/harper-handler.ts:144) system prompt to:

- Reference the `<<card>>…<<endcard>>` fence explicitly.
- List the six variants with one-line descriptions.
- Include 2-3 few-shot examples per high-value variant (`price-level`, `probability-table`, `risk-flag`).
- Instruct: "Emit a card whenever you would otherwise produce a markdown table, a bulleted list of 3+ numeric entries, or a risk callout. Use prose between cards, not inside them."

Prompt length budget: don't balloon over +800 tokens total. Move any long agent instructions into `agent-instructions/harper-cards.ts` and reference by name.

### 5. Boardroom polish (T6 merged in, small scope)

[nolly-studio/cult-ui](https://github.com/nolly-studio/cult-ui) offers a `FamilyButton` and `DirectionAwareHover` that fit the glass language. One surface:

- Boardroom agent tiles: add direction-aware hover to reveal the agent's last 3 `agent_memory` entries on hover. Reuse the existing `agent_memory` query; no new backend endpoint. File: [`frontend/components/boardroom/AgentTile.tsx`](frontend/components/boardroom/AgentTile.tsx) (audit exact path).

**Do not pull the full cult-ui dependency.** Copy the primitive + MIT notice into `frontend/lib/ui/direction-aware-hover.tsx`.

## Scope — Excluded

- No prompt changes for Oracle/Feucht/Consul/Herald (Track B owns `agent-instructions/*`).
- No new API routes.
- No mobile (`mobile/` untouched).
- No card variants beyond the six listed.

## Validation

1. `cd frontend && npx tsc --noEmit` clean.
2. `cd /Users/tifos/Desktop/Codebases/fintheon-s27-a && npx vite build` clean (after `find frontend/dist -mindepth 1 -delete`).
3. Live chat smoke: ask Harper "Give me NQ support and resistance for tomorrow" — expect `price-level` card.
4. Live chat smoke: ask Harper "What's the probability distribution for CPI print?" — expect `probability-table`.
5. Malformed-card fuzz: mock a response with invalid JSON inside the fence — expect graceful fallback + console warn, no blank bubble.

## Files to Touch

- NEW `shared/harper-cards.ts`
- NEW `frontend/lib/harper/stream-parser.ts` (if absent; else audit + extend)
- NEW `frontend/components/chat/parts/CardPartRenderer.tsx`
- NEW `frontend/components/chat/cards/*.tsx` (6 files)
- NEW `backend-hono/src/services/ai/agent-instructions/harper-cards.ts`
- NEW `frontend/lib/ui/direction-aware-hover.tsx` (cult-ui primitive)
- EDIT `frontend/components/chat/ChatMessageBubble.tsx`
- EDIT `backend-hono/src/services/harper-handler.ts`
- EDIT `frontend/components/boardroom/AgentTile.tsx` (if exists; else skip T6 polish)
- EDIT `src/lib/changelog.ts` (entry: "S27-T1 generative UI cards + stream fence")

## Ship

Commit prefix: `v.27.1`. One commit per logical unit (schema, parser, renderer, prompt, polish). PR body should cite the `harper-handler.ts:144` audit finding.
