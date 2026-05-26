# S80-ORCH: Coliseum Desk Core + Forecast Foundation

## Context

Coliseum is Fintheon's desk-first social forecasting layer. Desks publish Desk Forecasts and Desk Remarks, attach RiskFlow evidence, benchmark read-only prediction-market data, and build a reputation without Fintheon becoming a prediction market, broker, exchange, custodian, or settlement venue.

The first implementation sprint should build the desk/profile core and a thin Agentic Desk style layer before a public social feed. Forecasting objects can begin now, but comments, Spaces, affiliate UI, and public discovery are later phases.

## Linear Home

- **Team**: Solvys
- **Cycle**: Beta Closed
- **Project**: Coliseum: Desk Forecasting & Social Intelligence
- **Initiative**: Beta Closed
- **Phase**: Closed Beta
- **Branch target**: `sprint/S80`
- **Due date**: 2026-05-30

## Roadmap

| Phase | Name                    | Outcome                                                                                                                        |
| ----- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 0     | Design + Guardrails     | Terms, compliance boundary, desk roles, forecast lifecycle, read-only prediction-market policy                                 |
| 1     | Desk Core + Agent Style | Desk profiles, manager permissions, archetype/classification, broker/prop firm metadata, affiliate schema, agent style context |
| 2     | Desk Forecasts          | Draft/publish lifecycle, RiskFlow catalysts, validation criteria, market references, NarrativeFlow toggle                      |
| 3     | Alerts + Scorecards     | Thesis gaining support, Thesis proven, Thesis invalidated, calibration scoring, desk leaderboard                               |
| 4     | Coliseum Feed           | Followed desks, private beta feed, Desk Remarks, forecast archive, resolved view                                               |
| 5     | Social Layer            | Comments, Spaces, moderation, follow expansion, affiliate UI, richer public profiles                                           |

## Track Definition

| Track  | Title                        | Owner                       | Complexity | File Ownership                                                                                                      |
| ------ | ---------------------------- | --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| S80-T1 | Coliseum Desk Profile Schema | Shashank via OpenCode local | High       | `supabase/migrations/**`, `backend-hono/src/services/coliseum/**`, `backend-hono/src/routes/coliseum/**`            |
| S80-T2 | Desk Manager Permissions     | Shashank via OpenCode local | Medium     | `backend-hono/src/services/coliseum/**`, `backend-hono/src/routes/coliseum/**`, route validation                    |
| S80-T3 | Agentic Desk Style Core      | Shashank via OpenCode local | High       | `backend-hono/src/services/desk-context/preflight.ts`, `backend-hono/src/services/coliseum/**`, settings/profile UI |
| S80-T4 | Desk Forecast Data Model     | Shashank via OpenCode local | High       | `supabase/migrations/**`, forecast store/routes/types                                                               |
| S80-T5 | NarrativeFlow Toggle Shell   | Shashank via OpenCode local | High       | `frontend/components/narrative/**`, `frontend/lib/coliseum-api.ts`                                                  |
| S80-T6 | Rule-Based Thesis Monitor    | Shashank via OpenCode local | High       | monitor service, bulletin/notification integration, prediction-market read-only adapter                             |

## Assignment Matrix

