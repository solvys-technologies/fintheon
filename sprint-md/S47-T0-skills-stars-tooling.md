# Sprint Brief: T0 -- Skills, Stars, and Tooling Intake

## Context

This track runs before implementation. TP added scope for GH Stars, devl.dev, impeccable.style 3, Matt Pocock skills, VibeVoice, Evil Charts, Executor, Jakub interface details, and dotmatrix loaders. This track produces the choice list and imports only approved skill/tooling updates into Solvys skills and agent guidance.

## Branch Target

`s47-wave0-tooling-intake`

## Scope -- Included

- [x] Review `solvys` GitHub starred repos and classify which are useful for S47.
- [x] Update `solvys-skills` guidance as architectural thinking only, not imported skills.
- [ ] Merge approved Matt Pocock skill guidance into global development-facing agent instructions after TP veto pass.
- [x] Update local impeccable import strategy to impeccable.style 3 if TP approves.
- [x] Add `devl.dev` as required reference step for new UI features.
- [ ] Evaluate `RhysSullivan/executor` as a secure agent integration layer candidate, report-only unless TP approves implementation.
- [ ] Evaluate `microsoft/VibeVoice` and `mpaepper/vibevoice` for speech-to-text replacement feasibility.
- [ ] Evaluate `evilcharts.com` and `dotmatrix.zzzzshawn.cloud` for copy-paste component adoption.

## Scope -- Excluded (DO NOT TOUCH)

- Product source implementation for RiskFlow, Arbitrum, Chat, Agentic Forum, Calendar, or Voice.
- Runtime routes, Supabase migrations, Electron shell, and package dependency changes unless TP explicitly approves a tool.
- Any paid API/service enablement.

## Reuse Inventory

- `.claude/takeover-import/fintheon-agent-takeover/` -- extracted takeover bundle already imported by orchestrator.
- `.claude/skills/impeccable/` -- current bundled impeccable subskills from takeover import.
- `.claude/skills/solvys-feels/` -- canonical Fintheon visual skill mirror.
- `/Users/tifos/.claude/skills/impeccable/` -- global impeccable import location.
- `CLAUDE.md` -- project rules and banned ornament constraints.
- `src/lib/changelog.ts` -- recent work ledger; add an entry after approved changes.

## Relevant GitHub Stars Found

- `software-mansion-labs/react-native-streamdown` -- relevant for Mobile PWA/React Native-style streaming markdown patterns if mobile chat rendering still breaks.
- `ksimback/tech-debt-skill` -- relevant for post-S47 audit, not core sprint implementation.
- `agno-agi/scout` -- potentially useful as context-agent inspiration; do not import into runtime without review.
- `Xquik-dev/x-twitter-scraper` -- relevant to RiskFlow X-source ingestion, but it is pay-per-use; blocked unless TP approves cost and privacy posture.
- `adi0900/MV---Design` -- relevant as design critique input; lower priority than impeccable.style 3 and Jakub details.
- `EveryInc/compound-engineering-plugin` -- relevant for agent workflow methodology; report-only.
- `obra/superpowers` -- relevant for skill framework methodology; report-only.
- `vercel-labs/skills` -- relevant for installing/importing skills cleanly.
- `addyosmani/agent-skills` -- relevant for production-grade engineering skill patterns.
- `mcollina/skills` -- relevant for Node/Bun/backend quality guidance.
- `detaildotdesign/skill` -- relevant to microinteraction/detail QA and overlaps with Jakub's interface detail skill.
- `solvys-technologies/solvys-skills` -- canonical repo to update after TP selection.
- `browser-use/browser-harness` -- already aligned with fallback strategy; keep as research/scrape/browser fallback.
- `nolly-studio/cult-ui` -- relevant as component inspiration only; avoid copying components that violate no-gradient/no-emoji/no-Kanban rules.
- `webadderallorg/Recordly` -- relevant for issue reproduction screenshots/recordings, not product runtime.
- `jamiepine/voicebox` -- relevant to voice stack, but TP specifically requested VibeVoice for STT.
- `vercel-labs/portless` -- useful for local agent/backend URLs; not part of S47 app repair.
- `vercel-labs/wterm` -- relevant only if terminal UI is revisited.
- `vercel-labs/json-render` -- relevant to structured generative UI cards; can inform Agentic Forum/Chat JSON-to-card rendering.
- `mksglu/context-mode` -- relevant to context reduction for large tool outputs; potential agent workflow upgrade.
- `zats/permiso` -- relevant to Electron permission prompts if voice/screen permissions are revisited.
- `Bitterbot-AI/bitterbot-desktop` -- relevant as local-first agent-memory inspiration; report-only.

