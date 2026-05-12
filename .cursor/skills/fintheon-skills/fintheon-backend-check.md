---
name: fintheon-backend-check
description: Run backend-specific health checks — build, diagnostics endpoint, key service wiring, and route registration. Use after backend changes, before deploy, or to investigate backend issues.
disable-model-invocation: true
---

# Fintheon Backend Check

You are a backend engineer verifying the Hono API server is healthy, routes are registered, and key services are wired correctly.

---

## Phase 1 — Build Gate

```bash
cd backend-hono && bun run build
```

Must pass before anything else. If it fails, report the exact TypeScript error.

## Phase 2 — Local Backend Health

### 2a. Start Backend

```bash
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
sleep 3
```

### 2b. Diagnostics

```bash
curl -s http://localhost:8080/api/diagnostics | python3 -m json.tool
```

Examine the output:

- Are all expected services listed?
- Do any report an error state?
- Is the auth bypass status correct?
- Are AI provider connections healthy?

### 2c. Route Registration Check

Check the master route registry is loading all expected route modules:

```bash
grep -n "import.*from.*routes/" backend-hono/src/routes/index.ts | head -30
```

Or for a quick count:

```bash
grep -c "import.*from.*routes/" backend-hono/src/routes/index.ts
```

**Expected**: ~40-90 imports covering all functional areas (arbitrum, voice, riskflow, data, harper, journal, etc.)

---

## Phase 3 — Service Wiring

### 3a. Service Boot Check

```bash
grep -n "register\|init\|start\|boot" backend-hono/src/boot/services.ts | head -20
```

Verify key services are booted:

- Harper handler
- Arbitrum engine
- Hermes client
- RiskFlow service
- Voice service
- Supabase client
- Browser pool (if configured)

### 3b. Route Health Check

```bash
for endpoint in \
  "/api/diagnostics" \
  "/api/riskflow/feed" \
  "/api/arbitrum/latest" \
  "/api/journal/entries" \
  "/api/journal/summary" \
  "/api/mcp"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080$endpoint")
  echo "[$STATUS] $endpoint"
done
```

### 3c. Env Var Check

Verify required and optional env vars are set:

```bash
echo "OPENROUTER_API_KEY: ${OPENROUTER_API_KEY:+SET}${OPENROUTER_API_KEY:-MISSING}"
echo "SUPABASE_URL: ${SUPABASE_URL:+SET}${SUPABASE_URL:-MISSING (optional)}"
echo "SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY:+SET}${SUPABASE_SERVICE_KEY:-MISSING (optional)}"
echo "BYPASS_AUTH: ${BYPASS_AUTH:+SET}${BYPASS_AUTH:-unset (JWTs required)}"
```

**Note**: Only `OPENROUTER_API_KEY` is required. Everything else degrades gracefully.

---

## Phase 4 — Production Backend Check

```bash
for endpoint in "/api/diagnostics" "/api/arbitrum/latest" "/api/riskflow/feed"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://fintheon.fly.dev$endpoint")
  echo "[$STATUS] fintheon.fly.dev$endpoint"
done
```

---

## Phase 5 — Report

```
============================================
  FINTHEON BACKEND CHECK
  Date: {date}
============================================

Build:              [PASS/FAIL]
Local Backend:      [PASS/FAIL]
Diagnostics:        [PASS/FAIL]
Route Registry:     {N} routes loaded
Service Wiring:     [PASS/FAIL]
Production:         [PASS/FAIL]
Env Vars:           {OPENROUTER: SET/MISSING, others: OPTIONAL}

Issues:
  {list any issues}

Overall: {PASS / PARTIAL / FAIL}
============================================
```

---

## Rules

- This skill is read-only — never modify code unless asked
- If the backend doesn't build, report the specific file and error
- If diagnostics shows service failures, identify which service and why
- Distinguish between env var missing (degraded) vs actual code error
