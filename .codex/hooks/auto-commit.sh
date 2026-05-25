#!/bin/bash
# Hook 8: Auto-commit changes when Claude stops
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Only commit if there are changes
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "auto: Claude Code task checkpoint [$(date '+%H:%M')]" --no-verify 2>/dev/null || true
fi

exit 0
