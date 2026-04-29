#!/bin/bash
# Hook 3: Block edits to protected files
INPUT=$(cat -)
if command -v jq &>/dev/null; then
  FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
else
  FILE_PATH=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('file_path',''))" 2>/dev/null || echo "")
fi

PROTECTED_PATTERNS=(
  ".env.production"
  ".env.local"
  "bun.lockb"
  ".claude/settings.json"
  ".claude/settings.local.json"
  "tool-permissions.json"
  "server_secrets"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "BLOCKED: $FILE_PATH is protected. Ask the user before modifying this file."
    exit 2
  fi
done

exit 0
