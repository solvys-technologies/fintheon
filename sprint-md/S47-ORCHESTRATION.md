# S47 Orchestration -- Repo Issue Bug Repair and Platform Cleanup

## Discovery Decisions

- End state: full platform cleanup.
- Work type: mixed sprint, combining repairs, refactors, and missing implementation.
- Surfaces: backend, desktop frontend, mobile PWA, Electron shell, Supabase schema. Agent instruction changes are included where needed by tracks even though not selected in the surface round.
- Execution style: 5 parallel Codex/Deepseek v4-capable agents per broad wave, with wave branches.
- Branching: wave branches, not one shared branch.
- Off-limits: no blanket off-limits; each track owns exact files and must avoid other tracks' listed files.
- Non-regression: CAO chat, RiskFlow feed, MDB/ADB/PMDB/TWT briefs, Sanctum, Mobile PWA, Desktop install, Supabase RLS.
- Unification: per-wave unify plus final review/push prep.
- Validation: full local gates where possible; at minimum type/build gates per touched surface.
- UI anchor: Solvys defaults, upgraded by approved design skills and references. Use devl.dev for every new feature going forward.
- Deadline: this week.

## Wave 0 -- Tooling Choice Before Implementation

Run first. This track produces the relevant GH Stars/tooling selection list. Do not start product implementation until TP chooses which skill/tool updates are approved.

Approved Wave 0 decisions so far:

- Impeccable v3 is approved and installed repo-local as a single `/impeccable` skill at `.claude/skills/impeccable/`.
- devl.dev is required as a reference step for new UI features, without adding a dependency by default.
- Jakub interface details are required as a UI polish checklist.
- The full `solvys` GitHub stars list is now a TP veto sheet. Non-vetoed repos may influence architecture, vocabulary, heuristics, and review checklists only. Do not import external skills, dependencies, services, or runtime code from those repos without separate TP approval.
- TP vetoed these stars as S47 influence sources: `Xquik-dev/x-twitter-scraper`, `EveryInc/compound-engineering-plugin`, `jamiepine/voicebox`, `elder-plinius/CL4R1T4S`, and `Bitterbot-AI/bitterbot-desktop`.

```text
@sprint-md/S47-T0-skills-stars-tooling.md
```

## Wave 1 -- Backend/Data Contracts

Run after Wave 0 choices are recorded. These two tracks both touch backend, so they should not edit simultaneously in the same worktree. Use wave branches and coordinate by file ownership; if only one backend editor is available, run T1 then T2 sequentially.

```text
@sprint-md/S47-T1-riskflow-refinement-data.md
```

```text
@sprint-md/S47-T2-calendar-econ-arbitrum-backend.md
```

Wave 1 unification merges RiskFlow/source/TradingView contracts with Calendar/Arbitrum/PMDB backend contracts before UI tracks consume them.

## Wave 2 -- Product Surfaces

Run after Wave 1 backend contracts are stable.

```text
@sprint-md/S47-T3-arbitrum-sanctum-performance-ui.md
```

```text
@sprint-md/S47-T4-chat-agentic-forum-mobile.md
```

```text
@sprint-md/S47-T5-vibevoice-transcripts.md
```

Wave 2 unification verifies that Arbitrum, Chat/Agentic Forum, mobile chat, voice/transcripts, and PMDB/Calendar contracts agree.

## Wave 3 -- Shared Design System

Run after Wave 2 has real surfaces to consume the primitives.

```text
@sprint-md/S47-T6-design-icons-spinners-charts.md
```

Wave 3 unification keeps shared fuses, icons, loaders, charts, RiskFlow card hierarchy, and tabbed chart insertions consistent without creating duplicate components.

## Final Review and Push Prep

Run last. This track is the integration owner and final gatekeeper.

```text
@sprint-md/S47-T7-unify-validate-release.md
```

## Non-Regression Gates

- CAO chat streams and persists history.
- RiskFlow feed remains sourced only from approved X/wire and official econ/government sources.
- MDB/ADB/PMDB/TWT routes still work.
- Sanctum and Arbitrum remain usable on desktop and mobile widths.
- Mobile PWA chat renders final responses.
- Electron desktop install/update/calendar behavior does not regress.
- Supabase JWT and RLS are not weakened.
- No OpenRouter, DashScope, FMP, broad MSM, or Exa reintroduction.
- No emojis, gradients, Kanban borders, or AI-sparkle ornamentation in new UI.
