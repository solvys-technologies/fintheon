# Sprint Numbering

## Active Lane

- The current active sprint lane resumes from S83.
- S84 is App Store Review Readiness + iOS Developer Enrollment.
- S85 is Infisical Secrets + Portless Desktop Infra.
- Do not infer the next active sprint by taking the highest numeric `S{N}` file.

## Deferred Lane

- S100+ is a post-beta/deferred milestone lane, not the active sprint chronology.
- S100 is the post-beta milestone starting point. S101, S102, and future S100+ files remain valid future/backlog planning artifacts unless TP explicitly reclassifies them.
- S100+ files must not be treated as proof that the current or next active sprint is S100 or higher.

## 2026-05-30 Correction

- The App Store review-readiness sprint was misnumbered as S120 and is corrected to S84.
- The Infisical Secrets + Portless Desktop Infra sprint was misnumbered as S121 and is corrected to S85.
- Linear mirrors are SOL-233 and SOL-237 through SOL-241 for S84, and SOL-242 for S85.

## Agent Rule

- Before creating or renumbering sprint docs/issues, read this file, `AGENTS.md`, `WORKSPACE.md`, `.cursor/rules/`, local Solvys skills, `src/lib/changelog.ts`, and recent `sprint-md/` entries.
- Choose the next active sprint from the latest non-deferred active sprint, not from the max numeric sprint filename.
- Keep all Linear prefixes uppercase and include `@sprint-md/...` file references in Linear descriptions.