| Issue    | Linear  | Brief                                             | Owner    | Execution path                       | Cycle       | Project                                          | Initiative  |
| -------- | ------- | ------------------------------------------------- | -------- | ------------------------------------ | ----------- | ------------------------------------------------ | ----------- |
| S80-ORCH | SOL-177 | @sprint-md/S80-ORCH-coliseum-desk-core.md         | TP       | planning/runbook                     | Beta Closed | Coliseum: Desk Forecasting & Social Intelligence | Beta Closed |
| S80-T1   | SOL-178 | @sprint-md/S80-T1-coliseum-desk-profile-schema.md | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Coliseum: Desk Forecasting & Social Intelligence | Beta Closed |
| S80-T2   | SOL-179 | @sprint-md/S80-T2-desk-manager-permissions.md     | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Coliseum: Desk Forecasting & Social Intelligence | Beta Closed |
| S80-T3   | SOL-180 | @sprint-md/S80-T3-agentic-desk-style-core.md      | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Coliseum: Desk Forecasting & Social Intelligence | Beta Closed |
| S80-T4   | SOL-181 | @sprint-md/S80-T4-desk-forecast-data-model.md     | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Coliseum: Desk Forecasting & Social Intelligence | Beta Closed |
| S80-T5   | SOL-182 | @sprint-md/S80-T5-narrativeflow-toggle-shell.md   | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Coliseum: Desk Forecasting & Social Intelligence | Beta Closed |
| S80-T6   | SOL-183 | @sprint-md/S80-T6-rule-based-thesis-monitor.md    | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Coliseum: Desk Forecasting & Social Intelligence | Beta Closed |

## Wave Sequence

### Wave 1 - Desk Foundation

Run first:

```text
@sprint-md/S80-T1-coliseum-desk-profile-schema.md
@sprint-md/S80-T2-desk-manager-permissions.md
```

T1 adds profile and affiliate-safe metadata. T2 makes the role boundary enforceable before anything can publish.

### Wave 2 - Agent Style + Forecast Records

Start after Wave 1 tables/routes exist:

```text
@sprint-md/S80-T3-agentic-desk-style-core.md
@sprint-md/S80-T4-desk-forecast-data-model.md
```

T3 lets each Trading Desk teach Fintheon's agents how that desk thinks. T4 creates the formal Desk Forecast object and read-only market-reference link.

### Wave 3 - NarrativeFlow + Monitoring

Start after T4 has forecast routes:

```text
@sprint-md/S80-T5-narrativeflow-toggle-shell.md
@sprint-md/S80-T6-rule-based-thesis-monitor.md
```

T5 makes the private beta surface visible in NarrativeFlow. T6 adds first-pass thesis status alerts.

## Product Anchors

- Use **Desk Forecast**, not bubble.
- Use **Desk Remark** for lighter desk-authored thesis/commentary.
- Use **Coliseum** for the competitive/social area.
- Use alert wording: `Thesis gaining support`, `Thesis proven`, `Thesis invalidated`.
- Desks are the publishable entity. Members can draft; Desk Managers and owners can publish.
- Prediction-market data is read-only. Fintheon must not place orders, match orders, settle payouts, custody funds, or create event contracts.
- Affiliate links are controlled profile metadata with disclosure fields. Do not add public affiliate promotion UI in S80.

## Guardrails

- Do not call `placeOrder` or create any Kalshi/Polymarket execution surface.
- Do not expose comments, Spaces, or public discovery in S80.
- Do not build model fine-tuning. S80 stores and injects desk style context only.
- Keep file lengths under 300 lines.
- Preserve S79 NarrativeFlow session behavior.

## Validation Standard

Every implementation track runs its listed validation. For any frontend track:

```bash
rm -rf dist && npx vite build
```

## Linear Taxonomy Audit

- Linear API created Project `Coliseum: Desk Forecasting & Social Intelligence`.
- Project milestones created: Phase 0 through Phase 5.
- S80 issues created: SOL-177 through SOL-183.
- SOL-178 through SOL-183 are children of SOL-177.
- 2026-05-24 assignment sync: SOL-178 through SOL-183 assigned to Shashank with 2026-05-30 due date.
- New S80 issue descriptions include `@sprint-md/...` references and a Linear Organization block.

## Memory Flush Note

S80 defines Coliseum as a desk-first competitive forecasting layer: desk profiles, manager-only publishing, desk style context for agents, Desk Forecast records, NarrativeFlow forecast toggle, and rule-based thesis alerts. The first sprint deliberately avoids real-money prediction-market functions, comments, Spaces, public affiliate UI, and model training.
