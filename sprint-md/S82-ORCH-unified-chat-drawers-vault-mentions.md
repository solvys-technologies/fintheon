# S82-ORCH: Unified Chat Drawers + Vault Mentions

## Intent

S82 repairs the chat-input drawer system across Consilium, NarrativeFlow, RiskFlow attachment flows, and Econ Calendar chrome, then adds a safe shared `@` mention inventory backed by app context and Obsidian vault metadata.

## Linear Scope

- Issue naming: `S82-ORCH: Unified chat drawers + vault mentions`
- Linear issue: `SOL-184`
- Beta Phase: Closed Beta
- Branch: `sprint/S82`
- Owner: TP final acceptance, local Solvys Agent execution
- Required brief refs: `@sprint-md/S82-T1-composer-drawer-contract.md`, `@sprint-md/S82-T2-econ-calendar-header-fade.md`, `@sprint-md/S82-T3-vault-mention-inventory.md`, `@sprint-md/S82-T4-deskmap-workspace-identity.md`

## Assignment Matrix

| Issue            | Brief                                           | Owner              | Execution path | Cycle                    | Project              | Initiative  |
| ---------------- | ----------------------------------------------- | ------------------ | -------------- | ------------------------ | -------------------- | ----------- |
| SOL-185 / S82-T1 | @sprint-md/S82-T1-composer-drawer-contract.md   | local Solvys Agent | OpenCode local | not exposed by connector | Fintheon Closed Beta | Closed Beta |
| SOL-186 / S82-T2 | @sprint-md/S82-T2-econ-calendar-header-fade.md  | local Solvys Agent | OpenCode local | not exposed by connector | Fintheon Closed Beta | Closed Beta |
| SOL-187 / S82-T3 | @sprint-md/S82-T3-vault-mention-inventory.md    | local Solvys Agent | OpenCode local | not exposed by connector | Fintheon Closed Beta | Closed Beta |
| SOL-188 / S82-T4 | @sprint-md/S82-T4-deskmap-workspace-identity.md | local Solvys Agent | OpenCode local | not exposed by connector | Fintheon Closed Beta | Closed Beta |

## Wave Sequence

1. Run Track 1 and Track 2 in parallel.
2. Run Track 3 in parallel only after confirming it does not rewrite the shared composer primitives owned by Track 1.
3. Unify on `sprint/S82`, run frontend typecheck, frontend clean build, backend build, and visual QA for drawers, Econ Calendar, and `@` mentions.
