#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${LINEAR_ENV_FILE:-$SCRIPT_DIR/.linear-env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${LINEAR_ACCESS_TOKEN:-}" || "${LINEAR_ACCESS_TOKEN:-}" == '${LINEAR_API_KEY}' || "${LINEAR_ACCESS_TOKEN:-}" == '$LINEAR_API_KEY' ]]; then
  export LINEAR_ACCESS_TOKEN="${LINEAR_API_KEY:-}"
fi

if [[ -z "${LINEAR_API:-}" || "${LINEAR_API:-}" == '${LINEAR_API}' || "${LINEAR_API:-}" == '$LINEAR_API' ]]; then
  export LINEAR_API="https://api.linear.app/graphql"
fi

export TOOL_PREFIX="${TOOL_PREFIX:-${SOLVYS_SUPPORT_MCP_TOOL_PREFIX:-solvys_support}}"

if [[ -z "${LINEAR_ACCESS_TOKEN:-}" ]]; then
  echo "solvys-support MCP missing LINEAR_ACCESS_TOKEN or LINEAR_API_KEY. Set it in env or $ENV_FILE." >&2
  exit 1
fi

exec npx -y mcp-server-linear@1.6.0
