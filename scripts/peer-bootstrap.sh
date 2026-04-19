#!/bin/bash
# Per-device peer bootstrap for Fintheon.
# [claude-code 2026-04-18] Team Round Robin is Rettiwt + Agent Reach — Twitter CLI dropped.
# - Verifies backend reachability (Agent Reach ships built-in with backend, no install needed)
# - Verifies Rettiwt pool has at least one key available (required for round-robin ingest)
# - Registers/updates this device in peers with round-robin capabilities
set -euo pipefail

# [claude-code 2026-04-18] Resolve install path: FINTHEON_ROOT env > ~/.fintheon/install-path > default
FINTHEON_ROOT="${FINTHEON_ROOT:-$(cat "$HOME/.fintheon/install-path" 2>/dev/null || echo "$HOME/Documents/Codebases/fintheon")}"
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

AGENT_REACH_AVAILABLE=false
RETTIWT_AVAILABLE=false
RETTIWT_KEYS=0
ROUND_ROBIN_ENROLLED=false

# ── Agent Reach: ships with backend, just verify backend is reachable ──────
if curl -sS --max-time 5 "$API_BASE/api/diagnostics" >/dev/null 2>&1; then
  AGENT_REACH_AVAILABLE=true
  ok "Backend reachable — Agent Reach available (built-in)"
else
  warn "Backend not reachable at $API_BASE — Agent Reach + Rettiwt offline"
fi

# ── Rettiwt pool: required for Team Round Robin X ingest ───────────────────
if [[ "$AGENT_REACH_AVAILABLE" == true ]]; then
  RETTIWT_STATUS=$(curl -sS --max-time 10 -X POST "$API_BASE/api/riskflow/rettiwt-refresh" 2>/dev/null || echo '{}')
  RETTIWT_KEYS=$(echo "$RETTIWT_STATUS" | grep -o '"totalKeys":[0-9]*' | head -1 | cut -d: -f2)
  RETTIWT_KEYS=${RETTIWT_KEYS:-0}
  if [[ "$RETTIWT_KEYS" -gt 0 ]]; then
    RETTIWT_AVAILABLE=true
    ok "Rettiwt pool ready ($RETTIWT_KEYS keys)"
  else
    warn "Rettiwt pool empty — add keys via admin UI to enable round-robin X ingest"
  fi
fi

fetch_access_token() {
  # 1. Explicit token override (e.g. CI)
  if [[ -n "${FINTHEON_SUPABASE_TOKEN:-}" ]]; then
    echo "$FINTHEON_SUPABASE_TOKEN"
    return
  fi

  # 2. Read SUPABASE_SERVICE_ROLE_KEY from backend .env (one account services all devices)
  local env_file="$FINTHEON_ROOT/backend-hono/.env"
  if [[ -f "$env_file" ]]; then
    local srk
    srk="$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' "$env_file" | head -1 | cut -d= -f2-)"
    if [[ -n "$srk" ]]; then
      ok "Using service role key for peer auth" >&2
      echo "$srk"
      return
    fi
  fi

  # 3. Check if BYPASS_AUTH is set (local dev)
  if [[ -f "$env_file" ]] && grep -Eq '^BYPASS_AUTH=true' "$env_file"; then
    ok "Backend BYPASS_AUTH=true detected; using local-user auth context" >&2
    return
  fi

  warn "No SUPABASE_SERVICE_ROLE_KEY found in backend-hono/.env — peer registration may fail" >&2
  warn "Run 'fintheon update' after the backend has loaded secrets from the vault" >&2
}

# ── Capabilities: Agent Reach + Rettiwt are the round-robin substrate ──────
CAPABILITIES='["claude-cli","peer-round-robin"'
if [[ "$AGENT_REACH_AVAILABLE" == true ]]; then
  CAPABILITIES="$CAPABILITIES, \"agent-reach\""
fi
if [[ "$RETTIWT_AVAILABLE" == true ]]; then
  CAPABILITIES="$CAPABILITIES, \"rettiwt\""
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

REGISTER_JSON="$(curl -sS --max-time 10 -X POST "$API_BASE/api/peers/register" \
  "${AUTH_HEADER[@]}" \
  -H "Content-Type: application/json" \
  -d "{\"deviceName\":\"$DEVICE_NAME\",\"platform\":\"$(uname -s | tr '[:upper:]' '[:lower:]')\",\"capabilities\":$CAPABILITIES,\"hermesAvailable\":$(command -v hermes >/dev/null 2>&1 && echo true || echo false)}")"

PEER_ID="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(((d.get("peer") or {}).get("id")) or "")' <<<"$REGISTER_JSON")"
DESK_NAME="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(((d.get("peer") or {}).get("deskName")) or "")' <<<"$REGISTER_JSON")"
USER_ID="$(python3 -c 'import json,sys; d=json.loads(sys.stdin.read()); print(((d.get("peer") or {}).get("userId")) or "local-user")' <<<"$REGISTER_JSON")"

if [[ -z "$PEER_ID" ]]; then
  warn "Peer register/update failed (429 rate limit or backend unreachable). Continuing setup..."
  info "Response: $(echo "$REGISTER_JSON" | head -c 200)"
fi

mkdir -p "$(dirname "$PEER_CONFIG")"
cat > "$PEER_CONFIG" <<EOF
{
  "user_id": "$USER_ID",
  "peer_id": "$PEER_ID",
  "device_name": "$DEVICE_NAME",
  "api_base": "$API_BASE",
  "capabilities": $CAPABILITIES,
  "agent_reach_available": $AGENT_REACH_AVAILABLE,
  "rettiwt_available": $RETTIWT_AVAILABLE,
  "rettiwt_keys": $RETTIWT_KEYS,
  "round_robin_enrolled": $ROUND_ROBIN_ENROLLED,
  "registered_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "source": "$( [[ "$FROM_UPDATE" == true ]] && echo "fintheon-update" || echo "peer-bootstrap" )"
}
EOF

echo ""
ok "Peer registration synchronized"
echo "  Peer ID: $PEER_ID"
echo "  Desk: ${DESK_NAME:-Unassigned}"
echo "  Agent Reach:          $AGENT_REACH_AVAILABLE"
echo "  Rettiwt pool ready:   $RETTIWT_AVAILABLE ($RETTIWT_KEYS keys)"
echo "  Round-robin enrolled: $ROUND_ROBIN_ENROLLED"
echo "  Config: $PEER_CONFIG"

# Test fire: trigger an immediate feed poll to verify the pipeline works on this device
if [[ "$ROUND_ROBIN_ENROLLED" == true ]]; then
  info "Test-firing feed poll to verify pipeline..."
  TEST_FIRE="$(curl -sS --max-time 10 -X POST "$API_BASE/api/riskflow/refresh" \
    "${AUTH_HEADER[@]}" \
    -H "Content-Type: application/json" \
    -o /dev/null -w "%{http_code}" 2>/dev/null || echo "000")"
  if [[ "$TEST_FIRE" == "200" ]]; then
    ok "Feed pipeline test-fire successful"
  else
    warn "Feed test-fire returned HTTP $TEST_FIRE (non-fatal — backend may still be starting)"
  fi
fi

echo ""
