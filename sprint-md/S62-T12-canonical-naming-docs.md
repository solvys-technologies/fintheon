# Sprint Brief: S62-T12 — Docs: Canonical Naming Audit

- **Linear**: SOL-50
- **Parent ORCH**: @sprint-md/S62-ORCH-platform-qa-hygiene.md
- **Branch**: `sprint/S62`
- **Assignee**: Sam Frederique
- **Wave**: 1 (parallel — no dependencies)

## Context

Project documentation must use consistent canonical feature names. The CLAUDE.md definitions establish the authoritative names: Consilium, Sanctum, Forum, Apparatus, Strategium, Arbitrum, ArbitrumChamber, RiskFlow, NarrativeFlow, CAO chat, PsychAssist, MDB/ADB/PMDB/TWT. Legacy names (Ask Harp, TOTT, News Worker, etc.) must be flagged and documented. This task audits all sprint briefs, changelog entries, and inline comments for name consistency.

## Branch Target

`sprint/S62`

## Scope — Included

- [ ] All `sprint-md/*.md` — sprint briefs
- [ ] All `sprint-changelog/*.md` — changelog entries
- [ ] All `docs/sprint-briefs/*.md` — historical sprint briefs
- [ ] `src/lib/changelog.ts` — master changelog entries

## Canonical Name Reference (from CLAUDE.md)

| Canonical | Legacy (flag if found) |
|-----------|----------------------|
| Consilium | — |
| Sanctum | — |
| Forum | — |
| Apparatus | — |
| Strategium | — |
| Arbitrum | — |
| ArbitrumChamber | — |
| RiskFlow | Risk Feed, News Worker |
| NarrativeFlow | — |
| CAO chat | Ask Harp, TOTT |
| PsychAssist | — |
| MDB | — |
| ADB | — |
| PMDB | — |
| TWT | — |
| Agent Desk | MiroShark |

## Scope — Excluded (DO NOT TOUCH)

- Source code files — rename handled by S62-T11 (SOL-49)
- External documentation outside the repo
- Sprint briefs from other sprints — audit only, flag findings

## Implementation Steps

1. Search all sprint-md/*.md for legacy names: `rg -i "ask harp\|tott\|news worker\|miroshark" sprint-md/ sprint-changelog/ docs/sprint-briefs/`
2. Search `src/lib/changelog.ts` for legacy names in summary strings
3. For each legacy name found, determine if it's in a historical context (acceptable) or a current description (needs update)
4. Update current descriptions to use canonical names
5. Add a comment flag next to intentional historical references (e.g., `(historical — pre-rename)`)
6. Report findings as a bullet list at the bottom of this brief file

## Acceptance Criteria

- [ ] No legacy names in current user-facing docs
- [ ] Historical references are flagged with context comments
- [ ] Findings report appended to this brief
- [ ] No source code changes in this task

## Validation Commands

```bash
# Search for legacy names
rg -i "ask harp|tott|news worker|miroshark" sprint-md/ sprint-changelog/ docs/sprint-briefs/

# Check changelog
rg -i "ask harp|tott|news worker|miroshark" src/lib/changelog.ts
```

## Commit Format

```
[v.6.0.27-s62-t12] docs: canonical naming audit (sprint briefs, changelog, docs)
```
