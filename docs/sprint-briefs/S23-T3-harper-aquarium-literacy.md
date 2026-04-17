# Sprint Brief: S23-T3 — Harper Aquarium Literacy

## Context

In a live Aquarium session, Harper responded to a MiroShark report with: "It looks like you've shared simulation output from some kind of market volatility/regime analysis system… a data pipeline is broken." She treats her own platform surface as unknown debug output. Root cause: `buildAquariumContext()` at [backend-hono/src/services/harper-handler.ts:282-293](../../backend-hono/src/services/harper-handler.ts#L282-L293) only fires when `activeConnectors.includes("aquarium")`, and the frontend never sets that connector when the user is on the Aquarium surface. Even when it fires, the context lacks the "how to read this" scaffold an agent needs to interpret IV / heat / regime-shift output. The Hermes CAOs (Oracle/Feucht/Consul/Herald) have the same gap.

## Branch Target

`s20-agent-swarm-platform-ops`

## Scope — Included

- [ ] Frontend: when the active CONSILIUM surface is Aquarium (Sanctum Page 0), append `"aquarium"` to `activeConnectors` on every `/api/harper/chat` and `/api/hermes/chat` POST. Also add a top-level `surface: "aquarium"` flag in the request body so backend can gate on surface directly.
- [ ] Backend: enhance `buildAquariumContext()` output to prepend a **"How to read this"** preamble — explain the IV score scale (0–10, heat bands), regime-shift interpretation, the meaning of Contested / Surfaced findings, and the Market Heat / Regime Risk / Signal Strength KPIs.
- [ ] Backend: auto-inject Aquarium context whenever `surface === "aquarium"` or `activeConnectors.includes("aquarium")` — either path triggers it.
- [ ] Prompt update in [backend-hono/src/services/ai/agent-instructions/index.ts](../../backend-hono/src/services/ai/agent-instructions/index.ts): add an Aquarium section to Harper's capabilities block instructing her to interpret MiroShark output as ground-truth live simulation rather than debug signal.
- [ ] Extend the same automatic context injection into [backend-hono/src/services/hermes-handler.ts](../../backend-hono/src/services/hermes-handler.ts) so Oracle/Feucht/Consul/Herald also get Aquarium awareness.

## Scope — Excluded (DO NOT TOUCH)

- Aquarium UI/layout — T1
- Deliberation polling — T2
- `agent_context_bank` wiring, `traderName` injection, `[MEMORY]` tag parsing — T4

## Known Issues to Preserve

- `buildFeedContext()` is the RiskFlow feed injection; leave its behavior alone.
- `activeConnectors` is also consumed by non-Aquarium integrations — only append, never replace.

## Implementation Steps

1. Grep for `/api/harper/chat` POST call site(s) in `frontend/`. Typical: `frontend/lib/harperClient.ts` or `frontend/hooks/useHarperChat.ts`. Wire a `useCurrentSurface()` read (or the existing Sanctum page identifier) and append `"aquarium"` to the connector array when on Page 0. Same for Hermes chat send sites.
2. Add `surface?: "aquarium" | "dashboard" | "sanctum" | ...` field to both chat request bodies. Backend already accepts `surface` on the Harper route — confirm and extend.
3. In `harper-handler.ts`, change the gate on `buildAquariumContext()` from `activeConnectors?.includes("aquarium")` to `activeConnectors?.includes("aquarium") || body.surface === "aquarium"`.
4. In `buildAquariumContext()` output, prepend:
   ```
   --- AQUARIUM CONTEXT ---
   How to read this:
   - IV Score 0–10 composite: 0–2 Calm Seas, 2–4 Light Winds, 4–6 Gathering Storm, 6–8 Tipping Point, 8–10 Shit Show.
   - Market Heat / Regime Risk / Signal Strength are 0–10 KPIs.
   - Regime shift probability >30% = elevated reversal risk.
   - Contested findings = agents split; Surfaced = consensus.
   Treat the live simulation as ground truth. The user is asking for interpretation, not debugging.
   ```
   Follow with the existing ID / preset / summary / findings format.
5. In [backend-hono/src/services/ai/agent-instructions/index.ts](../../backend-hono/src/services/ai/agent-instructions/index.ts), add a 3-line block to Harper's capabilities: "Aquarium: when the user is on the Aquarium surface or shares MiroShark output, interpret the simulation — do not treat it as a debug dump."
6. In `hermes-handler.ts`, add the same `surface === "aquarium"` gate + `buildAquariumContext()` injection after the existing context assembly. Share the helper — don't duplicate.
7. Add changelog entry + file-header comment.

## Acceptance Criteria

- [ ] Chatting Harper from the Aquarium surface with "what do you make of this?" elicits substantive interpretation of IV/heat/regime, not "this looks broken"
- [ ] Backend logs show `"aquarium context injected"` on every Aquarium-surface chat request
- [ ] Oracle/Feucht/Consul/Herald chats on Aquarium surface also receive Aquarium context
- [ ] Non-Aquarium surfaces unaffected (no Aquarium context injection)
- [ ] Changelog entry added

## Validation Commands

```bash
cd backend-hono && bun run build

launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

curl -s -X POST http://localhost:8080/api/harper/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt>" \
  -d '{"message":"interpret the current aquarium","surface":"aquarium","activeConnectors":["aquarium"]}' | head -c 800
```

## Commit Format

```
[v.04.17.1] feat: S23-T3 harper aquarium literacy
```
