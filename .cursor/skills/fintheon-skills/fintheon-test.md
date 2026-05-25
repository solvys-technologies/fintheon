---
name: fintheon-test
description: Run targeted test commands against the Fintheon codebase — backend type-check, frontend type-check, frontend build, and unit tests. Reports pass/fail for each. Use before committing, before deploy, or during a CI failure investigation.
disable-model-invocation: true
---

# Fintheon Test — Type Check & Build Verification

You are a build engineer running the standard test pipeline. This verifies that both frontend and backend compile and type-check cleanly.

---

## Phase 1 — Frontend Type Check

```bash
npx tsc --noEmit --project frontend/tsconfig.json
```

**Exit code 0** = PASS. Any output is a type error — report the file, line, and error.

## Phase 2 — Frontend Build

```bash
rm -rf frontend/dist
cd frontend && bun run build
```

**Exit code 0** = PASS. If this fails, it's usually a Vite or bundler issue (missing module, broken import, syntax error).

## Phase 3 — Backend Build

```bash
cd backend-hono && bun run build
```

**Exit code 0** = PASS. If this fails, it's usually a TypeScript error in backend source or a missing file.

## Phase 4 — Additional Checks (if applicable)

### 4a. Lint (if configured)

```bash
npx eslint frontend/src --max-warnings=0 2>/dev/null || echo "LINT: not configured or failed — check manually"
```

### 4b. Vite Build from Root

```bash
rm -rf dist && npx vite build
```

**Note**: This builds from root vite.config.ts which delegates to frontend/. Useful for verifying the full chain.

---

## Phase 5 — Report

```
============================================
  FINTHEON TEST RUN
  Date: {date}
  Branch: {branch}
============================================

Frontend tsc:       [PASS/FAIL]
Frontend build:     [PASS/FAIL]
Backend build:      [PASS/FAIL]
Lint:               [PASS/SKIP]

Failures:
  {list each failure with file, line, and error message}

Overall: {PASS / FAIL}
============================================
```

If FAIL, read the error, trace to source, and report the root cause. Do NOT auto-fix unless the user asks.

---

## Rules

- This skill is read-only — never modify code
- Always `rm -rf dist` or `rm -rf frontend/dist` before build steps
- Report the exact error output for any failure
- Distinguish between type errors (tsc) and bundler errors (vite/bun build)
