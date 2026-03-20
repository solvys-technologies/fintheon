# Trading Blackout Policy

**Effective**: 2026-03-09 | **Owner**: TP (Chief)

## Rule

**No non-urgent Pulse engineering execution during 08:30-11:00 EST, Monday-Friday.**

This window covers market open and the highest-volatility period. All agents (Claude Code, Harper, Cursor, Codex) and human engineers must observe this rule.

## Scope

- No code merges to `main` or release branches
- No backend deployments or restarts
- No database migrations
- No config changes to live systems

## Exceptions

- **Critical hotfixes only** — approved by TP before execution
- A critical hotfix is defined as: active trading is broken and losing money right now

## Pre-Deploy Checklist (Outside Blackout)

Before any deployment:

1. `npx vite build` passes with zero errors
2. Backend `npm run dev` starts without errors
3. Chat send/receive tested manually (new thread + existing thread)
4. Error states verified (kill backend, confirm error bar appears)
5. No console errors in browser dev tools
6. `frontend/lib/changelog.ts` updated with deployment entry

## Pre-Execution Gate

Before starting any engineering task, check:

- [ ] Are we inside blackout window (08:30-11:00 EST)?
- [ ] If yes: is this a TP-approved critical hotfix?
- [ ] If no approval: defer until after 11:00 EST

## Rollback

If a deployment causes issues during trading hours:

1. `git revert <commit>` to last known-good state
2. Redeploy immediately
3. Log incident in changelog
4. Post-mortem after market close
