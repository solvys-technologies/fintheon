# Pulse — Priced In Capital Trading Platform

Pulse is an Electron desktop app for the PIC trading desk. It combines real-time market data, AI-assisted analysis, risk management, and team coordination into a single interface.

## Quick Start

### Prerequisites

- **Node.js** 20+ and **Bun** (package manager)
- **Git** access to `solvys-technologies/pulse`
- macOS (Electron builds target Darwin)

### 1. Clone and Install

```bash
git clone https://github.com/solvys-technologies/pulse.git
cd pulse
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
| `OPENCLAW_BASE_URL` | OpenClaw gateway URL (default: `http://localhost:7787`) |
| `OPENCLAW_API_KEY` | Your OpenClaw API key |
| `DATABASE_URL` | PostgreSQL connection string (optional — in-memory fallback for dev) |
| `NOTION_API_KEY` | Notion integration token (shared across team) |

Optional variables:

| Variable | Description |
|----------|-------------|
| `X_API_BEARER_TOKEN` | X/Twitter API bearer token |
| `FMP_API_KEY` | Financial Modeling Prep API key |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth for Models |

### 3. X CLI Setup (per user)

Each team member needs their own X CLI login for RiskFlow social feeds:

```bash
pip install twitter-cli  # or: pipx install twitter-cli
twitter login            # Opens browser for OAuth — logs into YOUR X account
twitter search "test" --json  # Verify it works
```

The backend auto-detects twitter-cli at `~/.local/bin/twitter`.

### 4. OpenClaw Setup (per user)

Each user has their own OpenClaw config at `~/.openclaw/`. Memory and conversation history are local to each user — the OpenClaw gateway is shared.

### 5. Run Development

```bash
# Terminal 1: Backend
cd backend-hono && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3 (optional): Electron shell
npm run desktop:dev
```

### 6. Build and Deploy DMG

```bash
npm run desktop:build
cp desktop-dist/Pulse-1.0.0.dmg ~/Desktop/Pulse-1.0.0.dmg
```

## Architecture

```
pulse/
  backend-hono/       # Hono API server (port 8080)
    src/
      routes/         # API endpoints
      services/       # Business logic (Notion, RiskFlow, IV scoring, etc.)
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
| **Research Dept** | Notion iframe + AI research assistant |
| **PsychAssist** | Emotional resonance monitoring + interventions |

### Shared Resources (All Team Members)

- **Notion databases** — Trade Ideas, Daily P&L, Economic Events, Econ Prints (shared org token)
- **Board Room** — Same boardroom sessions visible to all
- **Research Department** — Same Notion research corpus (each user logs into Notion iframe separately)

### Per-User Resources

- **X CLI** — Each user's own Twitter/X login
- **OpenClaw** — Local `~/.openclaw/` config and memory
- **localStorage** — UI preferences, widget order, collapsed states
- **Journal entries** — Stored per `userId` (falls back to `local-user` without auth)

## Team Onboarding

1. Clone repo and install dependencies
2. Get backend `.env` credentials from team lead (Notion key is shared)
3. Run `twitter login` to connect your X account
4. Open Pulse — the first-time tour will guide you through the interface
5. Log into Notion when prompted in the Research Department iframe
6. Start trading

## Updating

Pull latest and rebuild:

```bash
git pull origin main
bun install
cd backend-hono && bun install && cd ..
npm run desktop:build
cp desktop-dist/Pulse-1.0.0.dmg ~/Desktop/Pulse-1.0.0.dmg
```

Or use the `/update-pulse` skill in OpenClaw chat.
