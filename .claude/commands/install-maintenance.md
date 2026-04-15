# Install Maintenance — Post-Ship Installation Audit

Run this after every deploy or ship. Ensures installation and update scripts stay in sync with the codebase so `fintheon update` never breaks.

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

## Audit Checklist

### 1. Dependency Diff
```bash
git diff HEAD~5 -- package.json backend-hono/package.json | grep "^\+"
```
If new packages added, check if any require system-level deps (e.g., native modules needing `brew install`).

### 2. Environment Variable Audit
```bash
# Find all env vars referenced in backend source
grep -roh "process\.env\.[A-Z_]*" backend-hono/src/ --include="*.ts" | sed 's/process\.env\.//' | sort -u > /tmp/env-used.txt
# Find all documented in .env.example
grep "^[A-Z_]" backend-hono/.env.example | cut -d= -f1 | sort -u > /tmp/env-documented.txt
# Show undocumented
comm -23 /tmp/env-used.txt /tmp/env-documented.txt
```

For each undocumented var:
- Has code-level default? Add as comment in `.env.example`
- Required for basic functionality? Add to `.env.example` AND backfill in `fintheon-update.sh` Step 5
- Is a secret? Ensure code handles absence gracefully

### 3. Update Script Backfill Check
Verify `scripts/fintheon-update.sh` Step 5 has a backfill line for every required env var:
```bash
grep -q "^NEW_VAR=" "$BACKEND_ENV" || echo "NEW_VAR=default_value" >> "$BACKEND_ENV"
```

### 4. Build Process Validation
If build steps changed, update both `fintheon-setup.sh` and `fintheon-update.sh`.

### 5. Commit Tag
If install files were updated, include in commit:
```
INSTALL-UPDATE: [what changed]
- New dep: [package]
- New env: [VAR=default]
- Scripts updated: [list]
```

## Production-Safe Defaults

Safe to embed in scripts:

| Variable | Value |
|----------|-------|
| `BYPASS_AUTH` | `true` |
| `PORT` | `8080` |
| `AI_PRIMARY_PROVIDER` | `openrouter` |

**NEVER embed:** `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `DATABASE_URL` with passwords, any `sk-` prefixed key.
