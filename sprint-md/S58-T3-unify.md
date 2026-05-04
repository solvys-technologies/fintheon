# Sprint Brief: T3 -- Unification & Cross-Platform Validation

## Context

T1 rebuilt the backend provider pipeline (`deepseek-reasoner` primary, VProxy 3rd fallback, encrypted key storage). T2 built the client SDK with both `DeepSeek (Direct)` and `DeepSeek (OC API)` paths and updated desktop + mobile chat surfaces. This track merges both, resolves any interface mismatches, and validates the entire system end-to-end across all platforms.

## Branch Target

`s58-deepseek-primary` (merge both T1 and T2 changes, resolve conflicts)

## Dependency

**T1 AND T2 must both be complete and pushed to the shared branch before this track starts.** This track reads the merged codebase and runs the full validation suite.

## Scope -- Included

- [ ] Merge T1 + T2 changes on `s58-deepseek-primary`, resolve all git conflicts
- [ ] Verify API contracts: T2's SDK calls match T1's endpoint signatures (route paths, request/response shapes, auth headers)
- [ ] Verify agent persona preservation: run a Harper chat and confirm response voice matches pre-migration CAO tone
- [ ] Verify tool access preservation: Harper can still call tools (market data, RiskFlow, calendar, etc.)
- [ ] End-to-end smoke test: set API key → chat with DeepSeek (Direct) → verify conversation persists → reload → verify hydration
- [ ] End-to-end smoke test: set OpenCode Go API settings → chat with DeepSeek (OC API) → verify conversation persists → reload → verify hydration
- [ ] Backend build + typecheck
- [ ] Desktop frontend build + typecheck
- [ ] Mobile PWA build + typecheck
- [ ] Verify migration SQL runs cleanly
- [ ] Verify Supabase RLS on `user_api_keys` table (user A cannot see user B's keys)
- [ ] Verify encrypted key roundtrip (store → fetch → decrypt → use → still works)
- [ ] Verify fallback chain: block DeepSeek Direct/OC API → confirm OpenRouter kicks in → block OpenRouter → confirm VProxy kicks in
- [ ] Verify mobile direct-path: set key → chat → no relay hops in network tab
- [ ] Verify mobile relay fallback: remove key → chat → still works via relay
- [ ] Check `src/lib/changelog.ts` for completeness (both T1 and T2 entries present)
- [ ] Add S58 completion changelog entry
- [ ] File-size audit: no modified file exceeds 300 lines (split if needed)

## Scope -- Excluded (DO NOT TOUCH)

- No new feature code — this is merge + validation only
- No design changes to unrelated surfaces (Sanctum, Dashboard, Arbitrum UI)
- No RiskFlow worker changes
- No deploy (deploy is a separate `/solvys-deploy` step after T3 approval)

## Reuse Inventory

- Backend restart: `launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist && launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`
- Supabase CLI for migration: `npx supabase migration up` (if local Supabase) or verify migration SQL is valid
- `src/lib/changelog.ts` — existing changelog format

## Implementation Steps

1. **Pull latest** from `s58-deepseek-primary` (both T1 and T2 should be pushed)
2. **Resolve git conflicts** if any (file ownership was designed to be non-overlapping, but `changelog.ts`, `apiClient.ts`, and `useHermesChat.ts` may have merge points)
3. **API contract verification**:
   - Check T2's `deepseek-sdk.ts` calls `GET /api/settings/ai-keys?provider=deepseek` — matches T1's route at `routes/settings/ai-keys.ts`
   - Check T2's `persistUserMessage()` / `persistAssistantMessage()` call correct backend endpoints
   - Check auth token attachment on all backend calls
4. **Run all typechecks**:
   ```bash
   cd backend-hono && bun run build
   npx tsc --noEmit --project frontend/tsconfig.json
   cd mobile && npx tsc --noEmit --project tsconfig.json
   ```
5. **Run all builds**:
   ```bash
   cd frontend && rm -rf dist && npx vite build
   cd ../mobile && rm -rf dist && npx vite build
   ```
6. **Restart backend** and verify diagnostics
7. **Supabase migration** — run the new migration, verify `user_api_keys` table exists with RLS
8. **Encryption roundtrip test** — curl POST key → curl GET key → verify decrypted value matches original
9. **Harper chat test** — send a message, verify response voice is Harper (CAO tone: "synthesizes, orchestrates, with authority")
10. **Tool access test** — ask Harper "what's the latest RiskFlow IV score?" → should call tool and return data
11. **Sub-agent test** — send a message that triggers Oracle ("what's the probability of a rate cut?") → verify DeepSeek-powered response
12. **Arbitrum test** — `POST /api/arbitrum/deliberate` → verify 5-seat deliberation runs on DeepSeek
13. **Fallback chain test** — temporarily set `DEEPSEEK_V4_API_KEY` to invalid value → verify OpenRouter → verify VProxy
14. **Mobile direct test** — open mobile PWA, set key, chat → verify no relay hops
15. **Mobile relay test** — clear key, chat → verify relay still works
16. **Thread bank test** — chat → reload → verify conversation history hydrates
17. **File-size audit** — check all modified files are ≤ 300 lines
18. **Changelog** — add S58 completion entry

## Acceptance Criteria

- [ ] All backend, frontend, and mobile builds pass cleanly
- [ ] All typechecks pass with zero errors
- [ ] Harper chat produces CAO-voice responses with working tool calls
- [ ] Oracle/Feucht/Consul/Herald sub-agents route through DeepSeek
- [ ] Arbitrum 5-seat deliberation works on DeepSeek
- [ ] API key encrypt → store → fetch → decrypt → use roundtrip works
- [ ] RLS prevents cross-user key access
- [ ] DeepSeek Direct / DeepSeek OC API → OpenRouter → VProxy fallback chain works in order
- [ ] Mobile works both direct (with key) and relay (without key)
- [ ] Thread bank persists and hydrates correctly
- [ ] No files over 300 lines
- [ ] Changelog has entries for T1, T2, and S58 completion

## Validation Commands

```bash
# Full backend build
cd backend-hono && bun run build

# Full frontend build
cd ../frontend && rm -rf dist && npx vite build

# Full mobile build
cd ../mobile && rm -rf dist && npx vite build

# Restart local backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Diagnostics
curl -s http://localhost:8080/api/diagnostics | jq .

# API key roundtrip
curl -X POST http://localhost:8080/api/settings/ai-keys \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(supabase jwt)" \
  -d '{"provider":"deepseek","apiKey":"sk-test-key-12345"}'

curl -X GET http://localhost:8080/api/settings/ai-keys?provider=deepseek \
  -H "Authorization: Bearer $(supabase jwt)"

# Harper chat smoke
curl -X POST http://localhost:8080/api/harper/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(supabase jwt)" \
  -d '{"message":"What is your role and what tools can you use?","provider":"deepseek"}'

# Line count audit
find backend-hono/src frontend/components frontend/lib mobile -name "*.ts" -o -name "*.tsx" | \
  while read f; do lines=$(wc -l < "$f"); if [ "$lines" -gt 300 ]; then echo "$f: $lines lines"; fi; done
```

## Commit Format

```
[S58] feat: T3 unification — DeepSeek v4 Pro primary provider, cross-platform validation
```
