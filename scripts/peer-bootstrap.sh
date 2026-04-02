#!/bin/bash
# Per-device peer bootstrap for Fintheon.
# - Verifies Twitter CLI install/auth on THIS machine
# - Opens x.com/login in system browser when auth is missing
# - Registers/updates this device in peers with round-robin capabilities
set -euo pipefail

FINTHEON_ROOT="${FINTHEON_ROOT:-$HOME/Documents/Codebases/fintheon}"
API_BASE="${FINTHEON_API_BASE:-http://localhost:8080}"
PEER_CONFIG="${FINTHEON_PEER_CONFIG:-$HOME/.fintheon/peer.json}"
FROM_UPDATE=false
ASSUME_YES=false
DEVICE_NAME="${FINTHEON_DEVICE_NAME:-$(hostname)}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --from-update)
      FROM_UPDATE=true
      shift
      ;;
    --yes)
      ASSUME_YES=true
      shift
      ;;
    --api-base)
      API_BASE="$2"
      shift 2
      ;;
    --device-name)
      DEVICE_NAME="$2"
      shift 2
      ;;
    *)
      echo "[warn] Unknown arg: $1"
      shift
      ;;
  esac
done

ok()   { echo "  [ok] $1"; }
warn() { echo "  [warn] $1"; }
info() { echo "  [info] $1"; }

echo ""
echo "Peer Bootstrap"
echo "  API:    $API_BASE"
echo "  Device: $DEVICE_NAME"
echo ""

resolve_twitter_bin() {
  if command -v twitter >/dev/null 2>&1; then
    command -v twitter
    return
  fi
  if [[ -x "$HOME/.local/bin/twitter" ]]; then
    echo "$HOME/.local/bin/twitter"
    return
  fi
  echo ""
}

TWITTER_BIN="$(resolve_twitter_bin)"
TWITTER_INSTALLED=false
TWITTER_AUTHENTICATED=false
ROUND_ROBIN_ENROLLED=false

open_x_login() {
  local url="https://x.com/login"
  info "Opening browser for X login: $url"
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  else
    warn "Could not auto-open browser. Open manually: $url"
  fi
}

ensure_twitter_cli() {
  if [[ -n "$TWITTER_BIN" ]]; then
    TWITTER_INSTALLED=true
    ok "Twitter CLI installed ($TWITTER_BIN)"
    return
  fi

  warn "Twitter CLI not found on this device"
  if command -v uv >/dev/null 2>&1; then
    info "Installing twitter-cli via uv..."
    uv tool install twitter-cli >/dev/null 2>&1 || uv tool install twitter-cli || true
    export PATH="$HOME/.local/bin:$PATH"
    hash -r || true
    TWITTER_BIN="$(resolve_twitter_bin)"
  else
    warn "uv not found; cannot auto-install twitter-cli"
  fi

  if [[ -n "$TWITTER_BIN" ]]; then
    TWITTER_INSTALLED=true
    ok "Twitter CLI installed ($TWITTER_BIN)"
  else
    warn "Twitter CLI still missing after install attempt"
    open_x_login
  fi
}

twitter_status_authenticated() {
  if [[ -z "$TWITTER_BIN" ]]; then
    return 1
  fi
  local status_json
  status_json="$("$TWITTER_BIN" status --json 2>/dev/null || true)"
  if [[ -z "$status_json" ]]; then
    return 1
  fi
  echo "$status_json" | grep -q '"authenticated"[[:space:]]*:[[:space:]]*true'
}

ensure_twitter_auth() {
  if [[ "$TWITTER_INSTALLED" != true ]]; then
    warn "Skipping Twitter auth check because CLI is not installed"
    return
  fi

  if twitter_status_authenticated; then
    TWITTER_AUTHENTICATED=true
    ok "Twitter CLI is authenticated"
    return
  fi

  warn "Twitter CLI is installed but not authenticated on this device"
  open_x_login

  if [[ "$ASSUME_YES" == true ]]; then
    info "Waiting briefly, then re-checking auth..."
    sleep 4
  else
    echo ""
    read -r -p "Press Enter after logging into X in your browser..." _
  fi

  if twitter_status_authenticated; then
    TWITTER_AUTHENTICATED=true
    ok "Twitter auth confirmed"
  else
    warn "Twitter auth is still missing (run '$TWITTER_BIN status --json' to verify)"
    "$TWITTER_BIN" doctor --json >/dev/null 2>&1 || true
  fi
}

