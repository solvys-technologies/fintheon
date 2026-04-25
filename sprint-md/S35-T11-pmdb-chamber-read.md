# Sprint Brief: T11 — PMDB Chamber Read Integration (Wave 2)

## Context

Arbitrum's 17:00 ET session cron produces a signal-landscape digest. PMDB runs at 17:30 ET (just after). This track wires the bridge: PMDB generator fetches the latest `trigger_type='session'` verdict from `arbitrum_verdicts` and injects its `digest_text` into the PMDB prompt as a "Chamber Read" section. Single-file edit.

## Branch Target

`s35-t11-pmdb-chamber-read` (off `s34-unified` — gated on T1 landing)

## Gated on

- T1 `backend-hono/src/services/arbitrum/verdict-store.ts` exports `getLatestChamberRead(): Promise<string | null>` and is merged into `s35-unified`

## Scope — Included

- [ ] EDIT `backend-hono/src/services/brief-generator.ts` — single insertion point after line 100 (before prompt injection per plan file reuse inventory):

```ts
// After existing feedSummary + econSummary assembly (~line 99-100), BEFORE prompt injection:

// [claude-code 2026-04-24 S35-T11] Chamber Read — Arbitrum session digest
let chamberRead: string | null = null;
if (briefType === "PMDB") {
  try {
    const { getLatestChamberRead } =
      await import("../services/arbitrum/verdict-store.js");
    chamberRead = await getLatestChamberRead();
  } catch (err) {
    log.warn(
      { err },
      "getLatestChamberRead failed — PMDB proceeds without Chamber Read",
    );
    chamberRead = null;
  }
}
```

- [ ] Pipe `chamberRead` into the prompt assembly. Find the PMDB-specific branch of the prompt template (somewhere around lines 114-192 where briefType is checked) and add:

```ts
// Inside the PMDB prompt branch:
const chamberSection = chamberRead
  ? `\n\n## Chamber Read (Arbitrum session ${new Date().toISOString().slice(0, 10)})\n\n${chamberRead}\n`
  : "";
// Include chamberSection in the prompt string concatenation.
```

- [ ] If the prompt is built via template literal, add `${chamberSection}` in the appropriate spot. If built via concat, append similarly.

## Scope — Excluded (DO NOT TOUCH)

- `services/arbitrum/*` — T1 owns; you only IMPORT `getLatestChamberRead`
- Any non-PMDB branch of the brief generator — MDB/ADB/TWT prompts stay unchanged
- `brief-generator.ts` line 100 itself is the insertion point; don't replace existing code, insert beneath
- boot/services.ts — T12 owns (brief-generator is called at runtime, no boot wire needed)

## Reuse Inventory

- `getLatestChamberRead(): Promise<string | null>` at `backend-hono/src/services/arbitrum/verdict-store.ts` (T1 exports) — returns the latest session-trigger verdict's `digest_text` or null if no session runs exist
- Existing PMDB branch structure in `brief-generator.ts:64-286`
- `getCurrentBriefType()` at `brief-generator.ts:33-46` — confirms PMDB time window

## Known Issues to Preserve

- **PMDB must survive an absent Chamber Read.** If `getLatestChamberRead()` returns null or throws, PMDB generation proceeds without the section — do NOT 500 the whole brief. Logged warn is fine.
- Use a **dynamic import** (`await import(...)`) if the static import would introduce a circular dependency. Static import first; only switch to dynamic if tsc complains.
- Date string in the section header uses `new Date().toISOString().slice(0, 10)` for YYYY-MM-DD — matches existing PMDB date formatting if it uses one.

## Implementation Steps

1. Open `backend-hono/src/services/brief-generator.ts`
2. Locate line 100 (end of feedSummary + econSummary assembly)
3. Insert the `chamberRead` fetch block immediately below
4. Locate the PMDB prompt branch (the `if (briefType === "PMDB") { ... }` block or equivalent; note that after T5's rename, all references to the PMDB string remain — T5 only touches WT/TOTT/TWT)
5. Build the `chamberSection` string and insert into the prompt template
6. Run `cd backend-hono && bun run build` — should be clean
7. Smoke-test locally (if you have a local backend running): `curl -X POST http://localhost:8080/api/data/brief/generate -H "Content-Type: application/json" -d '{"type":"PMDB"}'` and verify the output includes a "Chamber Read" section (empty body acceptable if no session runs yet)

## Acceptance Criteria

- [ ] `brief-generator.ts` edited with the fetch block after line 100
- [ ] PMDB prompt branch includes the `chamberSection` template literal
- [ ] Import resolves (static or dynamic — either is fine)
- [ ] `cd backend-hono && bun run build` clean
- [ ] PMDB generation does not 500 when `getLatestChamberRead` returns null
- [ ] PMDB generation still works for pre-Chamber-Read-era rows (regression)

## Validation Commands

```bash
cd backend-hono && bun run build

# Static smoke — the edit compiles
grep -nE "getLatestChamberRead|Chamber Read" backend-hono/src/services/brief-generator.ts

# Runtime smoke (needs backend up + any Arbitrum session run present or absent)
curl -sX POST http://localhost:8080/api/data/brief/generate \
  -H "Content-Type: application/json" \
  -d '{"type":"PMDB"}' | head -c 500
```

## Commit Format

```
[v5.25.0-S35-T11] feat: PMDB Chamber Read section (Arbitrum session bridge)

Wires brief-generator.ts to fetch latest Arbitrum session verdict via
getLatestChamberRead() and inject digest_text into the PMDB prompt as
a "Chamber Read" section. Gracefully absent when no session runs yet.
Single-file edit. Non-PMDB briefs (MDB/ADB/TWT) unchanged.
```
