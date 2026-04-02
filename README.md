# Fintheon — Priced In Capital Trading Platform

Fintheon is a desktop trading workspace for the PIC trading desk. It combines real-time market data, AI-assisted analysis, risk management, and team coordination into a single Electron app with a locally hosted backend.

---

## One-Line Install (Fresh MacBook)

Open Terminal and paste this single command. It handles everything — Xcode, Homebrew, Node, Bun, cloning, building, and launching:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"
```

**What it installs:**
1. Xcode Command Line Tools (provides `git`)
2. Homebrew (macOS package manager)
3. Node.js 22 LTS + Bun (runtime + package manager)
4. Fintheon repository (cloned to `~/Documents/Codebases/fintheon`)
5. All dependencies (root + frontend + backend)
6. Production environment with Supabase connection
7. Hermes agent (local AI backend for analysts)
8. `fintheon` CLI command (global terminal access)
9. Desktop app (DMG built and installed to /Applications)

After setup, the app opens automatically. No manual configuration needed.

---

## Prerequisites (Handled by Setup Script)

If you prefer to install manually:

| Tool | Purpose | Install |
|------|---------|---------|
| Xcode CLI Tools | Provides `git`, compilers | `xcode-select --install` |
| Homebrew | Package manager | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| Node.js 22+ | JavaScript runtime | `brew install node@22` |
| Bun | Fast package manager | `curl -fsSL https://bun.sh/install \| bash` |

---

## Updating

Open any terminal and run:

```bash
fintheon update
```

This pulls the latest code, installs new dependencies, rebuilds everything, reinstalls the desktop app, and restarts the backend. Zero manual steps.

---

## CLI Reference

After installation, the `fintheon` command is available globally in any terminal:

| Command | What it does |
|---------|--------------|
| `fintheon update` | Pull latest, rebuild, restart |
| `fintheon start` | Start backend + launch app |
| `fintheon stop` | Stop everything |
| `fintheon status` | Check if services are running |
| `fintheon logs` | Tail backend logs |
| `fintheon setup` | Re-run first-time setup |
| `fintheon version` | Show current version |

---

## Manual Setup (Alternative)

If you prefer step-by-step manual setup:

### 1. Clone and Install

```bash
git clone https://github.com/solvys-technologies/fintheon.git
cd fintheon
bun install
cd backend-hono && bun install && cd ..
```

### 2. Environment

The setup script auto-generates `backend-hono/.env` with production defaults. If setting up manually:

```bash
cp backend-hono/.env.example backend-hono/.env
```

The app works out of the box with only defaults. For AI features, add your OpenRouter key:

| Variable | Required? | Description |
|----------|-----------|-------------|
| `OPENROUTER_API_KEY` | For AI | Get at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) |
| `OPENAI_API_KEY` | Optional | Voice features only (Whisper + TTS) |

Everything else (Supabase, scheduling, ports) has production defaults pre-configured.

### 3. Run Development

```bash
# Terminal 1: Backend
cd backend-hono && bun run dev

# Terminal 2: Frontend
cd frontend && bun run dev

# Terminal 3 (optional): Electron shell
bun run desktop:dev
```

### 4. Build DMG

```bash
bun run release
# Output: desktop-dist/Fintheon-1.0.0-arm64.dmg
```

---

## Architecture

```
fintheon/
  backend-hono/       # Hono API server (port 8080)
    src/
      routes/         # API endpoints
      services/       # Business logic (RiskFlow, IV scoring, agents)
      db/             # PostgreSQL queries (Neon/Supabase)
      config/         # Environment, database, auth config
  frontend/           # React 19 + Tailwind 4 + Vite
    components/       # UI components
    contexts/         # React contexts (RiskFlow, Settings, etc.)
    hooks/            # Custom hooks
    lib/              # Services, utilities, types
  electron/           # Electron main process
    main.cjs          # Window management + backend auto-start
  scripts/            # CLI tools (setup, update, build)
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

### Agent Roster (Hermes)

| Agent | Role |
|-------|------|
| **Harper** | Chief Analyst Officer — daily briefings, strategy |
| **Oracle** | All-Seer — cross-domain pattern recognition |
| **Feucht** | Futures and Risk — position sizing, VaR |
| **Consul** | Fundamentals — macro, earnings, sectors |
| **Herald** | News — real-time news triage, signal/noise |

---

## Environment Variables

### Backend (`backend-hono/.env`)

The `.env.example` file includes production defaults. Only `OPENROUTER_API_KEY` needs user input.

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Backend server port |
| `BYPASS_AUTH` | `true` | Skip auth for local/Electron use |
| `SUPABASE_URL` | Pre-configured | Supabase project URL |
| `SUPABASE_ANON_KEY` | Pre-configured | Supabase anon key (publishable) |
| `OPENROUTER_API_KEY` | — | Your OpenRouter key for AI |
| `AI_PRIMARY_PROVIDER` | `openrouter` | AI inference provider |

### Frontend

Frontend env is auto-generated. No manual config needed.

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend URL |
| `VITE_SUPABASE_URL` | Pre-configured | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Pre-configured | Supabase publishable key |

---

## Troubleshooting

### Backend won't start
```bash
tail -f /tmp/fintheon-backend.log    # Check logs
fintheon stop && fintheon start       # Restart
```

### Port 8080 occupied
```bash
lsof -ti:8080 | xargs kill -9        # Kill whatever's on 8080
fintheon start
```

### DMG won't open (macOS security)
```bash
xattr -cr /Applications/Fintheon.app
open /Applications/Fintheon.app
```

### AI features not working
1. Check `OPENROUTER_API_KEY` is set in `backend-hono/.env`
2. Verify at [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
3. Restart: `fintheon stop && fintheon start`

### Nuclear option (full re-setup)
```bash
rm -rf ~/Documents/Codebases/fintheon
fintheon setup
```

---

## Deployment

| Target | How |
|--------|-----|
| **Frontend** | Vercel (`vercel --prod`) |
| **Backend** | Fly.io (`fly deploy`) |
| **Desktop** | `bun run release` → upload DMG to GitHub Releases |
