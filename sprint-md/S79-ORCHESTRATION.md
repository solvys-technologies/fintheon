# S79-ORCH: NarrativeFlow Desk Sessions

## Context

NarrativeFlow needs a product reset. The opener should be centered and sparse: chat input plus fading desk narrative history. New sessions require at least 3 RiskFlow catalysts. Opened sessions become desk-owned narratives with a canvas plus a resizable work drawer containing Flow, Timeline, and Docs. The system must persist docs, timeline, canvas, selected catalysts, tags, and future learning signals in Supabase under desk/group scope.

## Linear Home

- **Team**: Solvys
- **Cycle**: Cycle 8 - Beta Closed
- **Project**: Beta -- Sanctum & Arbitrum UX
- **Initiative**: Beta Closeds
- **Phase**: Closed Beta
- **Branch target**: `sprint/S79`
- **Due date**: 2026-05-23

## Design Source

- Use `/solvys-feels`: flat Solvys Gold, no gradients, no shadows, no blur, no sparkles, no thick borders, no toast popups for session state.
- FlowSprint reference is useful only as product-flow inspiration: intent capture -> generated graph/doc payload -> editor. Do not copy code or visual language.
- Orchestra reference was inspected in Chrome on 2026-05-22. Useful patterns: persistent research transcript, artifact tab rail, graph nodes with type/status chips, `Organize`/`All` canvas controls, content tree, timeline/file empty states, and a project/session title with inline rename affordance.
- Fintheon adaptation: keep the opener sparse, then load into a right-side work drawer with only Flow, Timeline, Docs. Do not add Orchestra's Agents, Experiments, or Files tabs.
- The user-supplied screenshot paths were missing from paste temp storage during initial planning, so Chrome inspection became the live visual reference.

## Track Definition

| Track  | Title                                    | Owner                                       | Complexity | File Ownership                                                                                                                            |
| ------ | ---------------------------------------- | ------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| S79-T1 | Narrative Desk Session Data              | local Solvys Agent                          | High       | `supabase/migrations/**`, `backend-hono/src/services/narrative-sessions/**`, `backend-hono/src/routes/narrative/sessions/**`, route mount |
| S79-T2 | Narrative Opener and RiskFlow Picker     | Codex Cloud                                 | Medium     | opener/history/picker/color components, composer, RiskFlow headline hook                                                                  |
| S79-T3 | Loaded Session Workspace                 | Codex Cloud                                 | Medium     | workspace/drawer/tabs/detail components                                                                                                   |
| S79-T4 | Agent Classification and Situation Map   | local Solvys Agent                          | High       | classification services/routes, situation map hook/component                                                                              |
| S79-T5 | NarrativeFlow Unification and Validation | TP acceptance, local Solvys Agent execution | High       | `NarrativeCanvas.tsx`, shared contracts, changelog, validation                                                                            |

## Assignment Matrix

| Issue    | Linear  | Brief                                                       | Owner                                       | Execution path                               | Cycle                 | Project                       | Initiative  |
| -------- | ------- | ----------------------------------------------------------- | ------------------------------------------- | -------------------------------------------- | --------------------- | ----------------------------- | ----------- |
| S79-ORCH | SOL-171 | @sprint-md/S79-ORCHESTRATION.md                             | TP                                          | planning/runbook                             | Cycle 8 - Beta Closed | Beta -- Sanctum & Arbitrum UX | Beta Closed |
| S79-T1   | SOL-172 | @sprint-md/S79-T1-narrative-desk-session-data.md            | local Solvys Agent                          | local watcher or direct local implementation | Cycle 8 - Beta Closed | Beta -- Sanctum & Arbitrum UX | Beta Closed |
| S79-T2   | SOL-173 | @sprint-md/S79-T2-narrative-opener-and-riskflow-picker.md   | Codex Cloud                                 | Linear delegate                              | Cycle 8 - Beta Closed | Beta -- Sanctum & Arbitrum UX | Beta Closed |
| S79-T3   | SOL-174 | @sprint-md/S79-T3-loaded-session-workspace.md               | Codex Cloud                                 | Linear delegate                              | Cycle 8 - Beta Closed | Beta -- Sanctum & Arbitrum UX | Beta Closed |
| S79-T4   | SOL-175 | @sprint-md/S79-T4-agent-classification-and-situation-map.md | local Solvys Agent                          | local watcher or direct local implementation | Cycle 8 - Beta Closed | Beta -- Sanctum & Arbitrum UX | Beta Closed |
| S79-T5   | SOL-176 | @sprint-md/S79-T5-unification-validation.md                 | TP acceptance, local Solvys Agent execution | unification/validation                       | Cycle 8 - Beta Closed | Beta -- Sanctum & Arbitrum UX | Beta Closed |

