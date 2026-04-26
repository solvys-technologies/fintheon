# Sprint Brief: S42-T9 — Unification + Validation + PR

## Context

The 8 worker tracks (T1-T8) land on independent sub-branches. This track is the **single source of truth merge**: pull all 8 into `s42-chat-sota`, resolve interface mismatches, run the full validation suite, restart local backend, deploy to Fly, smoke-test prod, and open one PR against `main`.

This brief runs AFTER T1-T8 complete. Do not start until each worker brief's acceptance criteria are met (verify by reading each track's commit log).

## Branch Target

`s42-chat-sota` (the sprint integration branch in worktree `~/Desktop/Codebases/fintheon-s42-chat-sota`)

## Scope — Included

- [ ] Merge `s42-t1-stream` → `s42-chat-sota`
- [ ] Merge `s42-t2-composer` → `s42-chat-sota`
- [ ] Merge `s42-t3-render` → `s42-chat-sota`
- [ ] Merge `s42-t4-artifact` → `s42-chat-sota`
- [ ] Merge `s42-t5-browserbase` → `s42-chat-sota`
- [ ] Merge `s42-t6-ask` → `s42-chat-sota`
- [ ] Merge `s42-t7-perf` → `s42-chat-sota`
- [ ] Merge `s42-t8-nothing` → `s42-chat-sota`
- [ ] Resolve interface mismatches between tracks (most likely T2↔T4 around chat-open events; T3↔T8 around fuse imports; T1↔T3 around event types)
- [ ] Run full validation suite (tsc + vite build for frontend + mobile + bun build for backend)
- [ ] Restart local backend (`launchctl unload + load`)
- [ ] Deploy to Fly (`fly deploy --yes` from `backend-hono/`)
- [ ] Smoke prod (`curl https://fintheon.fly.dev/api/diagnostics`)
- [ ] Add changelog entry to `src/lib/changelog.ts` documenting the sprint
- [ ] Open single PR against `main` with sprint summary

## Scope — Excluded (DO NOT TOUCH)

- Anything not produced by T1-T8
- Refinement Engine S37
- TradingView Sanctum chart
- MCP routes
- MDB/ADB/PMDB/TWT cron
- Persona prompts
- Supabase migrations
- Any in-flight sprint (S38 design-patches branch, S40 ttp-realtime branch) — do NOT cross-merge
- `feed-health.log` conflicts → resolve `--theirs` per memory

## Reuse Inventory

- Existing `git merge` workflow (no rebase; preserve track commit history per memory: `subtractive rollback` rule favors merge-traceability)
- Memory: "Backend deploys must restore prod" — every backend touch must finish with `fintheon.fly.dev/api/*` healthy
- Memory: "Verify branch before deploy" — `git branch --show-current` + verify state on disk before any build/deploy
- Memory: "Tag-authoritative installers" — version bump tag `v5.29.0` (or next patch) AFTER PR merges
- `gh pr create` for PR opening
- `src/lib/changelog.ts` for entry (memory: NO plaintext secrets, URLs, customer data)

## Known Issues to Preserve

- All track-level "Known Issues to Preserve" sections — verify each was actually preserved during merge
- Memory: "auto-checkpoint hook" — there will be background commits; this is expected, do not revert them
- Memory: "feed-health.log" conflicts default-resolve `--theirs`

## Implementation Steps

1. **Pre-merge verification** — confirm all 8 tracks have completed:
   ```bash
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota
   for branch in s42-t1-stream s42-t2-composer s42-t3-render s42-t4-artifact s42-t5-browserbase s42-t6-ask s42-t7-perf s42-t8-nothing; do
     echo "=== $branch ==="
     git log --oneline ${branch} ^v5.28.0 | head -5
   done
   ```
2. **Merge in dependency order** — T1 first (others depend on its event types), then T8 (others depend on fuse primitives), then the rest:
   ```bash
   git checkout -b s42-chat-sota v5.28.0
   git merge --no-ff s42-t1-stream    # types first
   git merge --no-ff s42-t8-nothing   # primitives second
   git merge --no-ff s42-t2-composer
   git merge --no-ff s42-t3-render
   git merge --no-ff s42-t4-artifact
   git merge --no-ff s42-t5-browserbase
   git merge --no-ff s42-t6-ask
   git merge --no-ff s42-t7-perf
   ```
3. **Conflict resolution playbook**:
   - `feed-health.log` → `git checkout --theirs feed-health.log`
   - `package.json` deps overlap → keep ALL new deps (cmdk, @assistant-ui/react-streamdown, @browserbasehq/sdk, etc.); reconcile versions to latest
   - `bun.lockb` / `package-lock.json` → delete + regenerate (`bun install` or `npm install`)
   - `frontend/types/bridge-stream.ts` → if T1 + T3 both touched, keep T1's union extension as authoritative
   - `frontend/components/ChatInterface.tsx` → T2 (composer wiring), T4 (artifact pane), T7 (mount perf) all touch this; manually merge — composer block from T2, dualPane extension from T4, skeleton + telemetry from T7
   - `frontend/components/shared/NothingFuse.tsx` → T8 owns; if T3 accidentally edited, revert to T8's version
   - For ANY other unresolvable conflict → STOP, read both sides, reconcile manually
4. **Run full validation suite**:

   ```bash
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx tsc --noEmit --project tsconfig.json
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx tsc --noEmit
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota/backend-hono && bun run build

   rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend/dist
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota/frontend && npx vite build

   rm -rf ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile/dist
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota/mobile && npx vite build
   ```

