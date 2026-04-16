# Macroscope PR Review

Review and triage comments posted by **Macroscope** on the current pull request before merging.

## Steps

### 1. Fetch Macroscope Comments

Identify all comments on the PR authored by the Macroscope integration:

- Code quality observations
- Potential bugs or anti-patterns
- Performance concerns
- Security flags

### 2. Categorize by Severity

| Category       | Action                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| **Critical**   | Must fix before merge — security issues, breaking logic, data loss risks |
| **Warning**    | Should address — performance, maintainability, unclear logic             |
| **Suggestion** | Nice to have — style, minor refactors, optional improvements             |
| **Info**       | No action needed — context, explanations, acknowledgments                |

### 3. Generate Action Checklist

For each Critical and Warning item:

```
[File:Line] Brief description of issue
  Suggested fix or approach
```

### 4. Merge Recommendation

- **SAFE TO MERGE** — No critical or warning items, or all addressed
- **MERGE WITH CAUTION** — Warnings present but acceptable risk
- **DO NOT MERGE** — Critical issues remain unresolved

### 5. Output Format

```
## Macroscope PR Review Summary

### Stats
- Total comments: X
- Critical: X | Warning: X | Suggestion: X | Info: X

### Critical Issues (Must Fix)
- [ ] `file:line` — Description
      Fix: approach

### Warnings (Should Address)
- [ ] `file:line` — Description
      Fix: approach

### Suggestions (Optional)
- `file:line` — Description

### Merge Recommendation
VERDICT with reasoning
```
