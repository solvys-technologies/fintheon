#!/bin/bash
# Hook 7: Log every Bash command with timestamp
INPUT=$(cat -)
if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
else
  COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")
fi

LOG_FILE="$CLAUDE_PROJECT_DIR/.claude/command-log.txt"
mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $COMMAND" >> "$LOG_FILE"

exit 0
