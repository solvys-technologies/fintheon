# Sprint S21 — Orchestration

**Goal:** Replace the passive relay pickup-code UX with an active mirror dispatch — clicking relay on desktop sends a web-push to the paired mobile, opens the Fintheon PWA to the conversation, and switches desktop into a read-only mirror with a Disconnect button. **Concurrently ship the mobile chat baseline fixes** (broken input, endpoint routing) plus new RiskFlow headline attach modal and image attachments, so that when dispatch lands the user on mobile, the mobile chat actually works end-to-end. Bundle two adjacent Ultrareview fixups (dreams GET ordering, oracle feature-flag semantics).

**Branch:** `s20-agent-swarm-platform-ops`
**Version target:** `v5.19.0`
**Tracks:** 1 (single-track sprint per user directive)
**Unification:** handled inline by the single track (Wave E).

---

## Wave 1 (only wave — single track)

```
@docs/sprint-briefs/S21-T1-relay-dispatch.md
```

### What this wave accomplishes

**T1 — Relay Button Dispatch (Mirror Model) + Mobile Chat Rescue**

Moves the relay button out of `ChatHeader` and into the chat composer's action cluster on both the sidebar chat and the main Ask Harp chat. Wires the button to a new `/api/relay/dispatch` flow that fires a web-push to the user's paired mobile device and opens the PWA directly to the conversation. Desktop enters **mirror mode** — the composer textarea is disabled, a "Chatting on {device}" banner appears, and messages the user types on mobile stream back to desktop in real time via a new SSE endpoint. A Disconnect button replaces the relay button while dispatched; clicking it tears down the session and re-enables the desktop composer.

**Mobile chat rescue (landed mid-planning):** the mobile chat input was reported broken (couldn't type, couldn't send) — that regression is fixed in the same track, endpoint delivery is verified for both relay and direct modes, a new RiskFlow headline picker modal is added to the mobile composer, and image attachments are wired end-to-end through to Harper's vision pipeline. Dispatch is worthless if the mobile chat it lands on doesn't function — these ship together.

The same track also flips `dreams.ts` GET ordering to descending (so clients stop being pinned to the 50 oldest dreams once the table outgrows the limit) and adds `envInverse: true` to the `oracle_research` feature-flag entry so `getFlag()` matches the scheduler's opt-out semantics on `ORACLE_RESEARCH_ENABLED`.

**Touch surface:** frontend (5 files), backend (4 files), mobile (5–6 files + new modal + service worker patch), + changelog. All file ownership listed in the brief.

**Dependencies:** S21-T1 reuses the S20 relay infrastructure (`relay-bridge`, `relay-ws.ts`, web-push VAPID, conversation-store ownership check). Assumes `b9482f9` (S21 security batch) is merged into the branch — which it is.

---

## Out of scope for S21

- Renaming/retiring the clipboard pickup-code flow. Keep or remove at implementer discretion during T1; not a gating concern.
- Multi-device pairing (desktop → iPad + iPhone simultaneously). Current design dispatches to the single paired mobile from `relayBridge.isConnected(userId)`. Multi-device can come in a future sprint if needed.
- Mobile-initiated dispatch (mobile pushing a conversation to desktop). One-directional for now.
- The `bug_001` re-flag from the Ultrareview pass on `outcome-tracker.ts` — that's a stale snapshot; the fix already landed in `b9482f9`. Do not revert or re-touch.

## Rollback plan

If any phase destabilizes the local backend or the chat surface:

1. `git revert` the single S21 commit — one commit covers the whole track.
2. Restart local backend via `launchctl unload / load`.
3. Desktop reverts to clipboard pickup-code flow (kept intact or easily restorable from git history).
