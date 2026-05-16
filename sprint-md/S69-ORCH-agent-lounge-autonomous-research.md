# S69-ORCH — Agent Lounge: Autonomous Research & Deliberation Loop

- **Parent sprint branch**: `sprint/S69`
- **Cycle**: Cycle 8 (Closed Beta)
- **Due**: July 4
- **Owner**: Shashank

## What this covers

Transforms the Agent Lounge from a synthetic dream placeholder into a real autonomous research and deliberation system. Agents wake on a schedule, gather external intelligence (YouTube transcripts, X posts with chart images), deliberate amongst themselves, form new narrative proposals and risk signals, and only surface to humans when research corroborates with live headlines. Everything else stays in the lounge for agent-to-agent deliberation. Reports are autonomously generated and stored in the fileroom.

## Why now

S61-S68 shipped governance, lockout, desk plan, chat overhaul, UI polish, and NarrativeFlow theme intelligence. The agent layer is now mature enough to handle autonomous research. Currently the lounge shows synthetic placeholder dreams with no real ingestion, no inter-agent conversation, and no output beyond the dream feed. This turns the lounge into a productive after-hours research cell.

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│                    WAKE CYCLE (cron-triggered)               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. HERALD wakes first (gatherer)                           │
│     ├── Search for new free LLM models for Hermes            │
│     ├── Pull YouTube transcripts (Bloomberg, Bravos, Max)    │
│     ├── Scrape X posts (@infraa, @monetaryguy589,           │
│     │   @macroedgeres) + extract chart images                │
│     ├── Digest materials into structured brief               │
│     └── Push brief to Agent Lounge via AgentBus              │
│                                                              │
│  2. AGENTS wake (deliberators)                              │
│     ├── Oracle: macro/probabilistic analysis                 │
│     ├── Feucht: futures/technical implications               │
│     ├── Consul: fundamental/statistical analysis             │
│     └── Harper: synthesis + cross-desk coordination          │
│                                                              │
│  3. DELIBERATION (multi-agent conversation)                  │
│     ├── Agents read lounge brief, post reflections           │
│     ├── Reply-threaded conversation via AgentBus             │
│     └── Consensus detection on narrative proposals           │
│                                                              │
│  4. OUTPUT ROUTING                                           │
│     ├── IF research + live headline match → push to humans   │
│     │   └── Narrative proposal or RiskSignal via SSE         │
│     ├── ELSE → store in Agent Lounge for further deliberation│
│     └── Generate report → store in fileroom (documents API)  │
│                                                              │
│  5. SLEEP                                                    │
│     └── Agents update desk-facing framework, go dormant      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Codebase map

### New services (backend)

- `backend-hono/src/services/lounge/` — Agent Lounge orchestrator
- `backend-hono/src/services/lounge/gatherer.ts` — Herald's gathering logic
- `backend-hono/src/services/lounge/deliberation.ts` — Multi-agent conversation engine
- `backend-hono/src/services/lounge/output-router.ts` — Headline matching + routing logic
- `backend-hono/src/services/lounge/report-generator.ts` — Fileroom report generation
- `backend-hono/src/services/lounge/model-scout.ts` — Free LLM model discovery
- `backend-hono/src/services/youtube-transcripts/` — YouTube transcript ingestion
- `backend-hono/src/services/x-monitor/` — X/Twitter account monitoring with image extraction

### New routes (backend)

- `backend-hono/src/routes/lounge/` — Lounge API endpoints
- `backend-hono/src/routes/lounge/sessions.ts` — Session management
- `backend-hono/src/routes/lounge/briefs.ts` — Brief CRUD
- `backend-hono/src/routes/lounge/deliberations.ts` — Deliberation thread API

### Modified services (backend)

- `backend-hono/src/services/agent-bus/` — Add lounge topics (`lounge.brief`, `lounge.reflection`, `lounge.consensus`)
- `backend-hono/src/services/cron/` — Add lounge wake cycle cron jobs
- `backend-hono/src/services/hermes/runtime.ts` — Support new free model providers
- `backend-hono/src/services/documents/` — Fileroom report storage

### Modified frontend

- `frontend/components/lounge/AgentLounge.tsx` — Replace dream feed with real deliberation threads
- `frontend/components/lounge/LoungeSession.tsx` [NEW] — Session view
- `frontend/components/lounge/LoungeBrief.tsx` [NEW] — Gathered materials display
- `frontend/components/lounge/DeliberationThread.tsx` [NEW] — Agent conversation thread
- `frontend/hooks/useLounge.ts` [NEW] — Lounge SSE hook

### Database (Supabase)

- `lounge_sessions` — Session records (id, started_at, ended_at, gatherer_agent, status)
- `lounge_briefs` — Gathered materials (id, session_id, source, content, extracted_at)
- `lounge_deliberations` — Agent reflections (id, session_id, agent_id, reflection, timestamp, reply_to)
- `lounge_proposals` — Narrative/risk signal proposals (id, session_id, type, content, consensus_score, routed_to)
- `lounge_reports` — Generated reports (id, session_id, report_content, stored_at)

