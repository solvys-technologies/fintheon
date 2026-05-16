# Sprint Brief: T5 — Multi-Agent Deliberation Engine

## Context

After Herald pushes a compiled brief to the Agent Lounge, other agents (Oracle, Feucht, Consul, Harper) wake up, read the brief, post reflections, engage in reply-threaded conversation, and work toward consensus on narrative proposals. This is the core deliberation layer that transforms raw intelligence into actionable insights. Depends on T4 (Gatherer + Brief Pipeline).

## Branch Target

`sprint/S69`

## Scope — Included

- [ ] `backend-hono/src/services/lounge/deliberation.ts` [NEW] — Multi-agent conversation engine
- [ ] `backend-hono/src/services/lounge/consensus-detector.ts` [NEW] — Consensus detection logic
- [ ] `backend-hono/src/services/lounge/agent-prompt-builder.ts` [NEW] — Agent-specific deliberation prompts
- [ ] `backend-hono/src/routes/lounge/deliberations.ts` [NEW] — Deliberation thread API
- [ ] `backend-hono/src/services/agent-bus/bus.ts` — Add `lounge.reflection` and `lounge.consensus` topics

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/lounge/gatherer.ts` — owned by T4, read-only dependency
- `backend-hono/src/services/lounge/output-router.ts` — owned by T6
- `backend-hono/src/services/hermes/runtime.ts` — leave alone
- `backend-hono/src/services/agents/` — agent definitions, leave alone

## Reuse Inventory

- `backend-hono/src/services/agent-bus/bus.ts` — AgentBus pub/sub for posting reflections
- `backend-hono/src/services/agent-bus/dag-scheduler.ts` — wave-based task execution pattern
- `backend-hono/src/services/agent-bus/multi-stream-merger.ts` — merging concurrent agent streams
- `backend-hono/src/services/hermes/runtime.ts` — agent chat/call pattern
- `backend-hono/src/services/agent-memory/memory-injector.ts` — memory injection for context
- `backend-hono/src/services/ai/agent-factory.ts` — agent instantiation with providers
- `backend-hono/src/services/narrative/cluster-summarizer.ts` — LLM summarization pattern
- `backend-hono/src/shared-beliefs.ts` — shared beliefs injected into agent prompts

## Known Issues to Preserve

- Agents must use their existing SOUL.md identities and scopes
- Oracle: macro/probabilistic analysis scope
- Feucht: futures/technical analysis scope
- Consul: fundamental/statistical analysis scope
- Harper: synthesis and cross-desk coordination scope
- Deliberation should be async — agents post reflections independently
- Reply threading via `replyTo` field on deliberation entries
- Follow Solvys constraints: no emojis, no banned ornaments
- Backend is launchd-managed on port 8080

## Implementation Steps

1. Create `backend-hono/src/services/lounge/agent-prompt-builder.ts`:
   - `buildDeliberationPrompt(agentId, brief, sessionContext)`: generates agent-specific prompt
   - Oracle prompt: "Analyze this brief from a macro/probabilistic perspective. What are the key probabilities? What scenarios are most likely?"
   - Feucht prompt: "Analyze this brief from a futures/technical perspective. What are the key levels? What trades does this suggest?"
   - Consul prompt: "Analyze this brief from a fundamental/statistical perspective. What data supports or contradicts this?"
   - Harper prompt: "Synthesize the deliberation so far. What is the consensus? What should be escalated to humans?"

2. Create `backend-hono/src/services/lounge/deliberation.ts`:
   - `startDeliberation(sessionId)`: triggers after gather cycle completes
   - For each deliberator agent (Oracle, Feucht, Consul):
     1. Build agent-specific prompt from brief
     2. Call agent via Hermes runtime
     3. Post reflection to AgentBus with topic `lounge.reflection`
     4. Store deliberation entry with sessionId, agentId, reflection, timestamp
   - After all agents post, Harper reads all reflections and posts synthesis
   - Reply threading: agents can reference other agents' reflections by ID
   - `postReflection(sessionId, agentId, reflection, replyTo?)`: posts to AgentBus + stores
   - `getDeliberations(sessionId)`: returns all deliberations for a session

3. Create `backend-hono/src/services/lounge/consensus-detector.ts`:
   - `detectConsensus(sessionId)`: analyzes deliberations for agreement
   - Consensus criteria: 3+ agents agree on a narrative direction or risk signal
   - Returns: consensusScore (0-1), agreedTopics, dissentingAgents, recommendation
   - Triggered after Harper's synthesis is posted

4. Create `backend-hono/src/routes/lounge/deliberations.ts`:
   - `POST /api/lounge/deliberations/start?sessionId=...` — Start deliberation phase
   - `GET /api/lounge/deliberations?sessionId=...` — Get deliberation thread
   - `GET /api/lounge/deliberations/consensus?sessionId=...` — Get consensus result
   - `POST /api/lounge/deliberations/reflect` — Agent posts reflection (internal)

5. Wire deliberation into AgentBus flow:
   - T4 pushes `lounge.brief` → surface router triggers `startDeliberation()`
   - Each agent posts `lounge.reflection` → stored and broadcast via SSE
   - After all reflections, `detectConsensus()` posts `lounge.consensus`

6. Add deliberation cron trigger:
   - Schedule: 5 minutes after gather cycle (16:35 ET weekdays)
   - Or trigger automatically via AgentBus event from T4

## Acceptance Criteria

- [ ] Deliberation starts automatically after gather cycle completes
- [ ] Oracle, Feucht, Consul each post reflections to the brief
- [ ] Harper reads reflections and posts synthesis
- [ ] Reply threading works (agents can reference each other's reflections)
- [ ] Consensus detection produces valid consensus scores
- [ ] Deliberations broadcast via SSE to lounge surface
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Start deliberation smoke test
curl -s -X POST http://localhost:8080/api/lounge/deliberations/start?sessionId=test | head -c 500
```

## Commit Format

```
[v6.5.0] feat: S69-T5 multi-agent deliberation engine
```
