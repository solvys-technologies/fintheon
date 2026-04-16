# S19 — Mobile Agent Interface

**Sprint:** S19
**Date:** 2026-04-16
**Base Branch:** `mobile-agent-upgrade` (from `main`)
**Tracks:** 4 (T1-T4)
**Waves:** 2 (parallel T1/T2/T3 → sequential T4 unify)

## Sprint Goal

Transform the mobile Harper chat from a text-only shell into a full agent interface: image attachments, RiskFlow headline injection, inline tool approval (blocking until response), persistent searchable sessions, and Consilium access via Harper's existing tools.

---

## Execution Sequence

### Wave 1 (parallel — 3 tracks, branch from `mobile-agent-upgrade`)

@docs/sprint-briefs/S19-T1-relay-expansion.md
@docs/sprint-briefs/S19-T2-mobile-agent-ui.md
@docs/sprint-briefs/S19-T3-conversation-persistence.md

### Wave 2 (after Wave 1 completes)

@docs/sprint-briefs/S19-T4-unify.md

Orchestrating instance handles unification — merge all three track branches, wire SessionList→ChatPage glue, changelog, full validation.

---

## Conflict Risk

- **T1 vs T2:** Zero — T1 touches only `backend-hono/`, T2 touches only `mobile/`
- **T1 vs T3:** Zero — same reasoning
- **T2 vs T3:** Zero — T2 owns `ChatPage.tsx` + `ChatInput.tsx`, T3 owns `SessionList.tsx`. No overlap. Glue in T4.

## Summary

| Wave      | Tracks     | Parallelism  | Est. Lines |
| --------- | ---------- | ------------ | ---------- |
| 1         | T1, T2, T3 | 3 parallel   | ~800       |
| 2         | T4 (unify) | 1 sequential | ~30        |
| **Total** |            |              | **~830**   |
