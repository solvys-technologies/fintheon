#!/bin/bash
# ============================================================================
# Fintheon Bootstrap — Thin wrapper for the one-liner install
# ============================================================================
# Usage:
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/solvys-technologies/fintheon/main/scripts/fintheon-setup.sh)"
#
# All this does:
#   1. Ensure Xcode CLI Tools are installed (provides git)
#   2. Clone fintheon to ~/Documents/Codebases/fintheon
#   3. Hand off to ./fintheon install (which does the real work)
# ============================================================================
set -euo pipefail

FINTHEON_DIR="$HOME/Documents/Codebases/fintheon"
REPO_URL="https://github.com/solvys-technologies/fintheon.git"
BRANCH="main"

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

# Clone or update
if [[ -d "$FINTHEON_DIR/.git" ]]; then
  echo "  · Repo exists — pulling latest..."
  cd "$FINTHEON_DIR"
  git fetch origin --prune 2>/dev/null || true
  git checkout "$BRANCH" 2>/dev/null || true
  git pull origin "$BRANCH" --rebase 2>/dev/null || true
  echo "  ✓ Updated ($(git log --oneline -1 | cut -c1-7))"
else
  echo "  · Cloning to $FINTHEON_DIR..."
  mkdir -p "$HOME/Documents/Codebases"
  git clone "$REPO_URL" "$FINTHEON_DIR"
  cd "$FINTHEON_DIR"
  echo "  ✓ Cloned ($(git log --oneline -1 | cut -c1-7))"
fi

# Hand off to the repo's own CLI
cd "$FINTHEON_DIR"
chmod +x ./fintheon
exec ./fintheon install
