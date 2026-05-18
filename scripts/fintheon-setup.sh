#!/bin/bash
# ============================================================================
# Fintheon Bootstrap — prompts for install path, clones, hands off to CLI
# ============================================================================
# [claude-code 2026-04-18] Interactive install path selection — writes choice
# to ~/.fintheon/install-path so companion scripts (fintheon-cli, update,
# install-cli, peer-bootstrap) pick it up on subsequent runs.
#
# Usage:
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/v6.7.2/scripts/fintheon-setup.sh)"
#
# Non-interactive (skip the prompt):
#   FINTHEON_DIR=/opt/fintheon /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/v6.7.2/scripts/fintheon-setup.sh)"
# ============================================================================
set -euo pipefail

DEFAULT_DIR="$HOME/Documents/Codebases/fintheon"
REPO_URL="https://github.com/solvys-technologies/fintheon.git"
BRANCH="main"
CONFIG_DIR="$HOME/.fintheon"
CONFIG_PATH="$CONFIG_DIR/install-path"

echo ""
echo "  FINTHEON BOOTSTRAP"
echo "  ─────────────────────────────────"
echo ""

# Xcode CLI Tools (provides git)
if ! xcode-select -p &>/dev/null; then
  echo "  · Installing Xcode CLI Tools (system dialog will appear)..."
  xcode-select --install 2>/dev/null || true
  until xcode-select -p &>/dev/null; do sleep 5; done
fi
echo "  ✓ git available"

# ── Resolve install path: env var > remembered choice > prompt (default) ───

INSTALL_DIR="${FINTHEON_DIR:-}"

if [[ -z "$INSTALL_DIR" && -f "$CONFIG_PATH" ]]; then
  PREV="$(tr -d '[:space:]' < "$CONFIG_PATH" 2>/dev/null || true)"
  if [[ -n "$PREV" ]]; then
    echo "  · Previous install: $PREV"
    INSTALL_DIR="$PREV"
  fi
fi

if [[ -z "$INSTALL_DIR" ]]; then
  if [[ -r /dev/tty ]]; then
    echo ""
    echo "  Where should Fintheon be installed?"
    echo "  Press Enter to accept the default, or type an absolute path (~ allowed)."
    printf "  Install path [%s]: " "$DEFAULT_DIR"
    read -r USER_INPUT < /dev/tty || USER_INPUT=""
    INSTALL_DIR="${USER_INPUT:-$DEFAULT_DIR}"
  else
    # No TTY (non-interactive shell) — use default
    INSTALL_DIR="$DEFAULT_DIR"
  fi
fi

# Expand leading tilde
INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"

# Make absolute
case "$INSTALL_DIR" in
  /*) ;;
  *) INSTALL_DIR="$PWD/$INSTALL_DIR" ;;
esac

echo "  ✓ Install path: $INSTALL_DIR"

# ── Validate target ────────────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR" ]]; then
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    EXISTING_URL="$(git -C "$INSTALL_DIR" remote get-url origin 2>/dev/null || echo '')"
    if [[ -n "$EXISTING_URL" && "$EXISTING_URL" != *"solvys-technologies/fintheon"* ]]; then
      echo "  ✗ $INSTALL_DIR is a git repo but not fintheon (origin: $EXISTING_URL)."
      echo "    Refusing to overwrite. Pick a different path and re-run."
      exit 1
    fi
  else
    if [[ -n "$(ls -A "$INSTALL_DIR" 2>/dev/null)" ]]; then
      echo "  ✗ $INSTALL_DIR exists and is not empty (not a fintheon repo)."
      echo "    Refusing to overwrite. Pick a different path and re-run."
      exit 1
    fi
  fi
fi

# ── Clone or update ────────────────────────────────────────────────────────
if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "  · Repo exists — pulling latest..."
  cd "$INSTALL_DIR"
  git fetch origin --prune 2>/dev/null || true
  git checkout "$BRANCH" 2>/dev/null || true
  git pull origin "$BRANCH" --rebase 2>/dev/null || true
  echo "  ✓ Updated ($(git log --oneline -1 | cut -c1-7))"
else
  echo "  · Cloning to $INSTALL_DIR..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  echo "  ✓ Cloned ($(git log --oneline -1 | cut -c1-7))"
fi

# ── Persist chosen path so companion scripts can resolve it ────────────────
mkdir -p "$CONFIG_DIR"
printf '%s\n' "$INSTALL_DIR" > "$CONFIG_PATH"

# ── Hand off to the repo's own CLI ─────────────────────────────────────────
cd "$INSTALL_DIR"
chmod +x ./fintheon
exec ./fintheon install
