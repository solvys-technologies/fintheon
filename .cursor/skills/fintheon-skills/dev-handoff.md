# Fintheon — Developer Handoff & Architecture Overview

> Last updated: 2026-05-12
> Branch: `v.06.12.01`
> Latest release: `v6.0.27`

## What is Fintheon?

Fintheon is the world's first AI-powered Integrated Trading Environment (ITE), built by **Priced In Capital (PIC)** / **Solvys Technologies**. It combines AI agents (Harper CAO, Oracle, Feucht, Consul, Herald) with real-time market data, news analysis (RiskFlow), narrative intelligence (NarrativeFlow), multi-agent deliberation (Arbitrum), and a desktop Electron shell.

---

## Stack Overview

| Layer        | Technology                                                                      |
| ------------ | ------------------------------------------------------------------------------- |
| **Frontend** | React 19 + Vite 6 + Tailwind 4 + TypeScript (strict)                            |
| **Backend**  | Hono (TypeScript, Bun runtime, port 8080)                                       |
| **Desktop**  | Electron (DMG distribution)                                                     |
| **Database** | Supabase Postgres (optional — in-memory fallback)                               |
| **AI**       | Claude Opus 4.6 (via OpenRouter), DeepSeek, Qwen3.5 (via Ollama Cloud)          |
| **Auth**     | Supabase JWT (optional — BYPASS_AUTH for local)                                 |
| **CI/CD**    | GitHub Actions, Fly.io (backend), Vercel (frontend), Electron-builder (desktop) |

---

## Directory Map

```
fintheon/
├── frontend/                        # React 19 + Vite SPA
│   ├── components/                  # ~40 UI component areas
│   │   ├── ui/                      # Base UI primitives
│   │   ├── layout/                  # App shell, header, footer, sidebar
│   │   ├── chat/                    # CAO chat interface + slot renderers
│   │   ├── consilium/               # Main workspace (Consilium)
│   │   ├── narrative/               # Sanctum, NarrativeFlow, catalysts
│   │   ├── apparatus/               # Agent registry panel
│   │   ├── strategium/              # Right rail: mission control, RiskFlow, econ calendar
│   │   ├── mission-control/         # PsychAssist, ER monitor, waveforms
│   │   ├── refinement/              # Refinement Engine (admin controls)
│   │   ├── charts/                  # Recharts wrappers (SolvysLine, etc.)
│   │   ├── journal/                 # Performance tab, charts, KPIs
│   │   ├── arbitrum/                # Arbitrum Chamber UI (verdict cards, seats)
│   │   ├── admin/                   # Admin shell
│   │   ├── auth/                    # Auth flows
│   │   ├── bulletin/                # Bulletin display
│   │   ├── consul-control/          # Consul voice entry point
│   │   └── ... (market, feed, research, settings, etc.)
│   ├── hooks/                       # Custom React hooks
│   ├── contexts/                    # React contexts (thread, auth, etc.)
│   ├── lib/                         # API client, chart tokens, shared utils
│   ├── styles/                      # Global CSS, Tailwind
│   ├── types/                       # TS type declarations
│   ├── public/                      # Static assets (fonts, textures, sounds)
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── backend-hono/                    # Hono API server
│   ├── src/
│   │   ├── routes/                  # 85+ route handlers
│   │   │   ├── index.ts             # Master route registry
│   │   │   ├── harper/              # CAO chat endpoints
│   │   │   ├── voice/               # Voice STT/TTS endpoints
│   │   │   ├── arbitrum/            # Arbitrum deliberation endpoints
│   │   │   ├── data/                # Brief gen (MDB/ADB/PMDB/TWT)
│   │   │   ├── riskflow/            # Scored news feed endpoints
│   │   │   ├── diagnostics/         # Service health check
│   │   │   ├── journal/             # Performance journal endpoints
│   │   │   ├── mcp/                 # MCP server config
│   │   │   ├── agents/              # Agent management
│   │   │   ├── boardroom/           # Boardroom DAG endpoints
│   │   │   └── ... (80+ more)
│   │   ├── services/                # 80+ business logic services
│   │   │   ├── harper-handler.ts    # Harper CAO chat handler
│   │   │   ├── arbitrum/            # 5-seat deliberation engine
│   │   │   ├── riskflow/            # RiskFlow scoring engine
│   │   │   ├── brief-generator.ts   # Brief generation (MDB/ADB/PMDB/TWT)
│   │   │   ├── voice-*.ts           # Voice service stack
│   │   │   ├── ai/                  # AI agent instructions, prompts
│   │   │   ├── psych-assist/        # Trader tilt detection
│   │   │   ├── hermes/              # Hermes agent router
│   │   │   ├── agent-*/             # Agent dispatch, memory, desk
│   │   │   ├── browser/             # Playwright browser pool
│   │   │   ├── supabase-service.ts  # DB client
│   │   │   └── ... (70+ more)
│   │   ├── boot/services.ts         # Service initialization
│   │   ├── middleware/              # Auth, logging middleware
│   │   ├── lib/                     # Logger, config, utilities
│   │   └── types/                   # Shared backend types
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile                   # Fly.io deploy
│   └── fly.toml                     # Fly.io config (app: fintheon)
│
├── electron/                        # Desktop shell
│   ├── main.cjs                     # Electron main process
│   ├── preload.cjs                  # Preload script
│   ├── icons/                       # App icons
│   └── services/                    # Electron-specific services
│
├── sprint-md/                       # Sprint briefs & ORCH plan files
├── sprint-changelog/                # Sprint changelogs
├── docs/                            # Documentation
├── scripts/                         # Install/update scripts
├── skills/                          # PIC agent skills (Harper, Oracle, etc.)
├── mobile/                          # Mobile surfaces (minimal)
│
├── package.json                     # Root monorepo scripts
├── tsconfig.json                    # Root TS config
├── vite.config.ts                   # Root Vite config → frontend/
├── vercel.json                      # Frontend Vercel deploy
├── .cursorrules                     # AI agent rules
└── .mcp.json                        # MCP server configs
```