backend_uses_bypass_auth() {
  local env_file="$FINTHEON_ROOT/backend-hono/.env"
  [[ -f "$env_file" ]] && grep -Eq '^BYPASS_AUTH=true' "$env_file"
}

fetch_access_token() {
  if backend_uses_bypass_auth; then
    ok "Backend BYPASS_AUTH=true detected; using local-user auth context" >&2
    return
  fi

  if [[ -n "${FINTHEON_SUPABASE_TOKEN:-}" ]]; then
    echo "$FINTHEON_SUPABASE_TOKEN"
    return
  fi

  local email="${FINTHEON_SUPABASE_EMAIL:-}"
  local password="${FINTHEON_SUPABASE_PASSWORD:-}"

  if [[ -z "$email" ]]; then
    read -r -p "Supabase email: " email
  fi
  if [[ -z "$password" ]]; then
    read -r -s -p "Supabase password: " password
    echo ""
  fi

  local login_json
  login_json="$(curl -sS -X POST "$API_BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}")"

  local token
  token="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(((d.get("session") or {}).get("access_token")) or "")' <<<"$login_json")"
  if [[ -z "$token" ]]; then
    echo "[error] Login failed. Response:"
    echo "$login_json"
    exit 1
  fi
  echo "$token"
}

ensure_twitter_cli
ensure_twitter_auth

CAPABILITIES='["claude-cli","peer-round-robin"'
if [[ "$TWITTER_INSTALLED" == true ]]; then
  CAPABILITIES="$CAPABILITIES, \"twitter-cli\""
fi
if [[ "$TWITTER_INSTALLED" == true && "$TWITTER_AUTHENTICATED" == true ]]; then
  CAPABILITIES="$CAPABILITIES, \"twitter-round-robin\""
  ROUND_ROBIN_ENROLLED=true
fi
if command -v hermes >/dev/null 2>&1 || [[ -f "$HOME/.hermes/config/default.json" ]]; then
  CAPABILITIES="$CAPABILITIES, \"hermes\""
fi
CAPABILITIES="$CAPABILITIES]"

ACCESS_TOKEN="$(fetch_access_token)"

AUTH_HEADER=()
if [[ -n "$ACCESS_TOKEN" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer $ACCESS_TOKEN")
fi

REGISTER_JSON="$(curl -sS -X POST "$API_BASE/api/peers/register" \
  "${AUTH_HEADER[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"deviceName\":\"$DEVICE_NAME\",\"platform\":\"$(uname -s | tr '[:upper:]' '[:lower:]')\",\"capabilities\":$CAPABILITIES,\"hermesAvailable\":$(command -v hermes >/dev/null 2>&1 && echo true || echo false)}")"

PEER_ID="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(((d.get("peer") or {}).get("id")) or "")' <<<"$REGISTER_JSON")"
DESK_NAME="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(((d.get("peer") or {}).get("deskName")) or "")' <<<"$REGISTER_JSON")"
USER_ID="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(((d.get("peer") or {}).get("userId")) or "local-user")' <<<"$REGISTER_JSON")"

if [[ -z "$PEER_ID" ]]; then
  echo "[error] Peer register/update failed. Response:"
  echo "$REGISTER_JSON"
  exit 1
fi

mkdir -p "$(dirname "$PEER_CONFIG")"
cat > "$PEER_CONFIG" <<EOF
{
  "user_id": "$USER_ID",
  "peer_id": "$PEER_ID",
  "device_name": "$DEVICE_NAME",
  "api_base": "$API_BASE",
  "capabilities": $CAPABILITIES,
  "twitter_cli_installed": $TWITTER_INSTALLED,
  "twitter_cli_authenticated": $TWITTER_AUTHENTICATED,
  "round_robin_enrolled": $ROUND_ROBIN_ENROLLED,
  "registered_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": "$( [[ "$FROM_UPDATE" == true ]] && echo "fintheon-update" || echo "peer-bootstrap" )"
}
EOF

echo ""
ok "Peer registration synchronized"
echo "  Peer ID: $PEER_ID"
echo "  Desk: ${DESK_NAME:-Unassigned}"
echo "  Twitter CLI installed: $TWITTER_INSTALLED"
echo "  Twitter auth ready:    $TWITTER_AUTHENTICATED"
echo "  Round-robin enrolled:  $ROUND_ROBIN_ENROLLED"
echo "  Config: $PEER_CONFIG"
echo ""
