# Sprint Brief: T13 — NOTICES File + User-Visible Hermes Cleanup + OSS Sweep

## Context

Fintheon pulls inspiration from several OSS projects (Nous Research's Hermes, Together AI's MoA, aaronjmars/MiroShark, TradingAgents, Ollama, Qwen, shadcn, Radix, Framer Motion). TP's directive: nobody outside should read Fintheon's stack off its user-visible surfaces. Credit the OSS sources in a dedicated `NOTICES.md` file; scrub user-visible "Hermes" strings from UI copy (the internal service name and all symbol names stay — Hermes is Fintheon's proprietary term now). Model family names (Qwen, Claude, Gemini, Grok) stay visible — TP picked "status-honest."

## Branch Target

`s35-t13-notices-oss` (off `s34-unified`)

## Scope — Included

### NEW `/Users/tifos/Documents/Codebases/fintheon/NOTICES.md`

```markdown
# NOTICES — Open-Source Attribution

Fintheon (by Priced In Capital / Solvys Technologies) builds on research and code from the following open-source projects. We credit them here so our stack's lineage is transparent even when our user-facing surfaces are proprietary.

## AI / Agent Research

### Hermes (inspired by Nous Research's Nous Hermes family)

Fintheon's "Hermes" layer — our internal sub-agent runner and model-fallback chain — is named in homage to Nous Research's open-weight Hermes models (Nous Hermes 4 / Hermes 3 / Hermes 2 Pro). The implementation is Fintheon's own; only the name is inspired by their work.

- Nous Research: https://nousresearch.com
- Nous Hermes models (HuggingFace): https://huggingface.co/NousResearch

### MoA — Mixture of Agents (Together AI)

Fintheon's per-seat layered distillation inside the Arbitrum deliberation engine draws from the MoA (Mixture of Agents) technique described by Together AI.

- Paper / blog: https://www.together.ai/blog/together-moa
- Reference repo: https://github.com/togethercomputer/MoA
- License: Apache 2.0

### MiroShark (aaronjmars/MiroShark)

MiroShark was Fintheon's prior deliberation engine (retired 2026-04-24 in S35). Thanks to the authors for the original concept; we replaced it with Arbitrum because the persona-swarm approach produced groupthink on market calls, but the design vocabulary (swarm + deliberation + persona memory) informed Arbitrum's chamber structure.

- Repo: https://github.com/aaronjmars/MiroShark
- License: Check repo

### TradingAgents (arxiv 2412.20138)

Arbitrum's 5-seat role taxonomy (Lead Analyst, Forecaster, Risk Manager, Bull Case, Bear Case with a facilitator-driven debate) maps onto the TradingAgents framework described in arxiv 2412.20138.

- Paper: https://arxiv.org/abs/2412.20138

### Kalshi / Polymarket-adjacent AI bots

Arbitrum's disagreement-veto pattern and category-scorer gates were informed by publicly-documented Kalshi trading bots (ryanfrigo/kalshi-ai-trading-bot etc). We are not affiliated; we built our own version.

## Inference / Models

### Qwen (Alibaba Cloud)

Arbitrum seats use Qwen3-235B-A22B, Qwen2.5-72B-Instruct, QwQ-32B-Preview, Qwen2.5-Coder-32B, Qwen3-14B. Open-weight family under Apache 2.0 / Tongyi Qianwen License.

- Qwen on HuggingFace: https://huggingface.co/Qwen
- Alibaba DashScope: https://dashscope.aliyuncs.com

### Ollama

Ollama hosts the Qwen seats that fit Fintheon's local hardware.

- Site: https://ollama.com
- License: MIT

### Groq

Free-tier API fallback for Qwen3-235B-class models when Ollama can't host.

- Site: https://groq.com

## UI / Frontend

### shadcn/ui and Radix UI

Primitive components used throughout the frontend (dialogs, popovers, dropdowns, etc). Fintheon styles them via the Solvys Gold palette and removes visual defaults (no gradients, no glass).

- shadcn/ui: https://ui.shadcn.com — MIT
- Radix UI: https://www.radix-ui.com — MIT

### Lucide Icons

Icon set used in buttons and status indicators.

- Site: https://lucide.dev — ISC License

### Framer Motion

Animation primitives on select surfaces (not used as a gradient / shimmer source; kept minimal per /solvys-feels).

- Site: https://www.framer.com/motion — MIT

### Doto (display font)

Numeric probability displays use the Doto font family.

- Attribution maintained in frontend/public fonts directory

### Nothing OS — design-language inspiration

Fintheon's "NothingFuse" primitive and general industrial-luxe monochrome aesthetic take cues from Nothing Phone OS. No code pulled — purely visual inspiration.

## Infrastructure

### Hono, Vite, Bun, React, TypeScript, Supabase, Fly.io, Vercel

Standard modern stack — crediting implicitly via package.json dependencies. No special attribution beyond their respective licenses.

## Changes to this NOTICES file

Every time an OSS inspiration is added or removed from Fintheon, this file gets an entry. Changelog date stamps in commit messages.

---

_Last updated: 2026-04-24 (S35 ship)_
```

### User-visible Hermes cleanup (text-only, no symbol renames)

Each edit replaces user-visible "Hermes" strings with generic "AI gateway" / "CAO sub-agents" style copy. The component/hook/file names stay — only the rendered user-facing text changes.

| File:Line                                                                                                                           | Current                                                   | New                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/contexts/SystemStatusContext.tsx:52`                                                                                      | `"Hermes AI (OpenRouter)": "ai"`                          | `"AI Gateway": "ai"` (keep map key changing to match renders; adjust all call sites simultaneously)                                                                         |
| `frontend/contexts/SystemStatusContext.tsx:59`                                                                                      | `"Hermes AI (OpenRouter)": "AI"`                          | `"AI Gateway": "AI"`                                                                                                                                                        |
| `frontend/contexts/GatewayContext.tsx:137`                                                                                          | `"Hermes AI unavailable — check OpenRouter API key"`      | `"AI Gateway unavailable — check OpenRouter API key"`                                                                                                                       |
| `frontend/contexts/GatewayContext.tsx:163`                                                                                          | `// Re-check health to see if Hermes recovered` (comment) | leave OR update to `// Re-check health to see if the AI gateway recovered` (optional; comments are internal, not user-visible. Keep original if you want to minimize churn) |
| `frontend/contexts/GatewayContext.tsx:207,222,242,259,284`                                                                          | various "Hermes" toast strings                            | "AI Gateway" in toast copy only                                                                                                                                             |
| `frontend/components/SettingsPanel.tsx:87`                                                                                          | `label: "Hermes:Admin"`                                   | `label: "AI Gateway:Admin"` (settings-panel tab label)                                                                                                                      |
| `frontend/components/consilium/ConsiliumTabConfig.ts:69`                                                                            | `subtitle: "Chat with Hermes & CAO"`                      | `subtitle: "CAO and sub-agents"`                                                                                                                                            |
| `frontend/components/journal/SessionJournalPanel.tsx:243`                                                                           | `Hermes Summary` (JSX text node)                          | `Session Summary`                                                                                                                                                           |
| `frontend/components/layout/FooterToolbar.tsx:55`                                                                                   | `label: "Start Hermes gateway"`                           | `label: "Start AI gateway"`                                                                                                                                                 |
| `frontend/components/settings/HermesAdminTab.tsx` tab-label renders (search for the actual visible label text in the component JSX) | "Hermes Admin" or similar                                 | "AI Gateway Admin"                                                                                                                                                          |
| `frontend/components/settings/HermesSettings.tsx` tab-label renders                                                                 | "Hermes Settings" / "Hermes AI verification"              | "AI Gateway Settings" / "AI Gateway verification"                                                                                                                           |

NOTE: The FILE names `HermesAdminTab.tsx`, `HermesSettings.tsx` STAY. The JSX string literals they render get updated. Symbol names, imports, route paths, class names — ALL stay. Zero symbol renames.

### General-purpose sweep

After completing the Hermes-specific list, grep for residual user-visible OSS-branded strings in frontend + mobile:

```bash
grep -rnE "(Nous|nous-hermes|Mixture of Agents|\\bMoA\\b|together\\.ai|MiroShark|TradingAgents)" --include="*.tsx" --include="*.ts" frontend/ mobile/ 2>/dev/null | grep -v node_modules | grep -v changelog.ts | grep -v sprint-
```

Expected result: zero or near-zero hits. Any hit that IS a user-visible string (JSX text, toast message, placeholder, label) gets renamed to a generic term. Hits in comments are optional.

Model family names (Qwen, Claude, Gemini, Grok, DeepSeek) are EXPLICITLY PERMITTED in UI per TP's "show model IDs everywhere (status honest)" decision. Do NOT abstract those.

## Scope — Excluded (DO NOT TOUCH)

- **Every backend file named `hermes-*.ts`** (hermes-handler.ts, hermes-service.ts, hermes-sessions.ts) — STAYS. Hermes is Fintheon's proprietary term internally.
- **Every frontend hook / component with "Hermes" in the symbol name** (`useHermesChat`, `useHermesRuntime`, `HermesChatResponse`, `hermesAgentRouting`) — STAYS.
- **File names** `HermesAdminTab.tsx`, `HermesSettings.tsx` — STAY. Only the JSX text inside them changes.
- **API routes** `/api/diagnostics/hermes/restart` — STAYS (internal route, not user-visible).
- **Import paths** across the frontend — STAY.
- **Model family names** in UI (Qwen, Claude, Gemini, Grok) — STAY per TP's decision. Do NOT replace with "primary model" etc.
- Any file touched by T1-T12 (Arbitrum + other renames have their own tracks).

## Reuse Inventory

- Grep pattern for user-visible Hermes strings (live-code only, excluding comments and historical records): see above in Scope
- `NOTICES.md` goes at repo root: `/Users/tifos/Documents/Codebases/fintheon/NOTICES.md` (same level as CLAUDE.md, README.md)

## Known Issues to Preserve

- Hermes-the-term stays internal. TP explicitly rejected a full rename ("User-visible only" was the answer).
- Changing the map keys in `SystemStatusContext.tsx:52,59` cascades to everywhere the map is consumed. Grep `"Hermes AI (OpenRouter)"` across frontend/ before changing the key; ensure no stale reference after.
- Don't break the `GatewayContext.tsx` health-check logic — just change the user-visible strings. The `/health` endpoint parsing and the restart flow stay identical.
- The `HermesAdminTab.tsx` and `HermesSettings.tsx` components likely render a heading label internally (e.g., `<h2>Hermes Settings</h2>`) — find that string and rename the user-visible text only. Component export name stays `HermesSettings`.

## Implementation Steps

1. Write `NOTICES.md` at repo root with the content above
2. Edit `SystemStatusContext.tsx:52,59` — rename map key, then grep for `"Hermes AI (OpenRouter)"` across `frontend/` and update every consumer to `"AI Gateway"`
3. Edit `GatewayContext.tsx` toast strings at the 8 numbered lines
4. Edit `SettingsPanel.tsx:87` tab label
5. Edit `ConsiliumTabConfig.ts:69` subtitle
6. Edit `SessionJournalPanel.tsx:243` card heading
7. Edit `FooterToolbar.tsx:55` button label
8. Open `HermesAdminTab.tsx` and `HermesSettings.tsx`; find JSX text that says "Hermes" and update
9. Run the residual grep to find any stray user-visible OSS-branded strings; update as needed
10. Run build: `npx tsc --noEmit --project frontend/tsconfig.json` + `rm -rf frontend/dist && cd frontend && npx vite build`

## Acceptance Criteria

- [ ] `/Users/tifos/Documents/Codebases/fintheon/NOTICES.md` exists with all OSS attributions
- [ ] Zero user-visible "Hermes" strings remaining (grep `>Hermes` or `Hermes"` in JSX text matches zero)
- [ ] Backend file names, frontend symbol names, route paths, hook names all STILL contain "Hermes" (unchanged)
- [ ] Map key rename in SystemStatusContext propagated correctly (no broken references)
- [ ] `tsc --noEmit` clean
- [ ] `rm -rf frontend/dist && cd frontend && npx vite build` clean
- [ ] Settings panel still renders correctly (tab label now "AI Gateway:Admin")
- [ ] Consilium chat subtitle shows "CAO and sub-agents"
- [ ] Session Journal card heading shows "Session Summary"
- [ ] Footer toolbar button shows "Start AI gateway"
- [ ] Model family names (Qwen, Claude, etc.) untouched anywhere

## Validation Commands

```bash
# NOTICES exists
ls -la /Users/tifos/Documents/Codebases/fintheon/NOTICES.md

# Zero user-visible Hermes (JSX strings and quoted literals in live code, not comments/symbols)
grep -rnE "(>[^<]*\\bHermes\\b|\"[^\"]*\\bHermes\\b[^\"]*\")" --include="*.tsx" --include="*.ts" frontend/ mobile/ 2>/dev/null | grep -v node_modules | grep -v changelog | grep -v sprint-

# Hermes symbols still present (file/component/hook names — these SHOULD show up)
grep -rnE "HermesSettings|HermesAdminTab|useHermesChat|hermes-handler" --include="*.ts" --include="*.tsx" frontend/ backend-hono/src/ 2>/dev/null | grep -v node_modules | wc -l   # expect > 0

# Model names still present (SHOULD show)
grep -rnE "Qwen|Claude|Gemini|Grok" --include="*.tsx" --include="*.ts" frontend/components/arbitrum/ 2>/dev/null | wc -l   # expect > 0 if T3 seat cards shipped

# Builds
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf frontend/dist && (cd frontend && npx vite build)
```

## Commit Format

```
[v5.25.0-S35-T13] feat: NOTICES.md + user-visible Hermes cleanup

Adds NOTICES.md at repo root crediting Nous Research (Hermes
inspiration), Together AI (MoA), aaronjmars/MiroShark, TradingAgents
authors, Qwen team / Alibaba, Ollama, shadcn/Radix/Lucide/Framer
Motion, Nothing OS design inspiration.

Scrubs user-visible Hermes strings from UI: SystemStatusContext map
key -> "AI Gateway", GatewayContext toasts, SettingsPanel tab label,
ConsiliumTabConfig subtitle -> "CAO and sub-agents", SessionJournal
card -> "Session Summary", FooterToolbar button -> "Start AI gateway",
HermesSettings/HermesAdminTab tab headings.

ZERO symbol renames. Backend hermes-*.ts files, frontend useHermesChat
/ HermesSettings / etc. component and hook names, /api/diagnostics/
hermes/restart route, hermesAgentRouting lib — all unchanged (Hermes
is Fintheon's proprietary term internally).

Model family names (Qwen, Claude, Gemini, Grok) stay visible per TP
"status-honest" decision.
```
