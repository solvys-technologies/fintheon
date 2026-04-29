# SOUL.md files — agent identity grounding

W1d (Claude-05) populates this directory with `harper.md`, `oracle.md`, `feucht.md`, `consul.md`, `herald.md`.

Every SOUL.md imports `../../../../CLAUDE.md` literally as `grounding.source_of_truth`. Do NOT copy-paste CLAUDE.md content into these files.

See [`docs/sprint-briefs/S27-T8-soul-conversion.md`](../../../../docs/sprint-briefs/S27-T8-soul-conversion.md) for the schema + all 5 files.

Loader: [`loader.ts`](./loader.ts) — W1d writes this next to the `.md` files.
Schema: [`shared/soul-schema.ts`](../../../../shared/soul-schema.ts).
Drift guard: [`scripts/soul-ground-check.ts`](../../../../scripts/soul-ground-check.ts) — CI-runnable.
