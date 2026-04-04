#!/bin/bash
# vproxy-anthropic-oauth.sh
# Ensures VibeProxy is installed and authenticated for Anthropic subscription usage.

set -euo pipefail

APP_PATH="/Applications/VibeProxy.app"
CLI_BIN="$APP_PATH/Contents/Resources/cli-proxy-api-plus"
CONFIG_PATH="$APP_PATH/Contents/Resources/config.yaml"
BASE_URL="${VPROXY_BASE_URL:-http://localhost:8317}"
API_KEY="${VPROXY_API_KEY:-CLI_PROXY_API_KEY}"

AUTO_YES="false"
FORCE_OAUTH="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --yes)
      AUTO_YES="true"
      shift
      ;;
    --force)
      FORCE_OAUTH="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Usage: $0 [--yes] [--force]"
      exit 1
      ;;
  esac
done

ok() { echo "  ✓ $1"; }
info() { echo "  · $1"; }
warn() { echo "  ⚠ $1"; }
fail() { echo "  ✗ $1"; exit 1; }

ensure_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    fail "This helper currently supports macOS only."
  fi
}

ensure_vibeproxy_installed() {
  if [[ -x "$CLI_BIN" ]]; then
    ok "VibeProxy detected at $APP_PATH"
    return
  fi

  info "VibeProxy not found. Installing latest release from GitHub..."

  local arch
  local asset
  local tag
  local release_json
  local download_url
  local zip_file
  local extract_dir

  arch="$(uname -m)"
  if [[ "$arch" == "arm64" ]]; then
    asset="VibeProxy-arm64.zip"
  else
    asset="VibeProxy-x86_64.zip"
  fi

  release_json="$(curl -fsSL https://api.github.com/repos/automazeio/vibeproxy/releases/latest)"
  tag="$(echo "$release_json" | sed -n 's/.*"tag_name":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
  if [[ -z "$tag" ]]; then
    fail "Could not determine latest VibeProxy release tag."
  fi

  download_url="https://github.com/automazeio/vibeproxy/releases/download/${tag}/${asset}"
  zip_file="/tmp/${asset}"
  extract_dir="/tmp/vibeproxy-extract-$$"

  info "Downloading $asset ($tag)..."
  curl -fL "$download_url" -o "$zip_file"

  rm -rf "$extract_dir"
  mkdir -p "$extract_dir"
  ditto -x -k "$zip_file" "$extract_dir"

  if [[ ! -d "$extract_dir/VibeProxy.app" ]]; then
    fail "Downloaded archive did not contain VibeProxy.app"
  fi

  rm -rf "$APP_PATH"
  cp -R "$extract_dir/VibeProxy.app" "$APP_PATH"
  xattr -cr "$APP_PATH" || true

  rm -rf "$extract_dir" "$zip_file"

  if [[ ! -x "$CLI_BIN" ]]; then
    fail "VibeProxy install completed but CLI binary was not found."
  fi

  ok "VibeProxy installed ($tag)"
}

has_claude_models() {
  local response
  response="$(curl -fsS "${BASE_URL%/}/v1/models" -H "Authorization: Bearer ${API_KEY}" 2>/dev/null || true)"
  if [[ -z "$response" ]]; then
    return 1
  fi
  echo "$response" | grep -qi 'claude'
}

run_oauth_login() {
  if [[ ! -x "$CLI_BIN" ]]; then
    fail "VibeProxy CLI binary missing at $CLI_BIN"
  fi
  if [[ ! -f "$CONFIG_PATH" ]]; then
    fail "VibeProxy config missing at $CONFIG_PATH"
  fi

  open -a "$APP_PATH" >/dev/null 2>&1 || true
  info "Starting Anthropic OAuth flow in your browser..."
  "$CLI_BIN" -config "$CONFIG_PATH" -claude-login -no-incognito
}

main() {
  ensure_macos
  ensure_vibeproxy_installed

  if [[ "$FORCE_OAUTH" != "true" ]] && has_claude_models; then
    ok "VProxy already has Anthropic models available at ${BASE_URL%/}/v1/models"
    exit 0
  fi

  if [[ "$AUTO_YES" != "true" ]]; then
    echo ""
    read -r -p "  Anthropic OAuth is required. Start login now? [Y/n] " choice
    case "${choice:-Y}" in
      y|Y|yes|YES) ;;
      n|N|no|NO) fail "OAuth cancelled by user." ;;
      *) ;;
    esac
  fi

  run_oauth_login

  if has_claude_models; then
    ok "Anthropic OAuth verified. VProxy is ready."
    exit 0
  fi

  fail "OAuth completed, but Claude models were not visible at ${BASE_URL%/}/v1/models."
}

main "$@"
