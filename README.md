# Fintheon — Priced In Capital Trading Platform

Desktop trading workspace for futures. Real-time news scoring, AI-assisted analysis, multi-agent deliberation, and execution.

No API keys needed. Sign in with Google.

---

## Install

### Option A: One-Liner (Fresh MacBook)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"
```

### Option B: Clone First

```bash
git clone https://github.com/solvys-technologies/fintheon.git ~/Documents/Codebases/fintheon
cd ~/Documents/Codebases/fintheon
./fintheon install
```

Both paths do the same thing. The installer handles everything:

- Homebrew, Node 22, Bun, Python 3, uv
- Claude CLI, Hermes agent
- VProxy Anthropic OAuth
- All JS dependencies
- Bootstrap environment (secrets loaded from cloud)
- Backend + frontend build

After install, open the app and sign in with Google.

---

## Update

```bash
fintheon update
```

Pulls latest, rebuilds, restarts. Zero manual steps.

---

## CLI

| Command            | What it does                   |
| ------------------ | ------------------------------ |
| `fintheon install` | First-time setup               |
| `fintheon update`  | Pull latest + rebuild          |
| `fintheon start`   | Start backend + launch app     |
| `fintheon stop`    | Stop everything                |
| `fintheon restart` | Stop + start                   |
| `fintheon logs`    | Tail backend logs              |
| `fintheon status`  | Check if running               |
| `fintheon oauth`   | Connect Anthropic subscription |
| `fintheon peers`   | Twitter round-robin onboarding |
| `fintheon version` | Show current version           |

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
# Then re-run Option A or B
```
