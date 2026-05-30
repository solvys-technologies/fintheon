# Sprint Brief: S85 -- Infisical Secrets + Portless Desktop Infra (single-agent)

## Intent

Fintheon should stop depending on repo-tracked, installer-embedded, or local plaintext secrets. One Claude Code instance will finish the public-repo secret evidence capture, make Infisical the canonical source of truth for backend and deploy secrets, keep Fly/Vercel only as runtime deployment targets synced from Infisical, and standardize Portless-backed local backend hostnames for the Desktop-local blocker path.

## Branch Target

`v7.0.9-security-infra`

## Linear Mirror

`SOL-242` -- Todo

## Numbering Note

This sprint was originally misnumbered as S121. It was corrected to S85 on 2026-05-30 because S100+ is a post-beta/deferred lane, not the active sprint chronology.

## Scope -- Included

- [ ] Complete exposed-secret evidence capture: inventory exposed classes, owners, and affected paths without raw values, and verify no live-looking secrets remain in current `HEAD`.
- [ ] Do not rotate secrets unless TP reopens the incident-response lane or a provider confirms a live-compromise blocker.
- [ ] Plan any public history scrub for the known exposed paths, then force-push only after TP confirms the freeze window.
- [ ] Enable GitHub secret scanning and push protection for `solvys-technologies/fintheon`; document any plan/license blocker if GitHub refuses.
- [ ] Add Infisical as the canonical secret source for local operator machines, CI, Fly, and Vercel syncs.
- [ ] Keep Fly and Vercel as deployment targets populated from Infisical, not as the manually maintained source of truth.
- [ ] Use Portless for the Desktop-local backend blocker path: installer/update scripts install or verify Portless, register `fintheon.test`, `hermes.fintheon.test`, and `news.fintheon.test`, and prove local health with localhost and Portless routes.
- [ ] Preserve Electron's current behavior: prefer healthy Portless local backend on macOS, fall back to localhost, then fall back to `https://fintheon.fly.dev`.
- [ ] Add operator docs/runbooks for rotation, Infisical sync, Portless Desktop repair, and safe validation without printing secret values.

## Scope -- Excluded (OUT OF BOUNDS)

- Do not replace Fly.io or Vercel hosting in this brief.
- Do not ship Infisical machine-identity credentials inside the public Desktop app or installer.
- Do not add new app UI, settings panels, or marketing copy.
- Do not start a Vite dev server.
- Do not print, paste, or log secret values in tickets, docs, commands, or validation output.
- Do not remove the existing Supabase `server_secrets` path until compatibility and boot fallback are proven.

## Known Issues to Preserve

- `v7.0.8` already removed several hardcoded bootstrap secrets from current files and updated the public landing/auth/deploy surfaces; preserve that work and do not roll back `src/lib/changelog.ts`.
- Current repo guidance says desktop releases must pass `bun run release:preflight` before publishing and `bun run release:verify-dmg` after upload; this brief does not publish a DMG.
- Existing Portless wiring lives in `electron/portless-services.cjs`, `scripts/portless-desktop-services.mjs`, `fintheon.config.ts`, and root `package.json` scripts.
- Existing backend deploy remains `cd backend-hono && fly deploy --yes`; never deploy from repo root.
- Memory note: prior release contamination leaked credential-adjacent files; create the branch from a clean base and exclude runtime files before tagging.

## Reference Intake

