# Sprint Brief: S54 -- Refinement RiskFlow Operator Control (single-agent)

## Intent

When this sprint is complete, the Refinement Engine becomes a clear command center where you can control exactly what enters RiskFlow and why. You can add and organize approved sources, see live source health at a glance, inspect what each pipeline is doing, and immediately escalate failures into a doctoring queue so feed outages are handled fast and visibly. Econ event headlines and commentary flow must be restored and verifiably visible in RiskFlow.

## Branch Target

`v.5.29.1-s53-refinement-riskflow-sync`

## Scope -- Included

- [ ] Enforce modular control architecture in Refinement so each RiskFlow control domain is isolated, independently testable, and failure-contained.
- [ ] Lock feed intake to approved sources only: X handles (`@financialjuice`, `@DeItaone`) plus official Fed/BLS/FRED/government economic data sites.
- [ ] Support end-to-end source operations: create a category, assign icon + name, add source, toggle source on/off, persist changes.
- [ ] Rework Refinement source view into side-by-side status cards with headline previews, health counters, and clear control actions.
- [ ] Add expandable pipeline chevron panels so operators can see what each pipeline is polling and how sources map to categories.
- [ ] Add a "Doctorate" call-to-action on source cards to send error reports into the debug queue for the next RiskFlow diagnostic hook.
- [ ] Keep system behavior operator-driven (no automatic source expansion or silent background source changes).
- [ ] Add a complete ingest activity ledger so operators can see every poll attempt, decision, and feed inclusion/exclusion reason.
- [ ] Restore and verify RiskFlow delivery for econ event headlines and commentary items.

## Scope -- Excluded (OUT OF BOUNDS)

- Mobile redesign or mobile-specific parity work.
- New market data providers outside the approved source policy.
- Rebranding or global visual overhaul outside Refinement and connected RiskFlow status surfaces.

## Known Issues to Preserve

- RiskFlow worker remains externalized and must not be folded into backend boot.
- Admin/source mutation routes remain auth-gated and must not be loosened.
- Existing realtime econ and feed paths must continue to function while controls are upgraded.
- Current incident to resolve in this sprint: econ event headlines and commentary are intermittently missing from RiskFlow despite configured sources.

## Design Pass

### Layout / Interaction

- Refinement opens on a primary "Sources" grid made of status cards (4-up rows on wide screens; responsive collapse on smaller widths).
- Refinement is composed as explicit control modules with clear ownership:
  - Source Governance module (allowlist policy + source/category controls),
  - Polling Runtime module (what is currently polling and cadence/health),
  - Feed Decision module (accepted/blocked/dropped reasons),
  - Econ + Commentary Continuity module (stream health and delivery status),
  - Doctoring Queue module (incident enqueue + debug handoff status).
