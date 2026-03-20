# Fintheon — Priced In Capital Trading Platform

Fintheon is an Electron desktop app for the PIC trading desk. It combines real-time market data, AI-assisted analysis, risk management, and team coordination into a single interface.

## Quick Start

### Prerequisites

- **Node.js** 20+ and **Bun** (package manager)
- **Git** access to `solvys-technologies/fintheon`
- macOS (Electron builds target Darwin)

### 1. Clone and Install

```bash
git clone https://github.com/solvys-technologies/fintheon.git
cd fintheon
bun install
cd backend-hono && bun install && cd ..
```

### 2. Backend Environment

Copy the example env and fill in your credentials:

```bash
cp backend-hono/.env.example backend-hono/.env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | OpenRouter API key (Nous subscription — Claude Opus 4.6) |
| `OPENAI_API_KEY` | OpenAI key for Voice Engine (Whisper + TTS) |
| `DATABASE_URL` | PostgreSQL connection string (optional — in-memory fallback for dev) |

Optional variables:

| Variable | Description |
|----------|-------------|
| `FMP_API_KEY` | Financial Modeling Prep API key |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth for Models |
| `CLERK_SECRET_KEY` | Clerk auth (backend) |

### 3. Frontend Environment

```bash
cp frontend-vercel.env.example frontend/.env.local
```

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (frontend auth) |
| `VITE_API_URL` | Backend API URL (default: `http://localhost:8080`) |

### 4. Run Development

```bash
# Terminal 1: Backend
cd backend-hono && bun run dev

# Terminal 2: Frontend
cd frontend && bun run dev

# Terminal 3 (optional): Electron shell
bun run desktop:dev
```

### 5. Build and Deploy DMG

```bash
bun run desktop:build
cp desktop-dist/Fintheon-1.0.0.dmg ~/Desktop/Fintheon-1.0.0.dmg
```

## Architecture

```
fintheon/
  backend-hono/       # Hono API server (port 8080)
    src/
      routes/         # API endpoints
      services/       # Business logic (RiskFlow, IV scoring, etc.)
      db/             # PostgreSQL queries
  frontend/           # React 19 + Tailwind 4 + Vite
    components/       # UI components
    contexts/         # React contexts (RiskFlow, Settings, ER, etc.)
    hooks/            # Custom hooks
    lib/              # Services, utilities, types
  electron/           # Electron main process
    main.cjs          # Window management + backend auto-start
  docs/               # Internal documentation
```

### Key Systems

| System | Description |
|--------|-------------|
| **RiskFlow** | Real-time news/event feed with IV scoring |
| **IV Scorer** | Blended 60% VIX + 40% headlines composite score |
| **Economic Calendar** | TradingView embedded calendar with filters |
| **Trading Journal** | Human psych + agent performance tracking |
| **NarrativeFlow** | Market narrative tracking with catalyst cards |
| **Board Room** | Multi-agent boardroom sessions |
| **Research Dept** | AI research assistant |
| **PsychAssist** | Emotional resonance monitoring + interventions |

### Per-User Resources

- **Hermes** — Local `~/.hermes/` config and memory
- **localStorage** — UI preferences, widget order, collapsed states
- **Journal entries** — Stored per `userId` (falls back to `local-user` without auth)

## Team Onboarding

1. Clone repo and install dependencies
2. Get backend `.env` credentials from team lead
3. Open Fintheon — the first-time setup guide will verify connections
4. Start trading

## Updating

Pull latest and rebuild:

```bash
git pull origin main
bun install
cd backend-hono && bun install && cd ..
bun run desktop:build
cp desktop-dist/Fintheon-1.0.0.dmg ~/Desktop/Fintheon-1.0.0.dmg
```
