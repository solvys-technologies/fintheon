# S71-S78-ORCH: Unified Roll-Forward Plan

## Purpose

Roll S71 through S78 forward as one prioritized beta-stability program while
keeping implementation ownership split by sprint lane. This file is the umbrella
index; each sprint ORCH remains the executable brief for its own work.

## Wave Order

| Wave | Sprint | Priority | Gate |
| --- | --- | --- | --- |
| 1 | S71 | Critical surfaces | NarrativeFlow, PsychAssist, lockout, bulletin, composer stability pass |
| 2 | S72 | Platform polish | Appearance, Refinement, PsychAssist, econ countdown polish |
| 3 | S73 | Data parity | RiskFlow IV, econ ingest, brief generation, parity smoke |
| 4 | S74 | Broker core | Rithmic gateway/status, bracket orders, autopilot risk state |
| 5 | S75 | Execution ledger | Trading-service integration, positions API, journal streaks |
| 6 | S76 | Mobile/Sanctum | Mobile CAO, push, ticker row, Sanctum navigation |
| 7 | S77 | Agent Desk/release | Todo drawer, Agent Desk naming, modularity, QA checklist |
| 8 | S78 | Voice/perf hygiene | Voice, STT, performance tab, empty predictions, route logs |

## Conflict Rules

- S71 owns NarrativeFlow and critical user-facing stability before later polish.
- S72 must not rework S71 NarrativeFlow boundaries unless S71 is already merged.
- S73 owns market/econ data correctness and should not change execution flows.
- S74 owns Rithmic/autopilot core; S75 builds ledger/execution integration on top.
- S76 owns mobile and Sanctum navigation only after S71 surface stability lands.
- S77 release hygiene must not rename runtime surfaces until active feature work is merged.
- S78 is lowest priority and should only take low-risk hygiene after higher waves clear.

## References

- @sprint-md/S71-ORCH-beta-stability-critical-surfaces.md
- @sprint-md/S72-ORCH-platform-polish-and-refinement.md
- @sprint-md/S73-ORCH-riskflow-and-brief-parity.md
- @sprint-md/S74-ORCH-rithmic-and-autopilot-core.md
- @sprint-md/S75-ORCH-trade-execution-and-ledger.md
- @sprint-md/S76-ORCH-mobile-and-sanctum-navigation.md
- @sprint-md/S77-ORCH-agent-desk-and-release-hygiene.md
- @sprint-md/S78-ORCH-voice-performance-and-low-priority-hygiene.md

## Validation

- Run the validation listed in each sprint ORCH before moving that sprint wave.
- Run `cd backend-hono && bun run build` after backend waves.
- Run `npx tsc --noEmit --project frontend/tsconfig.json` after frontend waves.
- Run `rm -rf mobile/dist && npx vite build` from `mobile/` after mobile waves.
