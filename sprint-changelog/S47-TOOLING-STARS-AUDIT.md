# S47 Tooling and Stars Audit

## Purpose

This is TP's veto sheet. The default interpretation is architectural influence only: read approved references for patterns, constraints, vocabulary, failure modes, and review heuristics. Do not import external skills, add dependencies, enable services, call paid APIs, or copy runtime code unless TP separately approves that specific implementation.

## Decision State

| Tooling                 | Decision                    | Reason                                                                                                                                                                             | Next action                                                                                                |
| ----------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Impeccable v3           | Adopt now                   | TP approved. v3 consolidates the old many-skill import into one `/impeccable` skill with 23 routed commands, context loading, craft/shape gates, and design anti-pattern checks.   | Installed repo-local at `.claude/skills/impeccable/`. Use for S47 UI tracks, constrained by Fintheon bans. |
| devl.dev                | Adopt now as reference only | Useful copy-paste UI experiment reference for layouts, cards, modals, charts, timelines, calendars, toasts, and threads. No dependency needed.                                     | Require new UI briefs to review devl.dev before implementation.                                            |
| Jakub interface details | Adopt now as checklist      | Text wrap, concentric radii, tabular numbers, optical alignment, antialiasing, interruptible transitions, and contextual icon motion map well to Solvys UI quality.                | Apply in UI review and polish steps. Adapt shadow guidance to Solvys glass/gold rules.                     |
| Matt Pocock skills      | Candidate thinking source   | Strong engineering workflow guidance. Treat as patterns for diagnosis, TDD, domain language, context shaping, and issue slicing, not skills to import.                             | TP can veto or approve as an architectural influence source.                                               |
| RhysSullivan/executor   | Candidate thinking source   | Good model for secure tool catalogs, typed invocation, auth, local daemon UX, and approval gates. Too large and security-sensitive for S47 implementation.                         | TP can veto or approve as architectural influence only.                                                    |
| microsoft/VibeVoice-ASR | Candidate thinking source   | Promising ASR architecture: long-form transcription, diarization, timestamps, hotwords, multilingual support. Runtime requires Python/CUDA/server orchestration.                   | TP can veto or approve as voice architecture influence only.                                               |
| mpaepper/vibevoice      | Reject for product runtime  | Local dictation app built around Python 3.13, CUDA, PortAudio, keyboard hooks, screenshots, and Ollama. Useful inspiration, not compatible with Fintheon app runtime expectations. | Do not adopt. Borrow UX ideas only if voice track needs push-to-talk patterns.                             |
| Evil Charts             | Candidate thinking source   | Recharts/shadcn chart recipes are relevant for chart composition, tabbed chart placement, tooltips, legends, and motion restraint.                                                 | TP can veto or approve as chart architecture influence only.                                               |
| dotmatrix loaders       | Candidate thinking source   | Loader library is useful for naming, pacing, compact loading states, and skeleton alternatives.                                                                                    | TP can veto or approve as loading-state influence only.                                                    |

## TP Vetoes

These repos are excluded from Solvys architectural synthesis for S47 and should not be referenced as thinking sources:

- `Xquik-dev/x-twitter-scraper`
- `EveryInc/compound-engineering-plugin`
- `jamiepine/voicebox`
- `elder-plinius/CL4R1T4S`
- `Bitterbot-AI/bitterbot-desktop`

## Full GitHub Stars Veto List

Fetched from authenticated GitHub account `solvys` on 2026-04-28. Unless TP vetoes a row, it can inform Solvys architectural thinking. This does not mean code, packages, services, or skills should be imported.

