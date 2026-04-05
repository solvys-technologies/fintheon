#!/bin/bash
# Harper Feed Health Monitor
# Runs on Stop event — checks RiskFlow feed health before session ends.
# Alerts if the feed is empty, stale, or the poller has stopped.
# This ensures Harper (CAO) maintains awareness of pipeline health.

BACKEND_URL="${FINTHEON_BACKEND_URL:-http://localhost:8080}"
HEALTH_ENDPOINT="$BACKEND_URL/api/diagnostics/feed-health"
LOG_FILE="$CLAUDE_PROJECT_DIR/.claude/feed-health.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Fetch feed health (timeout 5s, fail silently if backend is down)
RESPONSE=$(curl -s --max-time 5 "$HEALTH_ENDPOINT" 2>/dev/null)

if [ -z "$RESPONSE" ]; then
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] WARN: Backend unreachable at $HEALTH_ENDPOINT" >> "$LOG_FILE"
  echo "HARPER FEED MONITOR: Backend unreachable — cannot verify feed health." >&2
  exit 0
fi

# Parse response fields
STATUS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status','unknown'))" 2>/dev/null || echo "unknown")
CACHE_SIZE=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cacheSize',0))" 2>/dev/null || echo "0")
POLLER=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pollerRunning',False))" 2>/dev/null || echo "False")
NEWEST=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('newestItemAge','none'))" 2>/dev/null || echo "none")
CACHE_AGE_MS=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('cacheAgeMs',0))" 2>/dev/null || echo "0")

# Log every check
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] status=$STATUS cache=$CACHE_SIZE poller=$POLLER newest=$NEWEST cacheAge=${CACHE_AGE_MS}ms" >> "$LOG_FILE"

# Alert conditions — output to stderr so Claude sees the warning
if [ "$STATUS" = "empty" ]; then
  echo "" >&2
  echo "=== HARPER FEED HEALTH ALERT ===" >&2
  echo "RiskFlow feed cache is EMPTY (0 items)." >&2
  echo "Poller running: $POLLER | Newest item: $NEWEST" >&2
  echo "Action: Check backend logs, Supabase connectivity, and twitter-cli." >&2
  echo "  launchctl list | grep fintheon" >&2
  echo "  curl $HEALTH_ENDPOINT" >&2
  echo "================================" >&2
elif [ "$STATUS" = "poller_stopped" ]; then
  echo "" >&2
  echo "=== HARPER FEED HEALTH ALERT ===" >&2
  echo "RiskFlow feed poller is STOPPED." >&2
  echo "Cache has $CACHE_SIZE items but no new data is being ingested." >&2
  echo "Action: Restart backend — launchctl unload/load io.solvys.fintheon-backend" >&2
  echo "================================" >&2
elif [ "$STATUS" = "stale" ]; then
  CACHE_AGE_MIN=$((CACHE_AGE_MS / 60000))
  echo "" >&2
  echo "=== HARPER FEED HEALTH WARNING ===" >&2
  echo "RiskFlow feed cache is STALE (${CACHE_AGE_MIN}min since last refresh)." >&2
  echo "Cache has $CACHE_SIZE items. Newest: $NEWEST" >&2
  echo "Action: Check Supabase query performance and DB connectivity." >&2
  echo "==================================" >&2
fi

exit 0
