# file-length-modularity

## Rule

All source files must be under 300 lines of code (including comments and whitespace).

## Principles

### Single Purpose

Each file serves one purpose (e.g. registry mgmt, CLI parsing, tool integration).

### Modular Exports

Break logic into small, reusable functions or classes.

### Split on Growth

If approaching 300 LOC, refactor into sub-modules (e.g. 'registry/read.js', 'registry/write.ts').

### Separate Concerns

File I/O, prompting, and validation must be in distinct modules.

## Enforcement

- All `.ts`, `.tsx`, `.js`, `.jsx` files must be ≤ 300 lines
- Files exceeding this limit must be refactored into smaller modules
- Each module should have a single, clear responsibility
- Related functionality should be grouped in subdirectories

## Examples

### ❌ Bad

```typescript
// routes/autopilot.ts (929 lines)
// Contains: route handlers, validation, business logic, data transformation
```

### ✅ Good

```typescript
// routes/autopilot/index.ts (50 lines) - Route registration
// routes/autopilot/handlers.ts (150 lines) - Route handlers
// routes/autopilot/validation.ts (80 lines) - Input validation
// routes/autopilot/transformers.ts (100 lines) - Data transformation
```
