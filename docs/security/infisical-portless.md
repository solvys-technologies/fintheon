# S121 Infisical and Portless Runbook

## Current Boundary

This repo no longer needs live secret values in tracked installer, update, or
environment files. Infisical is the canonical source for backend, CI, Fly, and
Vercel secrets. Fly and Vercel remain runtime targets populated by Infisical
Secret Syncs.

Do not ship Infisical machine identity credentials in Desktop builds,
installers, DMGs, update scripts, or app resources.

## Infisical Layout

Environments:

- `dev`
- `staging`
- `prod`

Paths:

- `/backend`: server-only backend secrets such as Supabase service role,
  database URL, AI provider keys, cron token, LiveKit server secret, VAPID
  private key, and provider API credentials.
- `/frontend-public`: Vite publishable values only. Use `VITE_*` keys and only
  values that are safe in a browser bundle.
- `/desktop-local`: local operator values for Desktop backend development and
  Portless route configuration. No production machine identity token belongs
  here.
- `/ci`: CI-only values used by GitHub Actions and release automation.

Copy `.infisical.example.json` to a local `.infisical.json` if the operator
wants a local project config. Keep tokens in the shell, keychain, or CI secret
store.

## Local Backend

Use Infisical to inject backend secrets into the process:

```bash
export INFISICAL_PROJECT_ID=<project-id>
export INFISICAL_ENV=dev
export INFISICAL_TOKEN=<machine-identity-token>

infisical run --projectId "$INFISICAL_PROJECT_ID" --env dev --path=/backend --path=/desktop-local --command "cd backend-hono && bun run dev"
```

The legacy Supabase `server_secrets` table remains a compatibility fallback
while Infisical becomes canonical. Do not remove that fallback until boot
compatibility is proven in production and Desktop.

## Fly and Vercel Syncs

Create Fly.io Secret Syncs from `/backend` to:

- `fintheon`
- RiskFlow worker app
- Any sibling backend worker app that reads server-only keys

Create Vercel Secret Syncs from `/frontend-public` to public web/mobile
projects. Only publishable `VITE_*` values belong in Vercel frontend scope.

Recommended sync options:

- Enable auto-sync after the first manual validation.
- Use key schema or restricted paths so Infisical manages only intended keys.
- Enable disable-secret-deletion when a provider still has manually managed
  values outside this sprint.

Check config and sync state without printing values:

```bash
bun run security:infisical:env
bun run security:infisical:sync -- --env=prod
bun scripts/security/infisical-sync-check.mjs --env=prod --trigger
```

## Secret Incident Response

Rotation receipt shape:

```text
date:
operator:
credential class:
old source path or commit range:
rotation owner:
new value stored in Infisical path:
provider revocation receipt:
runtime health checked:
notes:
```

Never record raw secret values. Use provider receipt IDs, key names, commit
ranges, and redacted scanner fingerprints only.

Credential classes to rotate or verify revoked:

- Supabase database password and service role
- GitHub PATs and release/upload tokens
- OpenAI, OpenRouter, DeepSeek, Nous, and related AI provider keys
- Notion, Exa, FRED, Firecrawl, and other research API keys
- VAPID private key
- Cron token
- LiveKit server secret if overlap is found

Current tree scan:

```bash
bun run security:secrets
infisical scan git-changes --staged --verbose
```

History scrub must wait for TP freeze-window approval. Use a clean clone, then
remove known exposed paths/strings with `git filter-repo` or BFG, re-run:

```bash
infisical scan --log-opts="--all"
bun scripts/security/secret-inventory.mjs --mode=refs --refs=HEAD
```

Force-push only after TP confirms repo freeze and backup.

## GitHub Secret Scanning

Enable secret scanning and push protection from repository settings or API.
If GitHub blocks the setting because of account plan, org policy, or missing
admin rights, record the exact blocker in the S121 receipt and keep local
Infisical/current-tree scanning as the compensating control.

```bash
gh api -X PATCH repos/solvys-technologies/fintheon \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -f security_and_analysis[secret_scanning][status]=enabled \
  -f security_and_analysis[secret_scanning_push_protection][status]=enabled

gh api repos/solvys-technologies/fintheon --jq '.security_and_analysis'
```

## Portless Desktop

Portless is the local named-route layer for Desktop:

- `fintheon.test` -> local backend on `localhost:8080`
- `hermes.fintheon.test` -> local Hermes-compatible service on `localhost:8318`
- `news.fintheon.test` -> local news worker on `localhost:8082`

Repair and validate:

```bash
bun run portless:desktop:install
bun run portless:desktop
bun run portless:desktop:check
curl -fsS http://localhost:8080/healthz
curl -fsS http://fintheon.test/healthz
```

Clean `.test` hostnames require the Portless install/hosts sync step to run in
a terminal that can prompt for sudo. Non-interactive agents can still verify
the proxy by using `127.0.0.1:1355` with the intended `Host` header, but that
does not satisfy the Desktop clean-hostname gate.

Electron keeps the existing fallback order: healthy Portless local backend on
macOS, then localhost, then `https://fintheon.fly.dev`.

## Production Smoke

After rotation or sync:

```bash
curl -fsS https://fintheon.fly.dev/healthz
curl -fsS https://fintheon.fly.dev/api/diagnostics | head -c 400
```

Do not run a Vite dev server for S121 validation.
