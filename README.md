# Fintheon — Priced In Capital Trading Platform

Desktop trading workspace for futures. Real-time news scoring, AI-assisted analysis, multi-agent deliberation, and execution.

No API keys needed. Sign in with Google.

---

## Agent Handoff: Install v7.0.5 Desktop Build

Copy this prompt to a local agent when the user needs the current desktop build
installed from this repo:

```text
You are installing the current Fintheon desktop build for the user.

Repo: /Users/tifos/Documents/Codebases/fintheon
Branch: v7.0.5
Version: 7.0.5
DMG: /Users/tifos/Desktop/Fintheon-7.0.5-arm64.dmg
Expected SHA256: 100a874059c40834c3afae7d4fab84ee847952ff93544af1d246bb2f60a50bf6

Release contents to preserve:
- Arbitrum manual-run presets/history fixes.
- Desk Plan PIC Forecast value-only row fix.
- System Blocker Gate fix: the app bundle must include
  Contents/Library/LaunchServices/io.pricedinresearch.fintheon.blocker-helper.
- Briefing window fixes: daily briefs stay readable until next-day 7:45 AM
  local time, missing briefs show publish status, and Weekly Tribune stays until
  replaced.

Install task:
1. Confirm the repo is on branch v7.0.5 and the worktree is clean.
2. Confirm the Desktop DMG exists and matches the expected SHA256. If it is
   missing or stale, run:
   FINTHEON_ALLOW_S100_UNSIGNED=1 bash scripts/desktop-release-preflight.sh
   Then copy desktop-dist/Fintheon-7.0.5-arm64.dmg to ~/Desktop.
3. Detach any mounted /Volumes/Fintheon* volume, mount the DMG read-only, copy
   Fintheon.app into /Applications, and run:
   xattr -cr /Applications/Fintheon.app
4. Verify /Applications/Fintheon.app reports version 7.0.5, bundle id
   io.pricedinresearch.fintheon, and has the executable blocker helper at:
   /Applications/Fintheon.app/Contents/Library/LaunchServices/io.pricedinresearch.fintheon.blocker-helper
5. Do not install or repair the privileged helper directly from the shell. Tell
   the user to open Settings > Trading > System Blocker Gate > Approve/Repair
   once; that is the only intended admin-password path.
6. Launch Fintheon and report the DMG path, checksum, installed app version, and
   blocker-helper presence.

Do not publish, upload, reset git state, or touch unrelated dirty files.
```

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

- Homebrew, Node 22, Bun
- Hermes agent
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
