#!/bin/bash
# Hook 2: Block destructive commands before they execute
INPUT=$(cat -)
if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
else
  COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")
fi

DANGEROUS_PATTERNS=(
  "rm -rf"
  "rm -r /"
  "git reset --hard"
  "git push.*--force"
  "DROP TABLE"
  "DROP DATABASE"
  "truncate "
  "> /dev/"
  "mkfs"
  "dd if="
  ":(){:|:&};:"
  "launchctl remove"
  "BYPASS_AUTH"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qi "$pattern"; then
    echo "BLOCKED: Dangerous command detected: $pattern"
    echo "Use a safer alternative or ask the user for explicit approval."
    exit 2
  fi
done

exit 0
