# File Length and Modularity Rules

> **Mandatory for all AI agents and developers**

## Core Rule: 300 Lines Maximum

Every code file MUST be kept under **300 lines of code**. This is a hard limit, not a suggestion.

### Why This Matters

- **Readability**: Long files are hard to understand and review
- **Maintainability**: Smaller files are easier to debug and modify
- **Testability**: Modular code is easier to test in isolation
- **Collaboration**: Multiple agents/developers can work on different modules

---

## How to Apply This Rule

### 1. Route Files (`routes/*.ts`)

Keep route handlers thin. If a route file exceeds 300 lines:

- Extract business logic to service files
- Split into route groups (e.g., `routes/ai/index.ts`, `routes/ai/handlers/chat.ts`)

**Good Example:**

```
routes/
├── ai/
│   ├── index.ts           (< 100 lines - route registration)
│   └── handlers/
│       ├── chat.ts        (< 150 lines)
│       ├── conversations.ts (< 100 lines)
│       └── scoring.ts     (< 100 lines)
```

### 2. Service Files (`services/*.ts`)

Services should be focused on a single responsibility:

**Bad:**

```
services/ai-service.ts (800 lines - does everything)
```

**Good:**

```
services/
├── ai/
│   ├── model-config.ts    (model selection logic)
│   ├── streaming.ts       (streaming response handling)
│   ├── context-builder.ts (context preparation)
│   └── chat-service.ts    (main chat orchestration)
```

### 3. Type Definitions

Large type files should be split by domain:

```
types/
├── ai.ts        (AI-related types)
├── trading.ts   (trading types)
├── news.ts      (news/riskflow types)
```

---

## Enforcement Checklist

Before committing code, verify:

- [ ] No single file exceeds 300 lines
- [ ] Each file has a single, clear responsibility
- [ ] Complex logic is extracted into helper functions or separate modules
- [ ] Related functionality is grouped in directories

---

## Refactoring Triggers

If you find yourself in any of these situations, refactor immediately:

| Situation                                | Action                     |
| ---------------------------------------- | -------------------------- |
| File approaching 250 lines               | Start planning extraction  |
| Multiple unrelated functions in one file | Split by responsibility    |
| Deeply nested logic                      | Extract into helper module |
| Copy-pasting code                        | Create shared utility      |

---

## Module Organization Patterns

### Handler Pattern (for routes)

```typescript
// routes/ai/index.ts - Registration only (< 50 lines)
import { chatHandlers } from './handlers/chat.js';
aiRoutes.post('/chat', chatHandlers.handleChat);

// routes/ai/handlers/chat.ts - Logic (< 200 lines)
export async function handleChat(c: Context) { ... }
```

### Service Pattern (for business logic)

```typescript
// services/news-service.ts - Orchestration (< 150 lines)
import { xClient } from "./x-client.js";
import { classifyMacroLevel } from "./news-classifier.js";

// services/x-client.ts - External API (< 200 lines)
// services/news-classifier.ts - Classification logic (< 100 lines)
```

---

## Quick Reference

| File Type     | Max Lines | Purpose            |
| ------------- | --------- | ------------------ |
| Route index   | 50-100    | Route registration |
| Route handler | 150-200   | Request handling   |
| Service       | 200-300   | Business logic     |
| Utility       | 50-150    | Helper functions   |
| Types         | 50-100    | Type definitions   |
| Config        | 50-100    | Configuration      |
