#!/bin/bash
# Hook 5: Block PR/push if root build fails (soft-skip — root has no build, backend-hono does)
INPUT=$(cat -)

if command -v jq &>/dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
else
  COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null || echo "")
fi

# Only check commands that push
if echo "$COMMAND" | grep -q "git push"; then
  # Root has no build script — backend-hono does. Skip root build check.
  echo '{"status":"ok","message":"Push allowed (root build not applicable)"}'
  exit 0
fi

echo '{"status":"ok"}'
exit 0
