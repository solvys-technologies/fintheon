# S20 — Agent Swarm Redesign + Platform Operations

**Branch:** `s20-agent-swarm-platform-ops`
**Sprint:** S20 (10 tracks, 3 waves)

---

## Wave 1 (parallel)

```
@docs/sprint-briefs/S20-T1-agent-dossiers.md
```

```
@docs/sprint-briefs/S20-T2-context-feeding.md
```

```
@docs/sprint-briefs/S20-T3-oracle-research.md
```

```
@docs/sprint-briefs/S20-T6-conversation-persistence.md
```

```
@docs/sprint-briefs/S20-T8-routines.md
```

## Wave 2 (after Wave 1)

```
@docs/sprint-briefs/S20-T4-agent-memory.md
```

```
@docs/sprint-briefs/S20-T5-notion-cleanup.md
```

```
@docs/sprint-briefs/S20-T7-mobile-ux.md
```

```
@docs/sprint-briefs/S20-T9-backend-streamlining.md
```

## Wave 3 (after Wave 2)

```
@docs/sprint-briefs/S20-T10-integration.md
```

---

**Wave 1** launches the core agent identity work (T1 dossiers, T2 context feeding, T3 Oracle research) in parallel with platform ops (T6 conversation persistence, T8 Routines setup). No file conflicts — each track owns its own files.

**Wave 2** builds on Wave 1: T4 wires the learning loop (needs stable agent identity from T1/T2), T5 cleans up Notion (needs dossier extraction from T1), T7 does mobile UX (needs ChatPage from T6), T9 streamlines the backend (needs boot changes from T3).

**Wave 3** is the orchestrating instance — merges all tracks, runs full deliberation validation, deploys to all 3 targets (Fly.io, Vercel desktop, Vercel mobile).
