# Sprint Brief: S62-T25 — PsychAssist: Tilt Scoring + Lockout UX

- **Linear**: SOL-71
- **Parent ORCH**: @sprint-md/S62-ORCH-platform-qa-hygiene.md
- **Branch**: `sprint/S62`
- **Assignee**: Shashank
- **Wave**: 2 (independent — parallel with T22, T24)

## Context

PsychAssist monitors trader emotional regulation (ER) via tilt detection. When the ER score exceeds a threshold, the system must trigger a visible lockout state to prevent impulsive trading. This task reviews the tilt scoring pipeline end-to-end: the `useERScoring` hook, the visual display in `CompactERMonitor` and `WaveformCanvas`, the trader nametag psych state indicator, and the lockout UX itself. The lockout must be clear but not permanent — it should auto-reset after a cooldown or allow manual reset.

## Branch Target

`sprint/S62`

## Scope — Included

- [ ] `frontend/hooks/useERScoring.ts` — ER scoring hook
  - Verify score computation is correct (no NaN, no infinite spikes)
  - Verify threshold comparison feeds into lockout state
  - Verify cooldown/reset logic exists and works
- [ ] `frontend/components/mission-control/CompactERMonitor.tsx` — ER monitor compact view
  - Verify score renders correctly at all levels (low, medium, high, tilt)
  - Verify lockout indicator is visible when tilt threshold exceeded
  - Verify normal state has no false positives (no lockout at normal scores)
- [ ] `frontend/components/mission-control/WaveformCanvas.tsx` — Waveform visualization
  - Verify ER waveform reflects real score changes
  - Verify lockout state is visually distinct on the waveform
- [ ] `frontend/components/TraderNametag.tsx` — Trader nametag psych state
  - Verify psych state indicator updates with ER score
  - Verify lockout state is visible on nametag
- [ ] `frontend/components/mission-control/ThreadHistory.tsx` — Thread history
  - Verify ER events are logged in thread history
  - Verify lockout/unlock events appear in history
- [ ] `frontend/utils/healingBowlSounds.ts` — Healing bowl sound effects
  - Verify sounds trigger on tilt threshold crossing
  - Verify sound respects mute/volume settings
- [ ] `frontend/contexts/ThreadContext.tsx` — Thread context
  - Verify ER state is available in context
  - Verify lockout state flows through context to consumers

## Scope — Excluded (DO NOT TOUCH)

- ER scoring algorithm logic — review correctness, don't retune thresholds
- Backend tilt data pipeline — frontend-only review
- PsychAssist chat integration — separate from lockout UX
- Mobile PWA PsychAssist surface — desktop-only for this task
- Lockout enforcements on the trading side (order blocking) — infra track

## Lockout UX Requirements

| Requirement        | Expected Behavior                               | Check |
| ------------------ | ----------------------------------------------- | ----- |
| Trigger            | Lockout activates when ER score > threshold     | [ ]   |
| Visual indicator   | Clear lockout state visible in CompactERMonitor | [ ]   |
| Nametag            | Trader nametag shows lockout psych state        | [ ]   |
| Waveform           | Lockout distinct on waveform canvas             | [ ]   |
| Sound              | Healing bowl sound on tilt threshold crossing   | [ ]   |
| Not permanent      | Auto-resets after cooldown period               | [ ]   |
| Manual reset       | User can manually clear lockout                 | [ ]   |
| History            | Lockout/unlock events logged in thread history  | [ ]   |
| No false positives | Normal ER range does not trigger lockout        | [ ]   |
| No false negatives | High ER score reliably triggers lockout         | [ ]   |

## Solvys Feels — Aesthetic Rules

- **Lockout indicator**: warm amber/gold pulse at threshold crossing (use `var(--fintheon-accent)`)
- **ER waveform**: clean line, no decorative fills, Solvys Gold for the waveform stroke
- **Nametag**: frosted-glass surface, ER state as subtle dot or thin border accent
- **Monitor**: compact, no Kanban borders, frosted-glass card
- **No**: gradients, emojis, AI sparkles, red emergency blinkers (not on-brand)

## Acceptance Criteria

- [ ] ER scoring hook (`useERScoring`) computes scores correctly (no NaN, no infinite spikes)
- [ ] Lockout triggers when ER score exceeds threshold
- [ ] Lockout state is clearly visible in `CompactERMonitor`
- [ ] Lockout state is visible on `TraderNametag`
- [ ] Waveform canvas reflects lockout state visually
- [ ] Lockout is not permanent — auto-resets after cooldown OR manual reset available
- [ ] Normal ER range has no false positive lockouts
- [ ] Lockout/unlock events appear in thread history
- [ ] Healing bowl sounds trigger on threshold crossing and respect mute
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `npx vite build` passes

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Frontend build
rm -rf dist && npx vite build

# Simulate high ER score test (check hook logic)
grep -n "threshold\|lockout\|cooldown\|reset" frontend/hooks/useERScoring.ts
```

## Commit Format

```
[v.6.0.27-s62-t25] fix: PsychAssist tilt scoring — lockout UX, state transitions, false positive guard
```