## Child tickets

### SOL-126 — S69-T1: YouTube Transcript Ingestion Service (5 pts, High)

Branch: `sprint/S69`

Build a service that pulls transcripts from specific YouTube channels: Bloomberg Originals, Bravos Research, Maxinomics. Uses free YouTube transcript APIs or scraping. Returns structured text with timestamps.

### SOL-125 — S69-T2: X Account Monitor with Chart Image Extraction (8 pts, Critical)

Branch: `sprint/S69`

Monitor @infraa, @monetaryguy589, @macroedgeres on X. Pull posts since last check. Extract and analyze chart images (OCR or vision model). Return structured post data with image analysis.

### SOL-124 — S69-T3: Free LLM Model Scout for Hermes (3 pts, Medium)

Branch: `sprint/S69`

Search for new free-to-use LLM models that can be added to Hermes for promotional use. Check HuggingFace, GitHub, provider APIs. Return model cards with licensing, capabilities, and compatibility assessment.

### SOL-123 — S69-T4: Lounge Gatherer + Brief Pipeline (8 pts, Critical)

Branch: `sprint/S69`

Herald's wake-cycle logic: orchestrates T1+T2+T3, digests materials into a structured brief, pushes to Agent Lounge via AgentBus. Depends on T1, T2, T3 being complete.

### SOL-122 — S69-T5: Multi-Agent Deliberation Engine (8 pts, Critical)

Branch: `sprint/S69`

Agents wake, read lounge brief, post reflections, engage in reply-threaded conversation. Consensus detection on narrative proposals. Depends on T4.

### SOL-121 — S69-T6: Output Router + Headline Correlation (5 pts, High)

Branch: `sprint/S69`

Route deliberation output: if research + live headline match → push to humans via SSE/narrative; else → store in lounge. Generate reports for fileroom. Depends on T5.

### SOL-127 — S69-T7: Lounge Frontend Overhaul (5 pts, High)

Branch: `sprint/S69`

Replace synthetic dream feed with real deliberation threads, session views, brief display, agent presence indicators. Depends on T4+T5+T6 API being live.

## Execution order (wave sequence)

### Wave 1: Data ingestion (parallel)

```
SOL-126 — S69-T1: YouTube Transcript Ingestion
SOL-125 — S69-T2: X Account Monitor + Chart Extraction
SOL-124 — S69-T3: Free LLM Model Scout
```

T1, T2, T3 have zero file overlap. All are independent data sources.

### Wave 2: Gatherer pipeline (after T1+T2+T3)

```
SOL-123 — S69-T4: Lounge Gatherer + Brief Pipeline
```

T4 consumes T1 (transcripts), T2 (X posts), T3 (model scout) into a unified brief.

### Wave 3: Deliberation (after T4)

```
SOL-122 — S69-T5: Multi-Agent Deliberation Engine
```

T5 consumes T4's briefs and runs multi-agent conversation.

### Wave 4: Output routing (after T5)

```
SOL-121 — S69-T6: Output Router + Headline Correlation
```

T6 consumes T5's deliberation output and routes to humans or lounge.

### Wave 5: Frontend (after T4+T5+T6 API)

```
SOL-127 — S69-T7: Lounge Frontend Overhaul
```

T7 builds the UI on top of all backend APIs.

## Validation

- [ ] YouTube transcripts pulled from all 3 channels successfully
- [ ] X posts monitored with chart image extraction working
- [ ] Free model scout returns valid model assessments
- [ ] Herald gatherer produces structured briefs on schedule
- [ ] Multi-agent deliberation produces threaded conversations
- [ ] Output router correctly matches research to live headlines
- [ ] Reports generated and stored in fileroom
- [ ] Frontend shows real deliberation threads (not synthetic dreams)
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] Changelog entry added to `src/lib/changelog.ts`

## Linear Issues

| Issue | Title | Points |
| ----- | ----- | ------ |
| SOL-128 | S69-ORCH: Agent Lounge Autonomous Research & Deliberation | — |
| SOL-126 | S69-T1: YouTube Transcript Ingestion Service | 5 |
| SOL-125 | S69-T2: X Account Monitor with Chart Image Extraction | 8 |
| SOL-124 | S69-T3: Free LLM Model Scout for Hermes | 3 |
| SOL-123 | S69-T4: Lounge Gatherer + Brief Pipeline | 8 |
| SOL-122 | S69-T5: Multi-Agent Deliberation Engine | 8 |
| SOL-121 | S69-T6: Output Router + Headline Correlation | 5 |
| SOL-127 | S69-T7: Lounge Frontend Overhaul | 5 |
