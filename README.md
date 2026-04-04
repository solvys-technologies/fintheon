# Fintheon — Priced In Capital Trading Platform

Fintheon is a desktop trading workspace for futures traders. Real-time news scoring, AI-assisted analysis, multi-agent deliberation, and execution — in a single Electron app.

No API keys needed. Sign in with Google.

---

## Install

### Option A: One-Liner (Fresh MacBook)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"
```

Installs Xcode CLI Tools, Homebrew, Node 22, Bun, clones the repo to `~/Documents/Codebases/fintheon`, builds everything, and starts.

### Option B: Clone First, Then Install

```bash
git clone https://github.com/solvys-technologies/fintheon.git ~/Documents/Codebases/fintheon
cd ~/Documents/Codebases/fintheon
./fintheon install
```

Both paths produce the same result. The setup script creates `Codebases/` and `fintheon/` inside `~/Documents/` if they don't exist.

---

## CLI

After install, `fintheon` is available globally:

| Command | What it does |
|---------|--------------|
| `fintheon install` | First-time setup |
| `fintheon update` | Pull latest, rebuild, restart |
| `fintheon start` | Start backend + launch app |
| `fintheon stop` | Stop everything |
| `fintheon restart` | Stop + start |
| `fintheon logs` | Tail backend logs |
| `fintheon status` | Check if running |
| `fintheon version` | Show current version |

---

## How It Works

1. **Setup** creates a minimal `.env` with the shared Postgres connection (no secrets).
2. **On boot**, the backend's secrets vault loads all API keys from the cloud database automatically.
3. **You sign in** with Google OAuth. That's your identity across all devices.
4. **No .env copying** between machines. Clone, install, sign in — done.

---

## Development

```bash
# Backend (Terminal 1)
cd backend-hono && bun run dev

# Frontend (Terminal 2)
cd frontend && bun run dev

# Electron shell (Terminal 3, optional)
bun run desktop:dev
```

### Build DMG

```bash
bun run release
# Output: desktop-dist/Fintheon-*.dmg
```

---

## Update

```bash
fintheon update
```

Pulls latest, installs deps, rebuilds, reinstalls the desktop app, restarts the backend.

---

## Architecture

```
fintheon/
  backend-hono/       Hono API server (:8080)
    src/
      boot/           Env validation + secrets vault + service boot
      routes/         API endpoints
      services/       RiskFlow, IV scoring, agents, pollers
      config/         Supabase, database, secrets vault
  frontend/           React 19 + Tailwind 4 + Vite
  electron/           Electron main process
  scripts/            Setup, update, build scripts
  fintheon            CLI entry point (repo-level)
```

### Key Systems

| System | Description |
|--------|-------------|
| **RiskFlow** | Real-time news feed with IV scoring + macro levels |
| **NarrativeFlow** | Market narrative tracking with catalyst cards |
| **Sanctum** | Economic intelligence + thesis management |
| **MiroShark** | Multi-agent deliberation (analysts + officials) |
| **Board Room** | Agent coordination + daily briefings |
| **Autopilot** | Trade proposal + execution bridge |

---

## Troubleshooting

```bash
# Backend won't start
tail -f /tmp/fintheon-backend.log
fintheon restart

# Port 8080 stuck
lsof -ti:8080 | xargs kill -9
fintheon start

# macOS blocks the app
xattr -cr /Applications/Fintheon.app

# Full reset
rm -rf ~/Documents/Codebases/fintheon
# Then re-run the install one-liner
```