## Wave Sequence

### Wave 1 - Foundation and UI Components

Run in parallel:

```text
@sprint-md/S79-T1-narrative-desk-session-data.md
```

```text
@sprint-md/S79-T2-narrative-opener-and-riskflow-picker.md
```

```text
@sprint-md/S79-T3-loaded-session-workspace.md
```

T1 builds persistence and APIs. T2 builds the unopened state and RiskFlow selection interaction. T3 builds the loaded workspace drawer/tabs. These tracks avoid `NarrativeCanvas.tsx`.

### Wave 2 - Classification and Situation Map

Start after T1 has at least the expected tables/routes stubbed:

```text
@sprint-md/S79-T4-agent-classification-and-situation-map.md
```

T4 adds tag/classification scaffolding and the full desk Situation Map.

### Wave 3 - Unification

Start after Waves 1 and 2:

```text
@sprint-md/S79-T5-unification-validation.md
```

T5 wires the live NarrativeFlow surface, resolves contracts, updates the changelog, and runs validation.

## Conflict Rules

- No track except S79-T5 edits `frontend/components/narrative/NarrativeCanvas.tsx`.
- No track except S79-T5 edits `src/lib/changelog.ts`.
- S79-T1 and S79-T4 may both mount narrative routes, but each owns a distinct route file. If mount conflicts appear, S79-T5 resolves them.
- S79-T2 owns opener/composer/picker. S79-T3 owns loaded drawer/tabs. Do not share files between them.

## Product Anchors

- Unopened state: centered chat input only, fading desk narrative history, and RiskFlow attach icon.
- Catalyst gate: users must select at least 3 RiskFlow headlines before a new session can start.
- Loaded state: canvas plus right drawer containing agentic desk work, with tabs exactly `Flow`, `Timeline`, `Docs`.
- Session history is desk-scoped. Default desk is `Priced In Capital`.
- Default first-run narrative chips are `Rate Cut Cycle`, `Price Stability`, and `Max Employment`.
- Users can rename and recolor sessions because sessions become durable desk narratives.
- Situation Map shows all desk-selected catalysts and multi-narrative links across the desk.

## Validation Standard

Every implementation track runs its listed validation. No track starts a Vite dev server. Every Vite build must be:

```bash
rm -rf dist && npx vite build
```

## Linear Taxonomy Audit

- Linear API confirmed Team `Solvys`, Cycle `Cycle 8 - Beta Closed`, Project `Beta -- Sanctum & Arbitrum UX`, and Initiative `Beta Closed`.
- S79 issues created: SOL-171 through SOL-176. SOL-172 through SOL-176 are children of SOL-171.
- New S79 issue descriptions include `@sprint-md/...` references and a `Linear Organization` block.
- Owner split is explicit in the Assignment Matrix.

## Memory Flush Note

S79 plans NarrativeFlow as desk-scoped shared narrative memory: opener is centered chat plus fading session history, new sessions require 3 RiskFlow catalysts, loaded sessions use a resizable work drawer with Flow/Timeline/Docs, and Supabase stores sessions, docs, timelines, canvases, catalysts, tags, and future learning artifacts by desk. Lightweight team scope is the default `Priced In Capital` desk and future-compatible membership rows; full invite/admin UI is deferred.
