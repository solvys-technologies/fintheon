# macroscope-review

# /review-macroscope — Custom Cursor Command

## Purpose

Review and triage comments posted by **Macroscope** on the current pull request before merging.

## Instructions

When invoked, perform the following:

### 1. Fetch Macroscope Comments

Identify all comments on the PR authored by the Macroscope integration. These typically include:

- Code quality observations
- Potential bugs or anti-patterns
- Performance concerns
- Security flags

### 2. Categorize by Severity

Group comments into:
| Category | Action |
|----------|--------|
| 🔴 **Critical** | Must fix before merge—security issues, breaking logic, data loss risks |
| 🟠 **Warning** | Should address—performance, maintainability, unclear logic |
| 🟡 **Suggestion** | Nice to have—style, minor refactors, optional improvements |
| ⚪ **Info** | No action needed—context, explanations, acknowledgments |

### 3. Generate Action Checklist

For each 🔴 Critical and 🟠 Warning item, produce:
[File:Line] Brief description of issue
└─ Suggested fix or approach

### 4. Summarize for Merge Decision

Provide a clear recommendation:

- **✅ SAFE TO MERGE** — No critical or warning items, or all have been addressed
- **⚠️ MERGE WITH CAUTION** — Warnings present but acceptable risk
- **🛑 DO NOT MERGE** — Critical issues remain unresolved

### 5. Output Format

## Macroscope PR Review Summary

### Stats

- Total comments: X
- 🔴 Critical: X | 🟠 Warning: X | 🟡 Suggestion: X | ⚪ Info: X

### Critical Issues (Must Fix)

- [ ] `src/api/auth.ts:42` — Missing null check on userID
      └─ Add defensive guard before accessing auth properties

### Warnings (Should Address)

- [ ] `src/services/news.ts:118` — Unbounded array growth in memory
      └─ Implement pagination or cap array size

### Suggestions (Optional)

- `src/utils/format.ts:23` — Consider extracting to shared utility

### Merge Recommendation

🛑 **DO NOT MERGE** — 1 critical issue requires resolution

```

## Usage
Run `/review-macroscope` after Macroscope has posted its comments and before clicking "Merge".
```
