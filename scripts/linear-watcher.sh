#!/usr/bin/env bash
# [claude-code 2026-05-14] Switched primary runner from Codex CLI to OpenCode CLI (DeepSeek v4 Pro)
# Fintheon Linear watcher.
# Polls Linear for issues moved to "In Progress (Solvys Agent)" and dispatches
# a local Solvys agent worker. OpenCode CLI is primary; Cursor is fallback.
set -uo pipefail

FINTHEON_ROOT="${FINTHEON_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
WORKSPACE="${WORKSPACE:-$FINTHEON_ROOT}"
STATE_DIR="${SOLVYS_AGENT_STATE_DIR:-$HOME/.linear-watcher-state}"
LOG_DIR="${SOLVYS_AGENT_LOG_DIR:-$HOME/.hermes/logs/solvys-agent}"
ENV_FILE="${LINEAR_ENV_FILE:-$FINTHEON_ROOT/scripts/.linear-env}"
POLL_INTERVAL="${SOLVYS_AGENT_POLL_INTERVAL:-5}"
LINEAR_API="${LINEAR_API:-https://api.linear.app/graphql}"
SOLVYS_AGENT_STATE_NAME="${SOLVYS_AGENT_STATE_NAME:-In Progress (Solvys Agent)}"
LINEAR_FIRST="${LINEAR_WATCHER_FIRST:-25}"
OPENCODE_BIN="${OPENCODE_BIN:-$(command -v opencode 2>/dev/null || true)}"
CURSOR_CLI="${CURSOR_CLI:-/Applications/Cursor.app/Contents/Resources/app/bin/cursor}"
OPENCODE_MODEL="${OPENCODE_MODEL:-opencode-go/deepseek-v4-pro}"
CURSOR_MODEL="${CURSOR_MODEL:-claude-4.6-sonnet-medium}"
DISABLE_OPENCODE="${SOLVYS_AGENT_DISABLE_OPENCODE:-false}"
DISABLE_CURSOR_FALLBACK="${SOLVYS_AGENT_DISABLE_CURSOR_FALLBACK:-false}"

mkdir -p "$STATE_DIR" "$LOG_DIR"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
  fi

  if [[ -z "${LINEAR_API_KEY:-}" || -z "${LINEAR_TEAM_ID:-}" ]]; then
    log "Waiting for LINEAR_API_KEY and LINEAR_TEAM_ID in $ENV_FILE"
    return 1
  fi

  return 0
}

linear_query() {
  local query="$1"
  local variables="${2:-{}}"

  curl -sS "$LINEAR_API" \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_KEY" \
    --data "$(jq -n --arg q "$query" --argjson v "$variables" '{query: $q, variables: $v}')" \
    --max-time 20
}

fetch_dispatch_issues() {
  local query variables
  query='
query($teamId: String!, $stateName: String!, $first: Int!) {
  team(id: $teamId) {
    issues(first: $first, filter: { state: { name: { eq: $stateName } } }) {
      nodes {
        id
        identifier
        title
        description
        priority
        url
        state { name }
        labels { nodes { name } }
        project { name }
        projectMilestone { name }
        assignee { name }
        team { name key }
      }
    }
  }
}
'
  variables="$(jq -n \
    --arg teamId "$LINEAR_TEAM_ID" \
    --arg stateName "$SOLVYS_AGENT_STATE_NAME" \
    --argjson first "$LINEAR_FIRST" \
    '{teamId: $teamId, stateName: $stateName, first: $first}')"

  linear_query "$query" "$variables"
}

write_prompt() {
  local issue_json="$1"
  local prompt_path="$2"
  local identifier title priority url labels milestone assignee team description

  identifier="$(jq -r '.identifier' <<<"$issue_json")"
  title="$(jq -r '.title' <<<"$issue_json")"
  priority="$(jq -r '.priority // "unknown"' <<<"$issue_json")"
  url="$(jq -r '.url' <<<"$issue_json")"
  labels="$(jq -r '[.labels.nodes[].name] | join(", ")' <<<"$issue_json")"
  milestone="$(jq -r '.projectMilestone.name // "No milestone"' <<<"$issue_json")"
  assignee="$(jq -r '.assignee.name // "Unassigned"' <<<"$issue_json")"
  team="$(jq -r '.team.name // "Unknown team"' <<<"$issue_json")"
  description="$(jq -r '.description // "No description."' <<<"$issue_json" | head -c 12000)"

  cat > "$prompt_path" <<PROMPT
You are the local Solvys Agent worker picking up Linear issue $identifier.

ISSUE: $title
PRIORITY: $priority
TEAM: $team
MILESTONE: $milestone
ASSIGNEE: $assignee
LABELS: ${labels:-None}
URL: $url
DISPATCH STATE: $SOLVYS_AGENT_STATE_NAME

DESCRIPTION:
$description

LOCAL WORKER CONTRACT:
- Read AGENTS.md, CLAUDE.md, WORKSPACE.md, and .cursor/rules/ before coding.
- Treat the Linear description and any @sprint-md brief reference as canonical scope.
- Implement only this issue/track. Do not pick up adjacent sprint tracks.
- Preserve unrelated local changes.
- Follow existing repo conventions: no broad refactors, compact UI labels, uppercase Linear prefixes, no secrets in output.
- Run the validation commands listed in the issue or brief.
- When done, move the issue to Awaiting Review using linear-ack-complete.sh or the Codex equivalent if available.

Start by grounding in the repo and then implement the issue end to end.
PROMPT
}

