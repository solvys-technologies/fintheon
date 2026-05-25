---
name: fintheon-smokecheck
description: Run basic smoke tests against the Fintheon backend and frontend. Checks that the backend is up, diagnostics report healthy, and key endpoints return 200. Use after deploy, after restart, or whenever you need a quick sanity check.
disable-model-invocation: true
---

# Fintheon Smoke Check

You are a QA engineer running a quick smoke check against the Fintheon stack. This is NOT a full test suite — it is a 2-minute sanity check to confirm the system is alive and responding.

## Doctrine

- Fast feedback: start with the local backend, then production
- Every failure should produce evidence (curl output, error message)
- If a target is unreachable, note it and continue — don't block on one target
- Never modify code during a smoke check

---

## Phase 1 — Local Backend

### 1a. Health Check

```bash
curl -s http://localhost:8080/api/diagnostics
```

**Expected**: valid JSON with `services` object. Look for `"status": "ok"` or similar. If the local backend isn't running:

```bash
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
sleep 3
curl -s http://localhost:8080/api/diagnostics
```

### 1b. Key Endpoint Smoke

```bash
for endpoint in \
  "/api/riskflow/feed" \
  "/api/arbitrum/latest" \
  "/api/journal/entries" \
  "/api/journal/summary"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080$endpoint")
  echo "[$STATUS] localhost:8080$endpoint"
done
```

**Expected**: All return 200. A 404 means the route isn't registered. A 500 means the handler is broken.

### 1c. Brief Endpoints

```bash
for type in MDB ADB PMDB TWT; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/data/brief/latest?type=$type")
  echo "[$STATUS] GET /api/data/brief/latest?type=$type"
done
```

**Expected**: 200 or 404 (if brief hasn't been generated yet). Not 500.

### 1d. Diagnostics Verbose

```bash
curl -s http://localhost:8080/api/diagnostics | python3 -m json.tool 2>/dev/null || curl -s http://localhost:8080/api/diagnostics
```

Check that key services report healthy: Supabase, Hermes, AI provider, etc.

---

## Phase 2 — Production Backend

```bash
for endpoint in \
  "/api/diagnostics" \
  "/api/riskflow/feed" \
  "/api/arbitrum/latest"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://fintheon.fly.dev$endpoint")
  echo "[$STATUS] fintheon.fly.dev$endpoint"
done
```

**Expected**: All return 200 or 401 (if auth-required endpoint, which is acceptable — means the backend is alive).

---

## Phase 3 — Frontend (Optional)

If you have a frontend URL:

```bash
curl -s -o /dev/null -w "%{http_code}" "https://fintheon-desktop.vercel.app" 2>/dev/null || \
  curl -s -o /dev/null -w "%{http_code}" "https://fintheon.pricedinresearch.io" 2>/dev/null || \
  echo "FRONTEND: No known URL — check Vercel deploy"
```

**Expected**: 200 (if deployed) or 0/unreachable (acceptable if not deployed).

---

## Phase 4 — Report

```
============================================
  FINTHEON SMOKE CHECK
  Date: {date}
============================================

Local Backend:    [PASS/FAIL]
Production:       [PASS/FAIL]
Frontend:         [PASS/FAIL/UNKNOWN]

Endpoint Results:
  [200] GET /api/diagnostics
  [200] GET /api/riskflow/feed
  [200] GET /api/arbitrum/latest
  [200] GET /api/journal/entries
  [200] GET /api/journal/summary
  [200] GET /api/data/brief/latest?type=MDB
  [...]

Failures:
  {list any non-200 responses with details}

Overall: {PASS / PARTIAL / FAIL}
============================================
```

If PARTIAL or FAIL, list exactly what is broken and how to fix it.

---

## Rules

- This skill is read-only — never modify code
- Fast feedback: test locally before production
- Report all results, including skips
- If the local backend isn't running, attempt one restart, then report
