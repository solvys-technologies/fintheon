# Solvys Skills Suite

A Claude Code skills suite for design, development, orchestration, and deployment -- built by Solvys Technologies.

## Install

**Automatic:**

```bash
npx skills add solvys-technologies/solvys-skills
```

**Manual:**
Clone this repo and copy `.claude/skills/` into your project's `.claude/` directory.

## Skills

| Skill           | Invoke                    | Purpose                                                                                                                                      |
| --------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Orchestrate     | `/solvys-orchestrate`     | Multi-track sprint planning with parallel agent briefings                                                                                    |
| Audit           | `/solvys-audit`           | Pre-flight checks, debugging, environment audit, security scan                                                                               |
| Inform          | `/solvys-inform`          | Brief an AI agent on project context and recent changes                                                                                      |
| Deploy          | `/solvys-deploy`          | Pre-flight, deploy release, test, fix-and-redeploy cycle                                                                                     |
| Beta            | `/solvys-beta`            | Local build, test, and DMG publish to desktop                                                                                                |
| Feels           | `/solvys-feels`           | Visual architecture -- Solvys Gold palette, flat design, industrial warmth                                                                   |
| Transitions     | `/solvys-transitions`     | 9 paste-ready CSS transitions tuned for Solvys (modal, dropdown, panel, badge, icon swap, text swap, page slide, card resize, number pop-in) |
| Diagnose        | `/solvys-diagnose`        | Evidence-backed debugging loop: reproduce, minimize, hypothesize, instrument, root cause, regression test                                    |
| Backend Quality | `/solvys-backend-quality` | Node/Bun/Hono backend boundary, runtime, data, auth, and diagnostics review                                                                  |
| Tech Debt       | `/solvys-tech-debt`       | File-cited technical debt audit with severity and sprint-slice recommendations                                                               |
| Context         | `/solvys-context`         | Context hygiene and handoff compression for long agent sessions                                                                              |
| Browser Verify  | `/solvys-browser-verify`  | Browser-facing adversarial verification for desktop, mobile, and Electron surfaces                                                           |
| UI Detail       | `/solvys-ui-detail`       | Fine-grained Solvys UI craft review: hierarchy, alignment, typography, surfaces, states                                                      |
| UI Cleanup      | `/solvys-ui-cleanup`      | Systematic pass for overlooked state-of-the-art UI polish: states, alignment, typography, motion, responsive details                         |

## Solvys Feels -- Design System

The `solvys-feels` skill includes full theme presets, font kits, and CSS token maps imported from production Solvys applications. See the [reference/](/.claude/skills/solvys-feels/reference/) directory for:

- **Theme presets** -- 9 production themes with severity colors and bullish/bearish pairs
- **Font kit** -- 7 font families with self-hosted WOFF2 definitions and Readable Digits numeric override
- **CSS token map** -- Complete variable system for backgrounds, text, buttons, borders
- **Color palette** -- Full Solvys Gold/Stone token reference in hex and OKLCH

## Design Principles

- No gradients, emojis, AI sparkles, glitter, aurora effects, or Kanban side-stripe borders
- No generic shadow-heavy card grids; structure, type, and material create hierarchy
- Frosted-glass surfaces are preferred over Kanban cards when separation is needed: translucent warm dark fill, subtle backdrop blur, thin low-opacity gold border
- OKLCH/tinted neutrals where possible, with Solvys Gold as the single default accent
- Monochrome canvas with purposeful data color only
- Industrial warmth -- precise but not cold

## Engineering Principles

- Work in small vertical slices with a clear validation path.
- Diagnose by reproducing, minimizing, hypothesizing, instrumenting, fixing, and regression-testing.
- Keep domain language canonical and update architecture through Solvys-native guidance, not imported external skills.
- Separate I/O, validation, prompting, routing, and presentation.
- Treat typed tool catalogs, approval gates, audit logs, and context hygiene as architecture patterns only unless TP approves implementation.

## Architectural Reference Intake

Solvys skills may learn from approved external references as architectural thinking sources only. Use repositories, articles, and component galleries to extract patterns, vocabulary, constraints, failure modes, and review heuristics. Do not import external skills, dependencies, paid services, runtime code, prompt text, or generated assets unless TP explicitly approves that specific implementation.

Reference synthesis should combine ideas into Solvys-native guidance:

- Engineering references become planning, diagnosis, TDD, decomposition, and audit heuristics.
- UI references become layout, hierarchy, interaction, loading, charting, and detail-check heuristics.
- Agent/tooling references become boundary, permission, policy, observability, and handoff heuristics.
- Voice/runtime references become feasibility, deployment, privacy, and fallback heuristics.

S47 created seven Solvys-native single skills from the non-vetoed starred skill sets: `/solvys-diagnose`, `/solvys-backend-quality`, `/solvys-tech-debt`, `/solvys-context`, `/solvys-browser-verify`, `/solvys-ui-detail`, and `/solvys-ui-cleanup`.

Fintheon/Solvys rules always win over upstream references: no emojis, no gradients, no Kanban borders, no AI sparkles, and no unapproved runtime dependencies.

TP-vetoed references must not influence S47 guidance: `Xquik-dev/x-twitter-scraper`, `EveryInc/compound-engineering-plugin`, `jamiepine/voicebox`, `elder-plinius/CL4R1T4S`, and `Bitterbot-AI/bitterbot-desktop`.

## License

MIT -- Solvys Technologies