| Repo                                            | Language   |  Stars | Description                                       | Proposed architectural influence                                                | TP veto? |
| ----------------------------------------------- | ---------- | -----: | ------------------------------------------------- | ------------------------------------------------------------------------------- | -------- |
| `software-mansion-labs/react-native-streamdown` | TypeScript |    275 | Markdown streaming for React Native               | Mobile streaming markdown rendering patterns and incremental content stability. |          |
| `ksimback/tech-debt-skill`                      | Unknown    |    276 | Claude Code skill for file-cited tech debt audits | File-cited audit format and debt taxonomy for post-sprint review.               |          |
| `agno-agi/scout`                                | Python     |     53 | Self-managing context agent                       | Context-agent decomposition and bounded autonomy patterns.                      |          |
| `Xquik-dev/x-twitter-scraper`                   | JavaScript |     61 | X data platform skill for coding agents           | VETOED: do not use as S47 influence.                                            | Yes      |
| `adi0900/MV---Design`                           | Shell      |     33 | Design anti-slop skill                            | Visual critique vocabulary and anti-slop checks.                                |          |
| `EveryInc/compound-engineering-plugin`          | TypeScript |  15745 | Compound Engineering plugin                       | VETOED: do not use as S47 influence.                                            | Yes      |
| `obra/superpowers`                              | Shell      | 171136 | Agentic skills framework and methodology          | Skill methodology, repeatable engineering rituals, and role clarity.            |          |
| `vercel-labs/skills`                            | TypeScript |  16363 | Open agent skills tool                            | Skill packaging, installation, lockfile, and sync mechanics.                    |          |
| `addyosmani/agent-skills`                       | Shell      |  25144 | Production-grade engineering skills               | Production review heuristics and engineering quality gates.                     |          |
| `mcollina/skills`                               | TypeScript |   1755 | Modern Node.js development skills                 | Backend quality patterns for Node/Bun services.                                 |          |
| `detaildotdesign/skill`                         | Unknown    |     15 | Microinteractions and detail craft                | Interface-detail review and microinteraction discipline.                        |          |
| `solvys-technologies/solvys-skills`             | Unknown    |      1 | Solvys Skills Suite                               | Canonical Solvys skill source and mirror strategy.                              |          |
| `browser-use/browser-harness`                   | Python     |   7818 | Self-healing browser harness                      | Browser verification model and adversarial UI testing inspiration.              |          |
| `nolly-studio/cult-ui`                          | TypeScript |   3990 | Copy-paste design-engineering components          | Component composition inspiration, filtered through Solvys bans.                |          |
| `webadderallorg/Recordly`                       | TypeScript |  10783 | Open-source screen recordings                     | Reproduction capture and issue evidence workflow.                               |          |
| `jamiepine/voicebox`                            | TypeScript |  23839 | Open-source AI voice studio                       | VETOED: do not use as S47 influence.                                            | Yes      |
| `vercel-labs/portless`                          | TypeScript |   8015 | Stable named local URLs                           | Local agent/backend URL ergonomics.                                             |          |
| `vercel-labs/wterm`                             | TypeScript |   2571 | Terminal emulator for web                         | Terminal UI architecture if Fintheon revisits embedded terminals.               |          |
| `vercel-labs/json-render`                       | TypeScript |  14509 | Generative UI framework                           | Typed JSON-to-card rendering and generative UI boundaries.                      |          |
| `elder-plinius/CL4R1T4S`                        | Unknown    |  25732 | Leaked system prompts archive                     | VETOED: do not use as S47 influence.                                            | Yes      |
| `mksglu/context-mode`                           | TypeScript |  10884 | Context-window optimization for coding agents     | Tool-output sandboxing, context reduction, and agent attention hygiene.         |          |
| `zats/permiso`                                  | Swift      |    398 | Permission dialog for accessibility settings      | Electron/macOS permission UX patterns.                                          |          |
| `Bitterbot-AI/bitterbot-desktop`                | TypeScript |   1255 | Local-first AI agent desktop                      | VETOED: do not use as S47 influence.                                            | Yes      |
| `solvys-technologies/fintheon`                  | TypeScript |      2 | Fintheon app                                      | Current product source of truth.                                                |          |

## Initial Useful Clusters

These are working clusters for S47 planning. They remain architectural influence categories only unless TP approves implementation.

