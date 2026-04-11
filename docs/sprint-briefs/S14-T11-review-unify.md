# S14-T11: Review + Unify (FINAL)

## Goal

Independent review instance. Debug, test, debug, test, unify. Runs AFTER T1-T10 merge.

## Process

1. Pull all T1-T10 changes into single branch
2. `bun run build` — must pass clean
3. `npx tsc --noEmit` in backend-hono — must pass
4. Start backend: `cd backend-hono && bun run dev`
5. Start frontend: `bun run dev`

## Test Each Track

### T1: MiroShark

- Trigger simulate from Consilium
- Confirm deliberation runs with real headlines (not empty lanes)
- Composite IV reflects actual market, briefing has specific findings
- Restart backend — deliberation history survives in DB

### T2: Boardroom DAG

- Trigger memo/DAG from boardroom
- Agent responses stream in real-time (not raw API string)
- Thread persists in history after completion

### T3: Feed Pipeline

- Hit force refresh — items from non-Twitter sources appear within 30s
- Check .claude/feed-health.log — Agent Reach fires when rate limited

### T4: Timeline Filters

- Apply narrative thread filter — only matching items show
- Toggle time range to 1h — only last hour shows
- Popover timeline has same working filters

### T5: Feed Consistency

- Open Dashboard, Strategium, RiskFlow Main — items within 5s
- Wait 2 minutes — new items without manual refresh
- Headline attachment popover works in all 3 chat surfaces

### T6: SplashScreen

- Quit + relaunch — liquid glass splash with shuffled background
- Playfair Display text, logo without app name
- Resume from background — no splash

### T7: Artifact Parser

- Trigger trade proposal artifact in chat
- Renders as card, not raw JSON
- Catalyst artifacts dispatch to NarrativeFlow

### T8: CAO Memory

- Rename CAO in Settings — updates everywhere
- Chat 10+ messages — auto-flush to memory
- "Remember this" — immediate save + confirmation

### T9: UI Polish

- Chat header blends like Timeline
- Input bar glows on focus
- Sidebar clean (no Local text, no duplicate provider, no persona)
- Imperium tab renamed, "Wield the Consul" subheader
- All panels have smooth transitions
- "Harper-Opus" -> "Harper" everywhere
- Team card killswitch toggle works
- Onboarding skips Supabase step
- RiskFlow + Harper Activity re-expand toggles work

### T10: Dead Code

- No broken imports
- Footer shows "X" not "Rettiwt"
- Changelog updated

## Fix Integration Issues

- Resolve any merge conflicts between tracks
- Ensure no duplicate state management between T8 CAO naming and T9 Harper rename
- Verify T5 headline attachment doesn't conflict with T7 artifact cards in chat input area

## Final Ship

- Clean build passes
- All verify criteria met
- Commit with `[S14] feat: Aquarium revival + pipeline hardening + CAO memory + UI polish`
- Update @src/lib/changelog.ts
