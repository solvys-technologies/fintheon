# S120-ORCH: App Store Review Readiness + iOS Developer Enrollment

## Intent

S120 turns the App Store Connect review blockers into an auditable release-readiness sprint. The immediate release milestones are the Early Research Preview on June 7, 2026 and the Beta release on July 1, 2026.

## Linear Scope

- Issue naming: `S120-ORCH: App Store review readiness + iOS developer enrollment`
- Existing parent issue: `SOL-233`
- Project: `Beta -- Mobile PWA`
- Cycle: `8 - Beta Closed`
- Beta Phase: Early Research Preview / Beta readiness
- Branch target: `sprint/S120`
- Required brief refs: `@sprint-md/S120-ORCH-ios-developer-enrollment.md`, `@sprint-md/S120-T1-app-information-content-rights.md`, `@sprint-md/S120-T2-privacy-policy-app-privacy.md`, `@sprint-md/S120-T3-pricing-availability.md`, `@sprint-md/S120-T4-build-selection-gap-audit.md`, `@sprint-md/S120-T5-review-submission-preflight.md`

## Assignment Matrix

| Issue     | Linear  | Brief                                                | Owner            | Execution path                 | Project            | Cycle           |
| --------- | ------- | ---------------------------------------------------- | ---------------- | ------------------------------ | ------------------ | --------------- |
| S120-ORCH | SOL-233 | @sprint-md/S120-ORCH-ios-developer-enrollment.md     | TP               | planning/runbook               | Beta -- Mobile PWA | 8 - Beta Closed |
| S120-T1   | SOL-237 | @sprint-md/S120-T1-app-information-content-rights.md | TP/Admin         | App Store Connect              | Beta -- Mobile PWA | 8 - Beta Closed |
| S120-T2   | SOL-238 | @sprint-md/S120-T2-privacy-policy-app-privacy.md     | Codex + TP/Admin | repo + App Store Connect       | Beta -- Mobile PWA | 8 - Beta Closed |
| S120-T3   | SOL-239 | @sprint-md/S120-T3-pricing-availability.md           | TP/Admin         | App Store Connect              | Beta -- Mobile PWA | 8 - Beta Closed |
| S120-T4   | SOL-240 | @sprint-md/S120-T4-build-selection-gap-audit.md      | Codex + TP/Admin | repo audit + App Store Connect | Beta -- Mobile PWA | 8 - Beta Closed |
| S120-T5   | SOL-241 | @sprint-md/S120-T5-review-submission-preflight.md    | TP/validator     | review gate                    | Beta -- Mobile PWA | 8 - Beta Closed |

## Current Repo Evidence

- Public legal pages now exist at `frontend/public/privacy/index.html` and `frontend/public/terms/index.html`.
- The landing prototype footer links to `/privacy/` and `/terms/`.
- No checked-in native iOS path was found: no `ios/`, `.xcodeproj`, `.xcworkspace`, Expo/EAS, or Capacitor config.

## Acceptance

- App Store Connect no longer reports missing Content Rights, Privacy Policy URL, App Privacy practices, Pricing, or Build selection blockers.
- Privacy Policy and Terms URLs are public, non-auth-gated, and return 200 after deploy.
- If no selectable App Store Connect build exists, the sprint ends with an explicit build-path blocker instead of a false submission-ready claim.
- T5 captures final App Store Connect evidence before review submission.