launch_opencode() {
  local issue_key="$1"
  local prompt_path="$2"
  local log_path="$3"
  local last_message_path="$4"

  if [[ "$DISABLE_OPENCODE" == "true" || -z "$OPENCODE_BIN" || ! -x "$OPENCODE_BIN" ]]; then
    return 1
  fi

  nohup "$OPENCODE_BIN" run \
    --dir "$WORKSPACE" \
    --model "$OPENCODE_MODEL" \
    --dangerously-skip-permissions \
    --file "$prompt_path" \
    "Execute the attached Linear issue prompt end to end in the workspace." >> "$log_path" 2>&1 &

  log "Dispatched $issue_key to OpenCode CLI (pid $!)"
  return 0
}

launch_cursor_fallback() {
  local issue_key="$1"
  local prompt_path="$2"
  local log_path="$3"

  if [[ "$DISABLE_CURSOR_FALLBACK" == "true" || ! -x "$CURSOR_CLI" ]]; then
    return 1
  fi

  nohup "$CURSOR_CLI" agent \
    --model "$CURSOR_MODEL" \
    --workspace "$WORKSPACE" \
    --trust \
    --sandbox disabled \
    --print \
    "$(cat "$prompt_path")" >> "$log_path" 2>&1 &

  log "Dispatched $issue_key to Cursor fallback (pid $!)"
  return 0
}

dispatch_issue() {
  local issue_json="$1"
  local issue_id identifier marker prompt_path log_path last_message_path

  issue_id="$(jq -r '.id' <<<"$issue_json")"
  identifier="$(jq -r '.identifier' <<<"$issue_json")"

  if [[ -z "$issue_id" || "$issue_id" == "null" || -z "$identifier" || "$identifier" == "null" ]]; then
    return 0
  fi

  if [[ "$identifier" == *"-ORCH"* || "$(jq -r '.title' <<<"$issue_json")" == *"ORCH"* ]]; then
    log "Skipping ORCH/runbook issue $identifier"
    return 0
  fi

  marker="$STATE_DIR/${issue_id}.solvys-agent"
  if [[ -f "$marker" ]]; then
    return 0
  fi

  prompt_path="$STATE_DIR/${identifier}.prompt.md"
  log_path="$LOG_DIR/${identifier}.log"
  last_message_path="$LOG_DIR/${identifier}.last.md"
  write_prompt "$issue_json" "$prompt_path"

  if launch_opencode "$identifier" "$prompt_path" "$log_path" "$last_message_path"; then
    printf 'opencode %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$marker"
    return 0
  fi

  log "OpenCode CLI unavailable for $identifier; trying Cursor fallback"
  if launch_cursor_fallback "$identifier" "$prompt_path" "$log_path"; then
    printf 'cursor-fallback %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$marker"
    return 0
  fi

  log "No local Solvys Agent runner available for $identifier"
}

main() {
  log "Starting Fintheon Linear watcher for state: $SOLVYS_AGENT_STATE_NAME"
  log "Workspace: $WORKSPACE"

  while true; do
    if ! command -v jq >/dev/null 2>&1; then
      log "Waiting for jq to be installed"
      sleep 60
      continue
    fi

    if ! load_env; then
      sleep 60
      continue
    fi

    response="$(fetch_dispatch_issues 2>&1 || true)"
    error_message="$(jq -r '.errors[0].message // empty' <<<"$response" 2>/dev/null || true)"
    if [[ -n "$error_message" ]]; then
      log "Linear query failed: $error_message"
      sleep "$POLL_INTERVAL"
      continue
    fi

    issue_count="$(jq '.data.team.issues.nodes | length' <<<"$response" 2>/dev/null || echo 0)"
    if [[ "$issue_count" -gt 0 ]]; then
      jq -c '.data.team.issues.nodes[]' <<<"$response" | while IFS= read -r issue; do
        dispatch_issue "$issue"
      done
    fi

    sleep "$POLL_INTERVAL"
  done
}

main "$@"