| Repo                                            | Influence cluster                 | Risk                                                                    | S47 usage                                                                                                                                         |
| ----------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `solvys-technologies/solvys-skills`             | Canonical source strategy         | Accidental drift if repo-local mirrors are edited without upstream sync | Update Solvys-native guidance after TP choices, not by importing external skills.                                                                 |
| `vercel-labs/skills`                            | Skill packaging mechanics         | Installer can overwrite local skill mirrors if run broadly              | Use as lockfile/install/sync reference only.                                                                                                      |
| `addyosmani/agent-skills`                       | Production engineering gates      | Generic patterns may conflict with local Fintheon rules                 | Mine for production-grade review/checklist patterns after S47.                                                                                    |
| `mattpocock/skills`                             | Architectural influence candidate | Workflow docs may overlap with existing Solvys commands                 | Mine thinking patterns from `diagnose`, `tdd`, `grill-with-docs`, `zoom-out`, `improve-codebase-architecture`, `to-issues`; do not import skills. |
| `mcollina/skills`                               | Backend service quality           | Backend guidance must match Bun/Hono/Supabase constraints               | Review for Node/Bun backend quality after backend tracks stabilize.                                                                               |
| `detaildotdesign/skill`                         | Interface detail craft            | May duplicate Impeccable/Jakub detail checks                            | Fold useful detail heuristics into Solvys review language.                                                                                        |
| `browser-use/browser-harness`                   | Browser verification              | Browser automation can expand test surface and flake if unmanaged       | Keep as browser/adversarial-test architecture reference.                                                                                          |
| `software-mansion-labs/react-native-streamdown` | Mobile streaming markdown         | Mobile renderer changes could destabilize chat                          | Use as rendering architecture reference if T4 confirms mobile streaming markdown still breaks.                                                    |
| `vercel-labs/json-render`                       | Typed generative UI               | Structured generative UI could sprawl into product runtime              | Use as JSON-to-card boundary reference for Agentic Forum/Chat.                                                                                    |
| `mksglu/context-mode`                           | Agent context hygiene             | Agent workflow-only benefit, not product repair                         | Consider for context reduction and tool-output sandboxing.                                                                                        |
| `ksimback/tech-debt-skill`                      | File-cited debt audit             | Audit scope could distract from current repair sprint                   | Save audit taxonomy for post-S47 technical debt review.                                                                                           |
| `agno-agi/scout`                                | Context-agent pattern             | Runtime agent import risk                                               | Context-agent inspiration only.                                                                                                                   |
| `EveryInc/compound-engineering-plugin`          | VETOED                            | TP vetoed                                                               | Do not use as S47 influence.                                                                                                                      |
| `obra/superpowers`                              | Skills methodology                | Skill-framework overlap                                                 | Use as skill methodology reference only.                                                                                                          |
| `nolly-studio/cult-ui`                          | Component composition             | Components may violate no-gradient/no-emoji/no-Kanban rules             | Inspiration only; manually adapt if ever used.                                                                                                    |
| `adi0900/MV---Design`                           | Design anti-slop critique         | Lower priority than Impeccable/Jakub                                    | Use as critique vocabulary input only.                                                                                                            |
| `webadderallorg/Recordly`                       | Reproduction evidence             | Runtime recording/screenshot privacy risk                               | Use as recording workflow reference only.                                                                                                         |
| `vercel-labs/portless`                          | Local URL ergonomics              | Local URL tooling not core S47                                          | Consider for agent/backend local URL ergonomics later.                                                                                            |
| `vercel-labs/wterm`                             | Terminal UI architecture          | Terminal UI is not in S47 scope                                         | Revisit only if terminal UI returns.                                                                                                              |
| `zats/permiso`                                  | OS permission UX                  | Electron permissions need careful UX and OS testing                     | Consider if voice/screen permissions are revisited.                                                                                               |
| `Bitterbot-AI/bitterbot-desktop`                | VETOED                            | TP vetoed                                                               | Do not use as S47 influence.                                                                                                                      |
| `Xquik-dev/x-twitter-scraper`                   | VETOED                            | TP vetoed                                                               | Do not use as S47 influence.                                                                                                                      |
| `jamiepine/voicebox`                            | VETOED                            | TP vetoed                                                               | Do not use as S47 influence.                                                                                                                      |

## Impeccable v3 Import Notes

