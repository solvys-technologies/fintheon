# Sprint Brief: S84-T4 -- Build Selection + Native Build Gap Audit

## Context

App Store Connect requires a build to be selected for review. The current Fintheon repo contains a mobile PWA and Electron desktop app, but no checked-in native iOS project or App Store build pipeline was found.

## Linear Organization

- Issue naming: `S84-T4: Build selection + native build gap audit`
- Linear issue: `SOL-240`
- Parent: `SOL-233`
- Brief path: `@sprint-md/S84-T4-build-selection-gap-audit.md`
- Project: `Beta -- Mobile PWA`
- Cycle: `8 - Beta Closed`
- Owner: Codex for repo audit, TP/Admin for App Store Connect build selection
- Execution path: repo audit + App Store Connect

## Scope

- [ ] Confirm whether App Store Connect already has an uploaded build.
- [ ] If a build exists, select the exact version/build for review and record bundle ID, version, build number, and upload date.
- [ ] If no build exists, document the missing native submission path and leave review submission blocked.
- [ ] Do not create an iOS wrapper or native build pipeline in this track; this is an audit and selection track only.

## Acceptance

- [ ] A build is selected in App Store Connect, or the issue clearly states `blocked: no selectable build`.
- [ ] Repo evidence is recorded: no `ios/`, `.xcodeproj`, `.xcworkspace`, Expo/EAS, or Capacitor config currently exists.
- [ ] The sprint does not claim App Store review readiness if no uploaded build exists.
