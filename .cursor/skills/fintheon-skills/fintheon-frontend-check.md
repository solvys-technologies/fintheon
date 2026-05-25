---
name: fintheon-frontend-check
description: Run frontend-specific health checks — TypeScript strict mode, Vite build, key component imports, and bundle integrity. Use after frontend changes, before deploy, or to investigate frontend build failures.
disable-model-invocation: true
---

# Fintheon Frontend Check

You are a frontend engineer verifying the React 19 + Vite + Tailwind app builds cleanly and key surfaces are importable.

---

## Phase 1 — Type Check

```bash
npx tsc --noEmit --project frontend/tsconfig.json
```

This is the strictest gate. Every file must compile. Report any errors with file path, line number, and error code.

## Phase 2 — Build

```bash
rm -rf frontend/dist
cd frontend && bun run build
```

If this fails after tsc passes, it's a bundler issue (missing asset, broken import, vite config problem).

## Phase 3 — Component Import Check

Verify key component trees are importable without errors by checking their entry points exist:

```bash
echo "=== Consilium ===" && ls -d frontend/components/consilium/*.tsx 2>/dev/null | head -5
echo "=== Narrative ===" && ls -d frontend/components/narrative/*.tsx 2>/dev/null | head -5
echo "=== Chat ===" && ls -d frontend/components/chat/*.tsx 2>/dev/null | head -5
echo "=== Layout ===" && ls -d frontend/components/layout/*.tsx 2>/dev/null | head -5
echo "=== Arbitrum ===" && ls -d frontend/components/arbitrum/*.tsx 2>/dev/null | head -5
echo "=== Journal ===" && ls -d frontend/components/journal/*.tsx 2>/dev/null | head -5
echo "=== Refinement ===" && ls -d frontend/components/refinement/*.tsx 2>/dev/null | head -5
echo "=== Charts ===" && ls -d frontend/components/charts/*.tsx 2>/dev/null | head -5
```

Check for empty directories or missing expected files. Report if a major surface (e.g., `Consilium/index.tsx`, `Sanctum.tsx`, `CognitionPanel.tsx`) is missing.

## Phase 4 — Module Size Check

Fintheon has a <300 line per file rule. Find any offenders:

```bash
find frontend -name "*.tsx" -o -name "*.ts" | xargs wc -l 2>/dev/null | sort -rn | head -15 | awk '$1 > 300'
```

If there are over-300-line files, list them. This is a warning, not a blocker, but should be flagged.

## Phase 5 — Asset Check

Verify critical assets exist:

```bash
ls -la frontend/public/textures/ 2>/dev/null || echo "WARN: No textures directory"
ls -la frontend/public/fonts/ 2>/dev/null || echo "WARN: No fonts directory"
ls frontend/public/*.png frontend/public/*.svg 2>/dev/null || echo "WARN: No root public images"
```

## Phase 6 — Tailwind Check (Optional)

If Tailwind was recently modified, verify the build processes the config:

```bash
grep -c "@tailwind\|@import\|tailwind" frontend/src/styles/globals.css 2>/dev/null || \
  grep -c "@tailwind\|@import\|tailwind" frontend/src/index.css 2>/dev/null || \
  echo "WARN: No Tailwind directives found in CSS"
```

---

## Phase 7 — Report

```
============================================
  FINTHEON FRONTEND CHECK
  Date: {date}
============================================

TypeScript:         [PASS/FAIL] ({N} errors)
Vite Build:         [PASS/FAIL]
Component Imports:  [PASS/FAIL]
File Size Limit:    [PASS/WARN] ({N} files over 300 lines)
Assets:             [PASS/WARN]
Tailwind:           [PASS/WARN]

Failures:
  {list each issue}

Overall: {PASS / WARN / FAIL}
============================================
```

---

## Rules

- This skill is read-only — never modify code unless asked
- Always `rm -rf frontend/dist` before build
- Distinguish between type errors, bundler errors, and missing files
- Over-300-line files are warnings, not blockers — flag them
- If key component directories are empty, that's likely an error
