# S83-ORCH: Vault File Room + Agentic Memo Inbox

## Intent

Build Fintheon's answer to file-backed agent memory: the vault/file base is the source of truth, Fintheon renders it in the File Room, and Harper can draft concise, chart-evidenced desk memos when RiskFlow catalyst drift or watched narratives warrant it.

## Product Decisions

- Vault/file base is the source of truth. Supabase `agent_memory` indexes and recalls vault-backed summaries, but does not become the primary memo store.
- Obsidian is not the operator UI. The frontend File Room is the human-readable surface.
- Files are desk/team scoped. The first active desk is `Priced In Capital`; new team/desk creation can land later without changing the storage contract.
- Chat context injection uses metadata, summaries, and bounded excerpts only. No raw vault dumps, credentials, private DB rows, or unfiltered note bodies.
- Global `@` mentions are owned by S82, but S83 adds mention sources for memos, charts, agents, file-room docs, and vault-backed summaries.
- Only Harper/CAO writes agent-generated memos, with Oracle, Feucht, Consul, and Herald contributing inputs.
- Agentic memos are drafts until approved from the Consilium Desk Rail `Inbox` tab.
- Memo bodies render with Streamdown and should fit on roughly one page.
- Weekly Tribune, agentic memos, NarrativeFlow summaries, PDFs, Notion wiki links, and SOUL files all appear in the File Room under collapsible type sections.
- Major-market-event memos are event-driven, not weekly scheduled. Monday-Friday calendar weeks define the analysis window.

## Linear Home

- **Team**: Solvys
- **Cycle**: Beta Closed
- **Project**: Beta -- Agent desk & governance
- **Initiative**: Beta Closed
- **Phase**: Closed Beta
- **Branch target**: `sprint/S83`
- **Due date**: 2026-05-31

## Trigger Model

1. RiskFlow computes catalyst drift per signal.
2. If a headline or cluster sustains catalyst drift over more than two market sessions, create a desk signal for deeper review.
3. If multiple RiskFlow headlines gain traction around a watched NarrativeFlow/DeskMap narrative, create a memo proposal.
4. At 5 PM ET, the existing CAO/Arbitrum/reflection loop enters a 2-3 hour agentic analysis block.
5. Harper gathers agent inputs, chart evidence, file-room/vault context, and recent desk activity.
6. Harper writes a concise memo draft and places it in the Desk Rail Inbox for TP approval.

## Assignment Matrix

| Issue    | Linear  | Brief                                                | Owner    | Execution path                       | Cycle       | Project                         | Initiative  |
| -------- | ------- | ---------------------------------------------------- | -------- | ------------------------------------ | ----------- | ------------------------------- | ----------- |
| S83-ORCH | SOL-189 | @sprint-md/S83-ORCH-vault-file-room-agentic-inbox.md | TP       | planning/runbook                     | Beta Closed | Beta -- Agent desk & governance | Beta Closed |
| S83-T1   | SOL-190 | @sprint-md/S83-T1-file-room-vault-index.md           | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Beta -- Agent desk & governance | Beta Closed |
| S83-T2   | SOL-191 | @sprint-md/S83-T2-desk-rail-inbox.md                 | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Beta -- Agent desk & governance | Beta Closed |
| S83-T3   | SOL-192 | @sprint-md/S83-T3-cao-memo-drift-engine.md           | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Beta -- Agent desk & governance | Beta Closed |
| S83-T4   | SOL-193 | @sprint-md/S83-T4-chart-evidence-capture.md          | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Beta -- Agent desk & governance | Beta Closed |
| S83-T5   | SOL-194 | @sprint-md/S83-T5-5pm-agentic-analysis-block.md      | Shashank | OpenCode local / Solvys Agent runner | Beta Closed | Beta -- Agent desk & governance | Beta Closed |

## Wave Sequence

1. Run S83-T1 and S83-T2 first so the File Room and Inbox have a stable contract.
2. Run S83-T3 after the Inbox approval shape exists.
3. Run S83-T4 in parallel with S83-T3 only if it avoids mutating chat slot contracts.
4. Run S83-T5 last to bind the daily schedule, Arbitrum, reflection loops, vault reads, and memo proposal workflow.
5. Unify with backend build, frontend typecheck, clean frontend build, and a Consilium/File Room visual pass.

## Linear Taxonomy Audit

- S83 Linear issues created on 2026-05-24: SOL-189 through SOL-194.
- SOL-190 through SOL-194 are children of SOL-189.
- SOL-190 through SOL-194 are assigned to Shashank with 2026-05-31 due date.
- Issue descriptions include `@sprint-md/...` references and a Linear Organization block.