---

## Key API Endpoints

| Method | Endpoint                        | Purpose                              |
| ------ | ------------------------------- | ------------------------------------ |
| POST   | `/api/harper/chat`              | Harper CAO chat                      |
| GET    | `/api/riskflow/feed`            | Scored news feed                     |
| GET    | `/api/riskflow/iv-aggregate`    | IV score with VIX                    |
| POST   | `/api/data/brief/generate`      | Trigger brief gen (MDB/ADB/PMDB/TWT) |
| GET    | `/api/data/brief/latest?type=X` | Fetch latest brief                   |
| POST   | `/api/arbitrum/deliberate`      | Fire chamber deliberation            |
| GET    | `/api/arbitrum/latest`          | Latest Arbitrum verdict              |
| GET    | `/api/arbitrum/verdicts/:id`    | Specific verdict                     |
| GET    | `/api/diagnostics`              | Service health check                 |
| GET    | `/api/journal/entries`          | Journal entries                      |
| GET    | `/api/journal/summary`          | Journal summary                      |
| POST   | `/api/voice/transcribe`         | Voice STT                            |
| GET    | `/api/mcp`                      | MCP server config list               |

---

## Agent System (Personas)

| Agent      | Role                                             |
| ---------- | ------------------------------------------------ |
| **Harper** | CAO — executive synthesis, orchestrates agents   |
| **Oracle** | Prediction markets, probabilistic reasoning      |
| **Feucht** | Futures/risk, technical levels, execution        |
| **Consul** | Mega-cap fundamentals, earnings, sector rotation |
| **Herald** | Breaking news, social sentiment, headline risk   |

Agents route through **Hermes** (Claude-native agent-router) or **Arbitrum** (5-seat Qwen deliberation engine).

---

## Build & Run

```bash
# Frontend type-check
npx tsc --noEmit --project frontend/tsconfig.json

# Frontend build
cd frontend && bun run build

# Backend type-check
cd backend-hono && bun run build

# Backend local (launchd-managed)
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Test backend
curl -s http://localhost:8080/api/diagnostics

# Backend deploy
cd backend-hono && fly deploy --yes

# Desktop DMG
cd fintheon && bun run desktop:build
```

---

## Design Language (Solvys Industrial-Luxe)

- **Background**: `#050402` (warm near-black)
- **Accent**: `#c79f4a` (Solvys Gold)
- **Text**: `#f0ead6` (warm off-white)
- **Surfaces**: Frosted-glass (translucent dark fill, subtle backdrop blur, thin low-opacity gold border)
- **No**: Gradients, emojis, AI sparkles, Kanban side-stripe borders, generic shadows

---

## What NOT to Break

Always validate these after any change:

1. **Backend build**: `cd backend-hono && bun run build`
2. **Frontend build**: `cd frontend && bun run build` (or `npx vite build` from root)
3. **TS strict mode**: `npx tsc --noEmit --project frontend/tsconfig.json`
4. **Harper chat**: `POST /api/harper/chat` returns 200
5. **Arbitrum deliberation**: `POST /api/arbitrum/deliberate` runs without error
6. **RiskFlow feed**: `GET /api/riskflow/feed` returns scored items
7. **Diagnostics**: `GET /api/diagnostics` reports all services healthy
8. **Auth bypass**: local/Electron works without credentials (`BYPASS_AUTH=true`)
9. **Optional integrations**: All services degrade gracefully when env vars are missing
10. **Changelog**: Every feature/fix gets an entry in `src/lib/changelog.ts`

---

## File Size Rule

Every source file must be < 300 lines. If you find one over, split it into focused modules.

---

## Git Workflow

- **Branch format**: `v.{MONTH}.{DATE}.{PATCH}` (e.g., `v.06.12.01`)
- **Commit format**: `[v.X.Y.Z] type: Description`
- **PR checklist**: TypeScript strict, no `any`, no console.log in routes, changelog entry
