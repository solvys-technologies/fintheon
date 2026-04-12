#!/bin/bash
# Harper Feed Health Monitor
# [claude-code 2026-04-12] Enhanced: checks scorer status + unscored backlog + item age staleness + Twitter 429
# [claude-code 2026-04-06] Enhanced: checks item age staleness + Twitter 429 rate limit status
# Runs on Stop event — checks RiskFlow feed health before session ends.
# Alerts if the feed is empty, stale, poller stopped, scorer stopped, backlog rotting, or Twitter rate-limited.

BACKEND_URL="${FINTHEON_BACKEND_URL:-http://localhost:8080}"
HEALTH_ENDPOINT="$BACKEND_URL/api/diagnostics/feed-health"
SOURCES_ENDPOINT="$BACKEND_URL/api/riskflow/sources"
LOG_FILE="$CLAUDE_PROJECT_DIR/.claude/feed-health.log"

mkdir -p "$(dirname "$LOG_FILE")"

# Fetch feed health (timeout 5s, fail silently if backend is down)
RESPONSE=$(curl -s --max-time 5 "$HEALTH_ENDPOINT" 2>/dev/null)
SOURCES=$(curl -s --max-time 5 "$SOURCES_ENDPOINT" 2>/dev/null)

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

# Parse scorer status + unscored backlog
SCORER=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('scorerRunning',False))" 2>/dev/null || echo "False")
UNSCORED=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('unscoredBacklog',0))" 2>/dev/null || echo "0")

# Parse Twitter rate limit status from /sources
TWITTER_RATE_LIMITED=$(echo "$SOURCES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('twitterRateLimited',False))" 2>/dev/null || echo "False")
TWITTER_COOLDOWN=$(echo "$SOURCES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('twitterCooldownSec',0))" 2>/dev/null || echo "0")

# Check if newest item is older than 2 hours
ITEM_AGE_HOURS="0"
if [ "$NEWEST" != "none" ] && [ "$NEWEST" != "null" ]; then
  ITEM_AGE_HOURS=$(python3 -c "
from datetime import datetime, timezone
try:
    newest = datetime.fromisoformat('$NEWEST'.replace('Z','+00:00'))
    now = datetime.now(timezone.utc)
    hours = (now - newest).total_seconds() / 3600
    print(f'{hours:.1f}')
except: print('0')
" 2>/dev/null || echo "0")
fi

# Log every check
echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] status=$STATUS cache=$CACHE_SIZE poller=$POLLER scorer=$SCORER unscored=$UNSCORED newest=$NEWEST itemAge=${ITEM_AGE_HOURS}h cacheAge=${CACHE_AGE_MS}ms rateLimited=$TWITTER_RATE_LIMITED" >> "$LOG_FILE"

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
elif [ "$STATUS" = "scorer_stopped" ]; then
  echo "" >&2
  echo "=== HARPER SCORER ALERT ===" >&2
  echo "Central Scorer is NOT RUNNING. Raw items will accumulate unscored." >&2
  echo "Cache: $CACHE_SIZE | Unscored backlog: $UNSCORED" >&2
  echo "Action: Check ENABLE_CENTRAL_SCORING=true in backend-hono/.env" >&2
  echo "  Then restart: launchctl unload/load io.solvys.fintheon-backend" >&2
  echo "============================" >&2
fi

# Unscored backlog check — if >50 items rotting, scorer may be stuck or dropping everything
if [ "$UNSCORED" -gt 50 ] 2>/dev/null; then
  echo "" >&2
  echo "=== HARPER SCORING BACKLOG ALERT ===" >&2
  echo "$UNSCORED unscored items in raw_riskflow_items." >&2
  echo "Scorer running: $SCORER | Poller: $POLLER" >&2
  echo "If scorer is running but backlog isn't draining, check:" >&2
  echo "  1. isScoring mutex stuck (staleness guard should auto-fix after 90s)" >&2
  echo "  2. Web-scrape filter dropping items without writing to scored table" >&2
  echo "  3. DB write errors: tail ~/.hermes/logs/fintheon-backend.log | grep 'Scoring'" >&2
  echo "=====================================" >&2
fi

# Item age check — if newest item is >2 hours old, feed is effectively dead
ITEM_AGE_CHECK=$(python3 -c "print('stale' if float('$ITEM_AGE_HOURS') > 2.0 else 'ok')" 2>/dev/null || echo "ok")
if [ "$ITEM_AGE_CHECK" = "stale" ]; then
  echo "" >&2
  echo "=== HARPER FEED STALENESS ALERT ===" >&2
  echo "Newest feed item is ${ITEM_AGE_HOURS}h old — no new news in >2 hours." >&2
  echo "Cache: $CACHE_SIZE items | Poller: $POLLER" >&2
  echo "Twitter rate limited: $TWITTER_RATE_LIMITED (cooldown: ${TWITTER_COOLDOWN}s)" >&2
  echo "Action: Check twitter-cli rate limits, run 'twitter doctor', verify cookies." >&2
  echo "====================================" >&2
fi

# Twitter 429 rate limit check
if [ "$TWITTER_RATE_LIMITED" = "True" ]; then
  echo "" >&2
  echo "=== HARPER TWITTER RATE LIMIT ===" >&2
  echo "Twitter CLI is rate limited (HTTP 429). Cooldown: ${TWITTER_COOLDOWN}s remaining." >&2
  echo "Feed will resume automatically after cooldown expires." >&2
  echo "If persistent: run 'twitter doctor' to check cookie auth." >&2
  echo "=================================" >&2
fi

# Cache staleness check (original — cache refresh lag)
if [ "$STATUS" = "stale" ]; then
  CACHE_AGE_MIN=$((CACHE_AGE_MS / 60000))
  echo "" >&2
  echo "=== HARPER FEED HEALTH WARNING ===" >&2
  echo "RiskFlow feed cache is STALE (${CACHE_AGE_MIN}min since last refresh)." >&2
  echo "Cache has $CACHE_SIZE items. Newest: $NEWEST" >&2
  echo "Action: Check Supabase query performance and DB connectivity." >&2
  echo "==================================" >&2
fi

exit 0