## External References Found

- `https://jakub.kr/writing/details-that-make-interfaces-feel-better` -- actionable details: text-wrap balance/pretty, concentric radii, contextual icon animation, antialiasing, tabular numbers, interruptible transitions, split/staggered entrance, subtle exits, optical alignment, image outlines. Shadow guidance must be adapted because Fintheon bans generic gray/shadow-heavy card grids.
- `https://github.com/jakubkrehel/make-interfaces-feel-better` -- installable skill via `npx skills add jakubkrehel/make-interfaces-feel-better`.
- `https://devl.dev` -- copy-paste UI experiment reference. Relevant sections: layouts, cards, modals, charts, timelines, calendars, toasts, threads. Use as reference for new feature layouts, not as a dependency by default.
- `https://evilcharts.com` -- open-source chart UI built on Recharts/shadcn. Use where charts are needed inside tab views, not inline clutter.
- `https://dotmatrix.zzzzshawn.cloud` -- React/TypeScript/Tailwind/shadcn loaders. Relevant loaders: Braille Beat, Radar Arc, Core Spiral, Echo Ring, Phase Orb. Must be adapted to Solvys Gold and no decorative sparkle language.
- `https://github.com/microsoft/VibeVoice` -- includes VibeVoice-ASR docs for long-form STT/transcription.
- `https://github.com/mpaepper/vibevoice` -- fast local STT/dictation app; evaluate if it is actually compatible with Fintheon runtime.
- `https://github.com/RhysSullivan/executor` -- secure integration layer for agents to call OpenAPI/MCP/GraphQL/custom JS functions.
- `https://github.com/mattpocock/skills` -- skills for real engineers; merge approved guidance into Solvys development agent docs.
- `https://impeccable.style/skills/` -- impeccable.style 3 has 23 subcommands via one `/impeccable` skill; use this as the target upgrade if TP approves.

## Known Issues to Preserve

- Do not overwrite `.claude/skills/solvys-*` blindly; they are repo-local mirrors and may be symlinked globally.
- Do not weaken project rules: no emojis, no gradients, no Kanban borders, no AI sparkles.
- Do not add paid services or API calls from starred repos without TP signoff.

## Implementation Steps

1. Create `sprint-md/S47-TOOLING-STARS-AUDIT.md` with a table of the relevant stars above, recommendation, risk, and sprint usage.
2. Read `https://impeccable.style/tutorials/getting-started` and `https://impeccable.style/skills/`; compare against `.claude/skills/impeccable/`.
3. Read `https://github.com/mattpocock/skills`; list exact skills worth merging into Solvys developer agent guidance.
4. Read `https://github.com/RhysSullivan/executor`; report whether it should be used as a future tool-broker layer or deferred.
5. Read `https://github.com/microsoft/VibeVoice/blob/main/docs/vibevoice-asr.md`; determine local/server runtime requirements and whether Electron/mobile can use it.
6. Read Evil Charts and dotmatrix docs for installation/copy-paste method. Do not install dependencies until TP picks components.
7. Update `sprint-md/S47-ORCHESTRATION.md` notes with TP-selected tool upgrades.
8. If TP approves skill changes, update the canonical Solvys skill source, then refresh `.claude/skills/` mirrors.
9. Add a changelog entry to `src/lib/changelog.ts` only if files are modified beyond planning docs.

## Acceptance Criteria

- [x] A full GH Stars veto list exists for TP selection.
- [x] Each requested external tool has a recommendation: adopt now, candidate thinking source, vetoed, or reject for runtime.
- [x] No runtime code or dependencies are changed before TP chooses tooling upgrades.
- [x] Future UI briefs explicitly require devl.dev review and Jakub detail checks.

## Validation Commands

```bash
# Planning/docs track only. If no source files changed, no build required.
git status --short

# If Solvys skill files are changed, verify they are present.
ls -la .claude/skills
```

## Commit Format

```bash
[v5.34.0] docs: T0 audit S47 tooling and starred repos
```