- Infisical CLI can inject secrets into commands with `infisical run`; use it for local operator/backend processes, not for shipping secrets to end-user apps. Source: [Infisical CLI run](https://infisical.com/docs/cli/commands/run).
- Infisical Secret Syncs can push source secrets into Fly.io and Vercel, so Fly/Vercel remain deploy targets while Infisical owns canonical values. Sources: [Fly.io Sync](https://infisical.com/docs/integrations/secret-syncs/flyio), [Vercel Sync](https://infisical.com/docs/integrations/secret-syncs/vercel).
- Infisical scan can scan git history and `git-changes`; use it as a gate after the repo scrub, plus GitHub push protection. Source: [Infisical secret scanning](https://infisical.com/docs/cli/scanning-overview).
- Portless is already a repo dependency and local routing layer; reuse current scripts/config instead of adding another local proxy.

## Design Pass

### Layout / Interaction

No product UI is included. The operator-facing experience is CLI/runbook only:

- `fintheon install` and update flows should quietly ensure Portless is installed or provide one compact repair command.
- Validation output must show key names, sync status, app names, route health, and commit hashes only.
- Error messages should be short, direct, and actionable: missing Infisical token, missing project id, failed sync, Portless not installed, hosts not synced, or health probe failed.

### API / Service Shape

No public Hono endpoint is required. Add or update repo scripts with small single-purpose boundaries:

- `scripts/security/secret-inventory.mjs`: scans current tree and selected refs for live-looking secrets, redacts values, and exits non-zero on reportable findings.
- `scripts/security/infisical-env-check.mjs`: validates required non-secret Infisical config is present: `INFISICAL_PROJECT_ID`, environment slug, and sync ids or documented manual-sync mode.
- `scripts/security/infisical-sync-check.mjs`: calls Infisical API only for sync status or manual sync trigger using `INFISICAL_TOKEN`; prints status and key counts, never values.
- `scripts/security/portless-desktop-check.mjs`: wraps `bun run portless:desktop:status`, probes `http://localhost:8080/healthz`, `http://fintheon.test/healthz`, and reports whether hosts/proxy need repair.
- Existing `scripts/portless-desktop-services.mjs` remains the route-registration source unless it cannot cover installer/update needs.

Fallback behavior:

- Missing Infisical config blocks deploy/sync automation but must not block local frontend builds.
- Missing Portless falls back to localhost/remote backend and prints the repair command.
- Desktop end users never receive production server secrets; if local backend cannot authenticate server-only work, it falls back to the remote backend or degraded local behavior.

### Data / Agent Shape

- No Supabase schema migration is planned.
- Existing `server_secrets` remains a compatibility fallback while Infisical becomes canonical.
- RLS must not be weakened. Any check of `server_secrets` must query key presence or source status only, never values.
- No Harper/Oracle/Feucht/Consul/Herald prompt changes are required.

### Aesthetic Rules

- No app UI is touched.
- If any docs include terminal examples, keep them compact, plain, and secret-redacted.
- No gradients, emojis, Kanban borders, AI sparkles, or generic box-shadows.

## Development Flow

1. **Freeze and evidence capture**
   - Confirm repo visibility, default branch, current branch, current tags, and dirty worktree.
   - Save a redacted incident inventory with affected paths, commit ranges, key classes, and rotation owners.
   - Do not include raw secret values in the inventory.

2. **Rotation and revocation**
   - Rotate/revoke every exposed credential class: Supabase DB password/service role, GitHub PAT, OpenAI/OpenRouter/DeepSeek/Nous, Notion, Exa, FRED, VAPID private key, cron token, LiveKit if overlap is found.
   - Update Fly/Vercel/runtime values through Infisical sync or temporary direct provider commands only after the new value exists in Infisical.
   - Verify production health after each high-risk rotation: `/healthz`, `/api/diagnostics`, auth login, CAO chat provider health, RiskFlow ingest status.

3. **Current tree hardening**
   - Keep `.cursor/install.sh`, `fintheon`, `scripts/setup.ts`, workflow files, `.env.template`, and installer/update scripts free of live values.
   - Extend `.gitignore` for env backups and local credential artifacts.
   - Add or update the redacted scanner script and make it runnable locally and in CI.

4. **History scrub**
   - Use `git filter-repo` or BFG from a clean clone to remove the known exposed files/strings from all refs.
   - Re-run `infisical scan --log-opts="--all"` and the repo scanner after rewrite.
   - Force-push only after TP confirms the repo freeze and remote backup plan.

5. **Infisical canonical source**
   - Add documented Infisical project layout: `dev`, `staging`, `prod`; paths `/backend`, `/frontend-public`, `/desktop-local`, `/ci`.
   - Add non-secret `.infisical.example.json` or docs only; never commit tokens, client secrets, or service tokens.
   - Configure Fly.io Secret Sync for `fintheon`, riskflow worker, and any sibling apps; use key schema/disable deletion where needed so Infisical manages only intended keys.
   - Configure Vercel Secret Sync for public web/mobile env values. Only `VITE_*` publishable keys belong in Vercel frontend scope.
   - Add manual sync verification that reports sync status and runtime health without showing values.

6. **Portless Desktop standardization**
   - Verify `package.json` Portless scripts are present and correct.
   - Update `scripts/fintheon-setup.sh`, `scripts/install-cli.sh`, `scripts/fintheon-update.sh`, and `fintheon` so Desktop installs run Portless install/sync/status when available.
   - Preserve fallback logic in `electron/portless-services.cjs`.
   - Make health probes cover `localhost:8080`, `fintheon.test`, `hermes.fintheon.test`, and `news.fintheon.test`.

7. **CI and guardrails**
   - Add a CI step for redacted secret scanning on current changes.
   - Add a documented local pre-commit option: `infisical scan git-changes --staged --verbose`.
   - Enable GitHub secret scanning/push protection if plan permissions allow; otherwise record the exact blocker and manual alternative.

8. **Validation**
   - Run current-tree scanner and Infisical scan.
   - Run backend build.
   - Run Portless local route checks.
   - Smoke Fly and Vercel sync status and production health.
   - Do not run a Vite dev server.

9. **Changelog + docs**
   - Add a `src/lib/changelog.ts` entry with touched files and validation.
   - Update `README.md`, `SETUP.md`, or `docs/security/infisical-portless.md` with concise operator steps.
   - Add file headers to substantially modified scripts.

## Acceptance Criteria

- [ ] Every exposed credential class has a redacted inventory owner and status recorded without raw values; rotation is not required unless TP reopens that lane or a provider confirms live exposure.
- [ ] Current `HEAD` has no live-looking secrets in known exposed files or scanner output.
- [ ] Public git history has been scrubbed or, if GitHub blocks rewrite, the blocker and compensating controls are documented.
- [ ] GitHub secret scanning and push protection are enabled, or the exact account/plan blocker is documented.
- [ ] Infisical is the documented canonical source for backend, CI, Fly, and Vercel secrets.
- [ ] Fly and Vercel secrets are synced from Infisical or have a documented manual-sync fallback with no repo-stored values.
- [ ] Desktop install/update paths ensure or repair Portless routing.
- [ ] `http://localhost:8080/healthz` and `http://fintheon.test/healthz` both pass on a configured macOS Desktop machine.
- [ ] Electron still falls back cleanly when Portless is unavailable.
- [ ] No Infisical machine identity credentials are shipped to Desktop end users.
- [ ] `cd backend-hono && bun run build` passes.
- [ ] `bun run release:preflight` is not required unless the executor changes packaging or publishes a Desktop artifact.
- [ ] Changelog entry added to `src/lib/changelog.ts`.
- [ ] File header `// [claude-code 2026-05-30]` added to substantially modified source scripts.

## Validation Commands

```bash
# Current tree secret scan
bun scripts/security/secret-inventory.mjs --mode=current

# Infisical git-history scan, after CLI install/login
infisical scan --log-opts="--all"

# Staged change scan
infisical scan git-changes --staged --verbose

# Infisical sync status, values redacted by design
bun scripts/security/infisical-env-check.mjs
bun scripts/security/infisical-sync-check.mjs --env=prod

# Backend build
cd backend-hono && bun run build

# Portless Desktop route checks
bun run portless:desktop:status
bun scripts/security/portless-desktop-check.mjs
curl -fsS http://localhost:8080/healthz
curl -fsS http://fintheon.test/healthz

# Production smoke after rotations/sync
curl -fsS https://fintheon.fly.dev/healthz
curl -fsS https://fintheon.fly.dev/api/diagnostics | head -c 400
```

## Commit Format

```bash
[v7.0.9] chore: S85 Infisical secrets and Portless desktop infra
```
