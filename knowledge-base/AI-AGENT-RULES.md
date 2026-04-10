# AI Agent Global Rules

> **Applies to**: All AI agents (Harper-Hermes, Oracle, Feucht, Consul, Herald, Claude Code)
> **Scope**: Fintheon repository tasks

---

## 🚨 Non-Negotiable Rules

### 1. File Length: 300 Lines Maximum

Every code file MUST be under 300 lines. No exceptions.

- See: `knowledge-base/CODE-MODULARITY-RULES.md`
- Split large files into modules immediately

### 2. Build Before Commit

ALWAYS run `npm run build` before committing. Zero tolerance for:

- TypeScript errors
- Missing imports
- Broken references

### 3. Test Before Push

Verify no 500 errors:

```bash
curl http://localhost:8080/health
```

### 4. Branch Naming

Format: `v.{MONTH}.{DATE}.{PATCH}`

```
v.12.28.3  ✓
feature-x  ✗
```

### 5. Commit Format

```
[v.X.X.X] type: message

Types: feat, fix, refactor, docs, chore
```

---

## Development Guardrails

### Code Style

- TypeScript strict mode always
- Use `function` keyword for pure functions
- Prefer interfaces over types
- Use Zod for validation
- Handle errors early (guard clauses)

### Modularity

- One responsibility per file
- Extract helpers to separate modules
- Group related files in directories
- Use barrel exports (`index.ts`)

### Naming

- Booleans: `is`, `has`, `should` prefix
- Files: lowercase-with-dashes
- Functions: descriptive verbs

---

## Backend-Specific Rules (Hono)

### Route Structure

```
routes/
├── feature/
│   ├── index.ts      # Route registration (< 80 lines)
│   ├── schemas.ts    # Zod schemas (< 100 lines)
│   └── handlers/
│       └── *.ts      # Handler functions (< 200 lines each)
```

### Service Structure

```
services/
├── feature-service.ts   # Main orchestration (< 250 lines)
├── feature-client.ts    # External API calls (< 200 lines)
└── feature/
    └── *.ts             # Sub-modules (< 150 lines each)
```

### Database Queries

- Use `sql` template from `db/index.js`
- Parameterized queries only (no string concatenation)
- Always handle errors gracefully

---

## Trading-Specific Rules

### Human-in-the-Loop (MANDATORY)

NO automated trades without explicit user approval.

### ProjectX API

Follow `docs/integration/PROJECTX-API.md` EXACTLY:

- Exact field names (case-sensitive)
- Numeric enum values (not strings)
- Exact URL paths

### Risk Validation

Every trade proposal must pass:

- Daily loss limit check
- Position size limit
- Account balance verification

---

## Documentation Requirements

### New Features

- Update relevant docs in `docs/`
- Add comments for complex logic
- Update implementation plans

### Handoffs

- Create handoff document with:
  - What was done
  - What remains
  - Files changed
  - Verification steps

---

## Quick Reference

| Rule           | Limit                    |
| -------------- | ------------------------ |
| File length    | 300 lines max            |
| Route handler  | 200 lines max            |
| Service file   | 250 lines max            |
| Commit message | Include version tag      |
| Build          | Must pass before commit  |
| Tests          | No 500 errors on startup |

---

## References

- `GLOBAL-CURSOR-RULES.md` - Full coding standards
- `knowledge-base/CODE-MODULARITY-RULES.md` - File structure details
- `docs/HANDOFF-NEW-BACKEND-IMPLEMENTATION.md` - Implementation guide
- `docs/integration/PROJECTX-API.md` - Trading API reference
