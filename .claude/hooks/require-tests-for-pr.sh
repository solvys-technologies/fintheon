#!/bin/bash
# Hook 5: Block PR creation unless build passes
INPUT=$(cat -)
if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')
else
  COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")
fi

# Only check commands that create PRs
if echo "$COMMAND" | grep -q "gh pr create\|git push"; then
  echo "Running build check before PR..."
  cd "$CLAUDE_PROJECT_DIR" || exit 1

  if ! bun run build > /dev/null 2>&1; then
    echo "BLOCKED: Build is failing. Fix errors before creating a PR."
    echo "Run 'bun run build' to see failures."
    exit 2
  fi

  echo "Build passed. Proceeding with PR."
fi

exit 0