- Each module has its own status state (`healthy`, `degraded`, `blocked`), loading state, and mutation feedback without cross-module lockups.
- Each source card shows:
  - source name + enabled state toggle,
  - last three pulled headlines from the past 24 hours,
  - right-justified "time ago" stamps,
  - pipeline attribution (which poller/path brought items in),
  - health strip (rate-limit count, grouped error counts),
  - bottom CTA: `Doctorate` (queues this source's error report for debug review).
- Under the source grid, chevron panels open per pipeline family (for example: social poller, official web poller), showing:
  - which sources are attached,
  - category labels,
  - followed handle/domain list,
  - short plain-language explanation of what that pipeline is doing now.
- Add an "Everything" activity panel (operator timeline) with filter chips for source, pipeline, and decision:
  - polled,
  - accepted,
  - blocked-by-policy,
  - dropped-by-scoring,
  - rate-limited,
  - errored.
- Timeline rows are human-readable and non-technical (what happened, when, impact, next action).
- Category management allows icon selection from a monochrome icon bank, editable category naming, and save/apply feedback after mutation.
- Empty/degraded states must be explicit in plain language (for example: "Source paused", "Temporarily rate-limited", "Blocked by source policy").

### API / Service Shape

- Canonical runtime payload includes source cards + pipeline panel data in one contract:
  - source identity and category,
  - enabled status,
  - recent headline previews,
  - ingestion path attribution,
  - health counters (rate limits + grouped errors),
  - doctoring eligibility/status.
- Runtime API is modular by domain with a stable aggregation layer:
  - domain endpoints per module for targeted polling,
  - one aggregate endpoint for single-view operator rendering,
  - per-module degraded reason so one failing module does not blank the full Refinement surface.
- Add operator audit payload for full ingest visibility:
  - per poll attempt id + timestamp,
  - source and pipeline identity,
  - policy decision (accepted/rejected + reason),
  - scoring decision (included/excluded + reason),
  - resulting feed item id when included.
- Source policy service is allowlist-first and deny-by-default:
  - accepts approved handles/domains only,
  - rejects disallowed sources with structured reason,
  - exposes rejection reason in diagnostics/runtime payload.
- Admin mutations support:
  - create/update category (name + icon token),
  - create/update source and assign category,
  - source enable/disable toggle,
  - enqueue doctoring report from source card action.
- Fallback behavior: if runtime status fetch partially fails, show last known good card state with degraded badge and reason.
- Add leak sentinel metrics:
  - total non-allowlisted poll attempts,
  - total rejected-before-feed events,
  - total unexpected feed insertions (must be zero),
  - last detected leak event (if any) with automatic operator alert state.
- Add continuity counters for econ/commentary flow:
  - econ events expected vs received,
  - commentary items expected vs received,
  - last successful ingest timestamp for each stream,
  - backlog/lag indicator when stream stalls.

### Data / Agent Shape

- Persist source/category metadata in existing source-account governance layer (no shadow config path).
- Persist doctoring queue records with source id, error snapshot, count metrics, and enqueue timestamp.
- Ensure queued doctoring items are consumed by the next RiskFlow debug hook cycle with visible status transitions.

### Approvals -- Regime and Lexicon Overrides

- Keep this section active as the control point for language and behavioral overrides that affect operator trust.
- Regime overrides:
  - Any change that broadens source policy (new source family, new social handle class, relaxed allowlist logic) requires explicit approval before activation.
  - Any change that alters autonomous behavior (auto-enable, auto-add, self-expanding source discovery) requires explicit approval before merge.
  - Emergency override mode must be visible, time-bounded, and reversible with audit notes.
- Lexicon overrides:
  - Operator-facing labels must remain plain-language and non-technical.
  - Error states must avoid jargon and explain impact in feed terms ("not updating", "delayed", "paused") plus next action.
  - Source category and pipeline naming must stay stable unless explicitly approved; renames require migration-safe mapping so existing controls do not silently break.
- Approval hygiene:
  - Every approved override must include who approved it, when, why, and rollback condition.
  - Unapproved overrides must remain staged but inactive.

### Aesthetic Rules

- Flat, controlled surfaces with thin low-opacity `#c79f4a` borders.
- No gradients, no emojis, no Kanban borders, no AI sparkles, no heavy generic shadows.
- Dense but readable status hierarchy: source first, health second, actions third.

## Development Flow

1. Data layer: finalize source/category and doctoring queue schemas, plus per-module runtime payload types.
2. Service layer: implement allowlist policy guard + doctoring queue service + source health aggregation with module-scoped contracts.
3. API layer: expose/extend admin + diagnostics/runtime routes for source/category CRUD, card payload, and doctoring enqueue.
4. API layer: add module endpoints + aggregate endpoint, ingest activity/audit endpoint(s), and leak sentinel counters for "show everything" visibility.
5. Frontend hooks: create module-scoped hooks for each control domain and a lightweight aggregate orchestration hook.
6. Frontend UI: implement module surfaces (cards/panels/timeline) with isolated degrade states, plus category icon/name editor and doctoring CTA flows.
7. Validation: run typecheck/build/backend build, then endpoint smoke tests and manual operator flow checks including econ/commentary continuity checks.
8. Changelog + file headers: add sprint entry and top-file change headers on substantially modified files.

## Acceptance Criteria

- [ ] Operator can add a new category and new source end-to-end from Refinement and see it persist.
- [ ] Feed ingestion accepts only approved X handles and approved official economic data websites.
- [ ] Source cards show recent headlines, timing, pipeline attribution, and health counters in one view.
- [ ] Doctoring CTA enqueues a report and marks it for next debug hook cycle.
- [ ] Chevron pipeline panels clearly show grouped pipeline/source/category relationships.
- [ ] Operator can open one view and see every poll attempt and why each item did or did not enter the feed.
- [ ] Leak sentinel reports zero unexpected feed insertions from disallowed sources.
- [ ] Econ event headlines appear in RiskFlow when upstream events are active and are labeled with source + pipeline path.
- [ ] Commentary items appear in RiskFlow with no silent drops; stalls surface as degraded status with reason.
- [ ] System does not silently auto-expand sources in background.
- [ ] A failure in one Refinement module does not disable control/visibility in the others.
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- [ ] `rm -rf dist && npx vite build` passes.
- [ ] `cd backend-hono && bun run build` passes.
- [ ] Live endpoint smoke test(s) pass.
- [ ] UI manually verified for happy path + degraded path + policy-rejected source path.
- [ ] Changelog entry added to `src/lib/changelog.ts`.
- [ ] File header `// [claude-code YYYY-MM-DD]` added to substantially modified files.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Live endpoint smoke tests
curl -s http://localhost:8080/api/diagnostics | head -c 300
curl -s http://localhost:8080/api/admin/pipeline-stats/runtime | head -c 300
curl -s http://localhost:8080/api/admin/pipeline-stats/ingest-activity | head -c 300
curl -s http://localhost:8080/api/econ/active-watch | head -c 300
```

## Commit Format

```
[v.5.29.6] feat: S54 operator-control refinement for RiskFlow source governance and health
```
