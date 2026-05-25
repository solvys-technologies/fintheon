# Sprint Brief: S23-T3 — Harper ArbitrumChamber Literacy

## Context

In a live ArbitrumChamber session, Harper responded to a MiroShark report with: "It looks like you've shared simulation output from some kind of market volatility/regime analysis system… a data pipeline is broken." She treats her own platform surface as unknown debug output. Root cause: `buildArbitrumChamberContext()` at [backend-hono/src/services/harper-handler.ts:282-293](../../backend-hono/src/services/harper-handler.ts#L282-L293) only fires when `activeConnectors.includes("arbitrumChamber")`, and the frontend never sets that connector when the user is on the ArbitrumChamber surface. Even when it fires, the context lacks the "how to read this" scaffold an agent needs to interpret IV / heat / regime-shift output. The Hermes CAOs (Oracle/Feucht/Consul/Herald) have the same gap.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] Frontend: when the active CONSILIUM surface is ArbitrumChamber (Sanctum Page 0), append `"arbitrumChamber"` to `activeConnectors` on every `/api/harper/chat` and `/api/hermes/chat` POST. Also add a top-level `surface: "arbitrumChamber"` flag in the request body so backend can gate on surface directly.
- [ ] Backend: enhance `buildArbitrumChamberContext()` output to prepend a **"How to read this"** preamble — explain the IV score scale (0–10, heat bands), regime-shift interpretation, the meaning of Contested / Surfaced findings, and the Market Heat / Regime Risk / Signal Strength KPIs.
- [ ] Backend: auto-inject ArbitrumChamber context whenever `surface === "arbitrumChamber"` or `activeConnectors.includes("arbitrumChamber")` — either path triggers it.
- [ ] Prompt update in [backend-hono/src/services/ai/agent-instructions/index.ts](../../backend-hono/src/services/ai/agent-instructions/index.ts): add an ArbitrumChamber section to Harper's capabilities block instructing her to interpret MiroShark output as ground-truth live simulation rather than debug signal.
- [ ] Extend the same automatic context injection into [backend-hono/src/services/hermes-handler.ts](../../backend-hono/src/services/hermes-handler.ts) so Oracle/Feucht/Consul/Herald also get ArbitrumChamber awareness.

## Scope — Excluded (DO NOT TOUCH)

- ArbitrumChamber UI/layout — T1
- Deliberation polling — T2
- `agent_context_bank` wiring, `traderName` injection, `[MEMORY]` tag parsing — T4

## Known Issues to Preserve

- `buildFeedContext()` is the RiskFlow feed injection; leave its behavior alone.
- `activeConnectors` is also consumed by non-ArbitrumChamber integrations — only append, never replace.

## Implementation Steps

1. Grep for `/api/harper/chat` POST call site(s) in `frontend/`. Typical: `frontend/lib/harperClient.ts` or `frontend/hooks/useHarperChat.ts`. Wire a `useCurrentSurface()` read (or the existing Sanctum page identifier) and append `"arbitrumChamber"` to the connector array when on Page 0. Same for Hermes chat send sites.
2. Add `surface?: "arbitrumChamber" | "dashboard" | "sanctum" | ...` field to both chat request bodies. Backend already accepts `surface` on the Harper route — confirm and extend.
3. In `harper-handler.ts`, change the gate on `buildArbitrumChamberContext()` from `activeConnectors?.includes("arbitrumChamber")` to `activeConnectors?.includes("arbitrumChamber") || body.surface === "arbitrumChamber"`.
4. In `buildArbitrumChamberContext()` output, prepend:
   ```
   --- ArbitrumChamber Context ---
   How to read this:
   - IV Score 0–10 composite: 0–2 Calm Seas, 2–4 Light Winds, 4–6 Gathering Storm, 6–8 Tipping Point, 8–10 Shit Show.
   - Market Heat / Regime Risk / Signal Strength are 0–10 KPIs.
   - Regime shift probability >30% = elevated reversal risk.
   - Contested findings = agents split; Surfaced = consensus.
   Treat the live simulation as ground truth. The user is asking for interpretation, not debugging.
   ```
   Follow with the existing ID / preset / summary / findings format.
5. In [backend-hono/src/services/ai/agent-instructions/index.ts](../../backend-hono/src/services/ai/agent-instructions/index.ts), add a 3-line block to Harper's capabilities: "ArbitrumChamber: when the user is on the ArbitrumChamber surface or shares MiroShark output, interpret the simulation — do not treat it as a debug dump."
6. In `hermes-handler.ts`, add the same `surface === "arbitrumChamber"` gate + `buildArbitrumChamberContext()` injection after the existing context assembly. Share the helper — don't duplicate.
7. Add changelog entry + file-header comment.

## Acceptance Criteria

- [ ] Chatting Harper from the ArbitrumChamber surface with "what do you make of this?" elicits substantive interpretation of IV/heat/regime, not "this looks broken"
- [ ] Backend logs show `"arbitrumChamber context injected"` on every ArbitrumChamber-surface chat request
- [ ] Oracle/Feucht/Consul/Herald chats on ArbitrumChamber surface also receive ArbitrumChamber context
- [ ] Non-ArbitrumChamber surfaces unaffected (no ArbitrumChamber context injection)
- [ ] Changelog entry added

## Validation Commands

```bash
cd backend-hono && bun run build

launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

curl -s -X POST http://localhost:8080/api/harper/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{"message":"interpret the current arbitrumChamber","surface":"arbitrumChamber","activeConnectors":["arbitrumChamber"]}' | head -c 800
```

## Commit Format

```
[v.04.17.1] feat: S23-T3 harper arbitrumChamber literacy
```