- Current repo-local import is now a single `.claude/skills/impeccable/SKILL.md` with `agents/`, `reference/`, and `scripts/` support directories.
- `skills-lock.json` now records `pbakaus/impeccable` and its computed hash for restore/sync tooling.
- This replaces the previous takeover import shape where `adapt`, `animate`, `audit`, `bolder`, and other commands were separate subskill directories.
- The installed v3 skill has some defaults that conflict with Fintheon rules, especially its generic warning against default glassmorphism and its allowance for broader palettes. Fintheon project rules win: Solvys Gold, no gradients, no emojis, no AI sparkles, no Kanban borders, and glass-style surfaces remain preferred when appropriate.
- Do not run `$impeccable teach` or `$impeccable document` without TP approval because they can create or rewrite root-level `PRODUCT.md` and `DESIGN.md`.

## Required S47 UI Brief Additions

- Before new UI implementation, review devl.dev for relevant layout/component references.
- Before final UI review, run a Jakub detail checklist: text wrapping, concentric radii, tabular numbers, optical alignment, image outlines, antialiasing, interruptible transitions, and contextual icon motion.
- Use `/impeccable` for UI critique, audit, polish, layout, typeset, animate, clarify, adapt, harden, and craft flows, but keep all Fintheon visual bans stronger than the upstream skill defaults.

## Skills Suite Updates Applied

- Added Solvys design synthesis at `.claude/skills/solvys-feels/reference/design-guidelines.md` and mirrored it into the imported Solvys suite source.
- Added Solvys engineering synthesis at `.claude/skills/solvys-brief/reference/engineering-guidelines.md`.
- Updated `/solvys-feels`, `/solvys-brief`, `/solvys-orchestrate`, `/solvys-audit`, `/solvys-test`, `/solvys-inform`, and `/solvys-transitions` so approved references become architectural heuristics, not imported skills or runtime code.
- Reconciled the old no-glass wording with current Solvys design doctrine: frosted-glass surfaces are allowed and preferred over Kanban/card grids when separation is needed; gradients, AI sparkles, emojis, Kanban borders, and generic shadows remain banned.
- Updated project `CLAUDE.md` and `backend-hono/CLAUDE.md` with the same development/design doctrine and TP-veto list.

## New Solvys-Native Single Skills Created

| Skill                     | Non-vetoed influence set                                                                                            | Purpose                                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/solvys-diagnose`        | `addyosmani/agent-skills`, Matt Pocock diagnosis/TDD patterns                                                       | Evidence-backed debugging loop with root cause and regression-test plan.                                                                                                |
| `/solvys-backend-quality` | `mcollina/skills`, backend quality patterns                                                                         | Node/Bun/Hono route/service/data/auth/diagnostics review.                                                                                                               |
| `/solvys-tech-debt`       | `ksimback/tech-debt-skill`, production engineering gates                                                            | File-cited debt audit with severity and sprint-slice recommendations.                                                                                                   |
| `/solvys-context`         | `mksglu/context-mode`, `agno-agi/scout`                                                                             | Context hygiene, handoff compression, and agent attention discipline.                                                                                                   |
| `/solvys-browser-verify`  | `browser-use/browser-harness`, Solvys browser-harness semantics                                                     | Browser-facing adversarial verification for desktop, mobile, and Electron surfaces.                                                                                     |
| `/solvys-ui-detail`       | `detaildotdesign/skill`, `adi0900/MV---Design`, Jakub detail checks                                                 | Fine-grained UI craft review without ornament or copied upstream visual language.                                                                                       |
| `/solvys-ui-cleanup`      | Impeccable polish/audit framing, Jakub detail checks, dotmatrix loading-state discipline, Evil Charts chart hygiene | Practical cleanup pass for overlooked state-of-the-art design touches: states, alignment, typography, responsive polish, motion, charts, loaders, and Solvys materials. |

## Recommendation Summary

- Adopt now: Impeccable v3, devl.dev reference step, Jakub detail checklist.
- Architectural influence candidates after TP veto: all non-vetoed rows in the full GitHub stars list above, plus Matt Pocock engineering patterns, Executor tool-broker patterns, Microsoft VibeVoice-ASR voice architecture, Evil Charts chart composition, and dotmatrix loading-state ideas.
- TP-vetoed from architectural influence: `Xquik-dev/x-twitter-scraper`, `EveryInc/compound-engineering-plugin`, `jamiepine/voicebox`, `elder-plinius/CL4R1T4S`, `Bitterbot-AI/bitterbot-desktop`.
- Reject for product runtime now: mpaepper/vibevoice.