5. **Restart local backend** (memory: launchd-managed):
   ```bash
   launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
   launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
   curl -s http://localhost:8080/api/diagnostics | head -50
   ```
   Backend dist must come from worktree's `backend-hono/dist/` — verify launchd plist points to the right path (memory: launchd backend reads from Desktop checkout).
6. **End-to-end smoke** (run each scenario; document any regression):
   - Cold mount web `/chat` → composer <50ms (T7)
   - Cmd+K opens palette (T2)
   - Slash command `/oracle hi` → Oracle persona for one turn (T2)
   - `@NVDA earnings` → ticker context attached (T2)
   - Send mid-stream → MessageQueue holds (T2)
   - Offline → queue persists in localStorage (T2)
   - Assistant turn shows streaming cursor + activity rail + footer + citation chips (T3)
   - Click citation chip → ArtifactPane opens with citation source (T3+T4)
   - Agent emits TradingView artifact → pane mounts NVDA chart (T1+T4)
   - Agent calls `browse_visible(...)` → browserbase session in pane (T5) OR screenshot fallback if no key
   - Click Ask on Arbitrum verdict → chat opens with verdict context (T6)
   - RiskFlow expanded card has Ask AI affordance + cleaner visual (T6)
   - NothingFuse + spinners show Nothing-design treatment (T8)
   - Doto numerals visible in MessageFooter latency, KPI cards (T8)
   - Mobile parity: cold mount `<50ms`, swipe-up palette, ArtifactSheet, all output cards have Ask buttons
   - MCP server list `/api/mcp` returns same shape as before; Claude Peers wired
   - HeadlinePickerPopover, FintheonAttachPopup, persona dropdown, Relay button all functional in composer
7. **Deploy to Fly** (memory: from `backend-hono/`, never repo root; never to `pulse-api`):
   ```bash
   cd ~/Desktop/Codebases/fintheon-s42-chat-sota/backend-hono && fly deploy --yes
   curl -s https://fintheon.fly.dev/api/diagnostics | head -50
   ```
   If 404 or HTML returned → STOP, redeploy (memory: backend deploys must restore prod).
8. **Add changelog entry** at `src/lib/changelog.ts`:
   ```typescript
   {
     date: "2026-04-25T<HH:mm:ss>",
     agent: "claude-code",
     summary: "S42 Chat SOTA: ComposerPrimitive + cmdk palette + MessageQueue, AssistantMessagePrimitive + streamdown + AgentActivityRail + CitationChip + MessageFooter, dual-pane ArtifactPane (TradingView/browserbase/report/citation) + mobile ArtifactSheet, Browserbase agent-iframe plugin + EmbeddedBrowserFrame mode prop, Ask About This on every output surface + RiskFlow expanded refactor, mount-perf <50ms, Nothing-design fuses + spinners + Doto on frontend.",
     files: [<list every file touched across T1-T8>],
   }
   ```
   Memory: NO plaintext secrets, URLs, or customer data (changelog ships in bundle).
9. **Open PR**:

   ```bash
   git push -u origin s42-chat-sota
   gh pr create --title "S42 Chat SOTA: Brotzky doctrine + artifact pane + browserbase + Nothing fuses" --body "$(cat <<'EOF'
   ## Summary

   - 8-track parallel sprint refactoring all chat surfaces (web + mobile) toward Brotzky/Fey-grade UX
   - Adopts assistant-ui primitives, cmdk palette, streamdown markdown, Agent Elements activity rail
   - New dual-pane artifact preview (TradingView, browserbase, agent reports, citations)
   - Browserbase plugin for user-visible agent browser sessions
   - Ask AI affordance on every output surface
   - Nothing-design refactor of fuses + spinners; Doto font on desktop frontend
   - <50ms mount-time target on web + mobile

   See sprint-md/S42-ORCHESTRATION.md for detailed breakdown.

   ## Test plan

   - [x] tsc + vite build clean for frontend + mobile
   - [x] bun build clean for backend
   - [x] Local backend healthy
   - [x] fintheon.fly.dev/api/diagnostics healthy
   - [x] Cold mount <50ms verified in DevTools
   - [x] All 17 smoke-test scenarios pass

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

10. **Post-PR**: post the PR URL back as the final output.

## Acceptance Criteria

- [ ] All 8 sub-branches merged into `s42-chat-sota` with no unresolved conflicts
- [ ] Full validation suite passes (tsc + vite build + bun build for all 3 surfaces)
- [ ] Local backend healthy (`localhost:8080/api/diagnostics`)
- [ ] fintheon.fly.dev/api/diagnostics healthy after deploy
- [ ] All 17 smoke scenarios pass (see step 6)
- [ ] Changelog entry added (no secrets/URLs/customer data)
- [ ] PR opened against `main` with title and body above
- [ ] PR URL posted back to user

## Validation Commands

(see step 4 above for full suite)

```bash
# Final prod smoke
curl -s https://fintheon.fly.dev/api/diagnostics | jq .
curl -s https://fintheon.fly.dev/api/mcp | jq .
```

## Commit Format

Merge commits use `git merge --no-ff` so each track stays attributable. Final commit on `s42-chat-sota` is the changelog update:

```
[v5.29.0] chore: S42 changelog entry — Chat SOTA sprint
```

Then PR opens against main.

## Banned Ornaments

- Same as all worker tracks: no gradients, no emojis, no Kanban borders, no AI sparkles, no glassmorphic surfaces

## Notes

- DO NOT skip hooks (memory: `--no-verify` banned unless explicit)
- DO NOT force-push (memory rule)
- DO NOT amend commits (memory: prefer new commits)
- DO NOT cross-merge with `s38-design-patches` or `s40-ttp-realtime` — those are independent in-flight sprints
- If any worker track hasn't landed yet, STOP and wait — do not partial-merge
