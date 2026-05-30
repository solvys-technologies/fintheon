# Sprint Brief: S120-T2 -- Privacy Policy URL + App Privacy Practices

## Context

App Store Connect requires a Privacy Policy URL and Admin-provided privacy practices before review. This track creates the public legal URLs and then has TP/Admin complete the App Privacy section from the actual Fintheon data practices.

## Linear Organization

- Issue naming: `S120-T2: Privacy policy URL + App Privacy practices`
- Linear issue: `SOL-238`
- Parent: `SOL-233`
- Brief path: `@sprint-md/S120-T2-privacy-policy-app-privacy.md`
- Project: `Beta -- Mobile PWA`
- Cycle: `8 - Beta Closed`
- Owner: Codex for website page, TP/Admin for App Store Connect privacy declarations
- Execution path: repo + App Store Connect

## Scope

- [x] Add standalone public Privacy Policy page at `frontend/public/privacy/index.html`.
- [x] Add standalone public Terms of Use page at `frontend/public/terms/index.html`.
- [x] Link both legal pages from `frontend/fintheon-landing-prototype.html`.
- [ ] Deploy the website so `/privacy/` and `/terms/` are publicly reachable.
- [ ] Enter the Privacy Policy URL in App Privacy.
- [ ] Admin completes App Privacy practices based on actual collection/use/sharing: contact info, authentication identifiers, user content, usage diagnostics, crash logs, integrations, AI processing, market/trading workflow content, and support data.

## Acceptance

- [ ] Public Privacy Policy URL returns HTTP 200 and is not auth-gated.
- [ ] Public Terms of Use URL returns HTTP 200 and is not auth-gated.
- [ ] App Privacy practices are completed by an Admin in App Store Connect.
- [ ] Privacy declarations are consistent with Fintheon's actual auth, analytics, AI, support, and integration behavior.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
cd frontend && rm -rf dist && bun run build
```
