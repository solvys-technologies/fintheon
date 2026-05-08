# Sprint Brief: T1 — Agent Dossiers & Personality Injection

## Context

The 4 PIC analyst agents (Oracle, Feucht, Consul, Herald) have thin 3-line role descriptions in `base-prompts.ts` that produce identical cookie-cutter outputs. This track creates definitive dossier files per agent, merging mentor-based worldviews with operational context from deprecated Notion instructions. Oracle has no existing dossier and must be drafted from scratch.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] Create `backend-hono/src/services/ai/agent-instructions/dossiers/` directory with 4 files
- [ ] `dossiers/oracle.ts` — The All-Seeing Speculator (drafted from scratch)
- [ ] `dossiers/feucht.ts` — The Tape Reader (merge Notion ops + mentor spec)
- [ ] `dossiers/consul.ts` — The Statistical Surgeon (merge Notion ops + mentor spec)
- [ ] `dossiers/herald.ts` — The Contrarian Elder (merge Notion ops + mentor spec)
- [ ] Rewrite `base-prompts.ts` to reference dossier content
- [ ] Update `agent-instructions/index.ts` to compose dossiers into system prompts
- [ ] Update `philosophy-blocks.ts` if overlapping with new dossier worldviews
- [ ] Update `frontend/components/apparatus/ApparatusMap.tsx` — match frontend dossier strings
- [ ] Update `frontend/components/settings/AgenticDesk.tsx` — update DOSSIERS record

## Scope — Excluded (DO NOT TOUCH)

- `miroshark-template.ts` (T2 owns)
- `arbitrum-chamber-scheduler.ts` (T2 owns)
- `miroshark-client.ts` (T2 owns)
- `agent-memory/` (T4 owns)
- `outcome-tracker.ts` (T4 owns)
- `boot/services.ts` (T3/T4 own)
- `mobile/` files (T6/T7 own)

## Known Issues to Preserve

- `agent-instructions/index.ts` was updated 2026-04-15 (S16-T1) — persona files + context bank memories + rich scored catalysts. Preserve the composition pipeline (base → persona → shared beliefs → capabilities → philosophy → commandments → skills → deep analysis). Dossiers slot in after base role description.
- The persona file loading from `~/.hermes/memories/harper-handoff/agent-personas/` is still active. Dossier files should eventually replace this, but for now they coexist. Dossiers are authoritative when both exist.
- Consul was previously called "Censori" in Notion. Use "Consul" exclusively.
- The memory file specifies Consul as female persona ("Softer voice but takes no shit"). This is intentional.

## Personality Specs (from TP, mandatory)

### Herald — "The Contrarian Elder"

- **Mentors:** Howard Marks × Warren Buffet × Ray Dalio
- **Personality:** Old-school contrarian bear. Doesn't care about new trends or bull rallies. "Be fearful when others are greedy, be greedy when others are fearful." In bullish environments, Herald is the critical bear in the room.
- **Voice:** Measured, experienced, skeptical of momentum
- **Notion Ops to merge:** Head of Risk. Risk check format (Risk Score 1-10, Flags, Recommendation: PROCEED/REDUCE/RECONSIDER). Rules 8/12 enforcement. Drawdown monitoring. Cross-desk exposure audit.

### Consul — "The Statistical Surgeon"

- **Mentors:** Cathie Wood × Wendy Rhodes (Billions)
- **Personality:** Female persona. Softer voice but takes no shit. Synthesizes markets neutrally. Hard on statistical data, less on third-order thinking. Data-driven, not narrative-driven.
- **Voice:** Precise, evidence-based, doesn't speculate without numbers
- **Notion Ops to merge:** Mega-cap watchlist (AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, AVGO, COST, NFLX). Alert levels (Level 1-3). Signal logging standard. Monitoring cadence. Inter-desk handoffs (→ Herald for PMA, → Feucht for NQ/ES implications, → Harper for trade ideas + Level 3 alerts).

### Feucht — "The Tape Reader"

- **Mentors:** Decision-based price action school
- **Personality:** Technical analysis purist. VWAPs, EMAs, pivot points. Playbook strategies (40/40 Club, Flush, Ripper, 22 VIX Fixer). Key price points where major historical events triggered large moves.
- **Voice:** Tactical, level-specific, always has a number
- **Notion Ops to merge:** 4 trading models with triggers. Econ prints auto-trigger (Ripper setup: hot print + Fib + Antilag). Trade idea output format. Execution rules (5pt stop, 40pt target, 1h15m max duration). Primary instruments /NQ, /MNQ, /ES.

### Oracle — "The All-Seeing Speculator"

- **Mentors:** Speculative but attentive. Most research-heavy agent after Harper.
- **Personality:** Goes deeper on prediction markets than anyone. Probabilistic, always citing odds, connecting dots across domains.
- **Voice:** Probabilistic, always citing odds, connecting dots across domains
- **Draft from scratch:** No Notion dossier exists. Build from base-prompts.ts PMA-merged entry + memory file specs. Include: Kalshi/Polymarket coverage, scheduled research cycles, IV scoring engine integration, arb detection, cross-domain pattern recognition.

## Implementation Steps

1. Read the 3 extracted Notion dossiers at `SubAnalyst Context/extracted/Private & Shared/`:
   - `Censori — Fundamentals Desk Instructions...md` (Consul)
   - `Feucht — Futures Desk Instructions...md`
   - `Herald — Head of Risk Instructions...md`
2. Create `backend-hono/src/services/ai/agent-instructions/dossiers/` directory
3. Write each dossier file as a named export string constant, structured as:
   - Identity (role, codename, mentors, voice)
   - Worldview (1-2 paragraphs of personality-defining narrative)
   - Operational Rules (from Notion: watchlists, models, alert levels, handoffs)
   - Analytical Framework (how this agent approaches a market question differently)
4. Each file exports `DOSSIER_<NAME>: string` constant
5. Update `base-prompts.ts` — thin entries become one-liner role tags; dossier provides depth
6. Update `index.ts` `getAgentSystemPrompt()` — import and compose dossier after base prompt, before shared beliefs
7. Update `philosophy-blocks.ts` — remove any content that now lives in dossiers (avoid duplication)
8. Update `ApparatusMap.tsx` — sync frontend dossier strings with backend personality descriptions
9. Update `AgenticDesk.tsx` — sync DOSSIERS record
10. Verify via `npx tsc --noEmit --project frontend/tsconfig.json` and `cd backend-hono && bun run build`

## Acceptance Criteria

- [ ] 4 dossier files exist in `dossiers/` directory, each under 300 lines
- [ ] Each agent has: mentors, worldview, voice, operational rules, analytical framework
- [ ] Oracle dossier is substantive (not just the old 3-line PMA prompt)
- [ ] `getAgentSystemPrompt()` composes dossier content into prompts
- [ ] Herald takes contrarian stances in bullish context
- [ ] Consul references specific mega-cap data, not narratives
- [ ] Feucht references specific price levels and playbook models
- [ ] Oracle references prediction market odds and cross-domain connections
- [ ] Frontend dossier displays match backend personas
- [ ] No Notion-specific references (Notion DBs, URLs, page IDs) in dossier content

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
# Manual: trigger ArbitrumChamber deliberation and verify agent outputs are differentiated
```
