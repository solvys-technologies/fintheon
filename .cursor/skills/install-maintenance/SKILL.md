# Install Maintenance — Post-Ship Installation Audit

## When to Use

**Mandatory after every `/solvys-ship` or deploy.** This skill runs automatically as the final step of shipping. It ensures the installation and update scripts stay in sync with the codebase so users never see errors after running `fintheon update`.

Also trigger manually when:
- A new npm/bun package is added to `package.json` or `backend-hono/package.json`
- A new environment variable is referenced in source code
- A new service or API integration is introduced
- A new CLI tool dependency is required
- The build process changes
- `fintheon update` produces errors on a clean install

## Files to Keep in Sync

| File | What to Update |
|------|----------------|
| `scripts/fintheon-setup.sh` | New deps in install step, new env vars in .env template, new services |
| `scripts/fintheon-update.sh` | New deps in install step, new env vars backfilled in Step 5 |
| `scripts/install-cli.sh` | New CLI subcommands if needed |
| `backend-hono/.env.example` | New env vars with sensible defaults |
| `README.md` | New user-facing features, changed commands, new prerequisites |
| `SETUP.md` | Agent handoff changes, new configuration requirements |
| `.env.production` | New frontend env vars for Vite builds |

## Post-Ship Audit Checklist

Run these checks after every ship. If any produce output, fix before closing.

### 1. Dependency Diff

```bash
git diff HEAD~5 -- package.json backend-hono/package.json | grep "^\+"
```

If new packages were added, `bun install` in setup/update scripts already handles them. No action needed unless a package requires a system-level dependency (e.g., a native module needing `brew install`).

### 2. Environment Variable Audit

```bash
# Find all env vars referenced in backend source
grep -roh "process\.env\.[A-Z_]*" backend-hono/src/ --include="*.ts" | \
  sed 's/process\.env\.//' | sort -u > /tmp/env-used.txt

# Find all env vars documented in .env.example
grep "^[A-Z_]" backend-hono/.env.example | cut -d= -f1 | sort -u > /tmp/env-documented.txt

# Show undocumented env vars
comm -23 /tmp/env-used.txt /tmp/env-documented.txt
```

For each undocumented env var:
- Has a code-level default? → Add as a comment in `.env.example`
- Required for basic functionality? → Add to `.env.example` with default AND backfill in `fintheon-update.sh` Step 5
- Is a secret? → Ensure code handles its absence gracefully (in-memory fallback, degraded mode, etc.)

### 3. Update Script Backfill Check

Verify `scripts/fintheon-update.sh` Step 5 has a backfill line for every required env var:

```bash
grep -q "^NEW_VAR=" "$BACKEND_ENV" || echo "NEW_VAR=default_value" >> "$BACKEND_ENV"
```

### 4. Build Process Validation

If build steps changed, update both `fintheon-setup.sh` and `fintheon-update.sh`.

### 5. Commit Tag

If any install files were updated, include in the commit message:

```
INSTALL-UPDATE: [what changed]
- New dep: [package]
- New env: [VAR=default]
- Scripts updated: [list]
```

## Production-Safe Defaults (Reference)

Safe to embed in scripts and .env.example:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | `https://nrcfnzclbjboctptxaxx.supabase.co` |
| `SUPABASE_ANON_KEY` | `eyJhbG...` (publishable anon JWT) |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_rNxiWGth_...` |
| `BYPASS_AUTH` | `true` |
| `PORT` | `8080` |
| `AI_PRIMARY_PROVIDER` | `openrouter` |

**NEVER embed:** `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` with passwords, any `sk-` prefixed key.

## Error Prevention Patterns

- **Graceful Fallback**: Every service must work when its env var is missing (in-memory DB, bypass auth, degraded AI)
- **Backfill on Update**: New env vars are auto-added to existing `.env` files — never assume users re-run setup
- **Silent Recovery**: All script steps use `|| true` or `2>/dev/null` for non-critical failures
