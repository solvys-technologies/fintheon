#!/usr/bin/env bash
# dispatch-tott.sh — Generate the Weekly Tribune (TOTT) and send via iMessage
# Runs on Mac natively (launchd or cron). NOT for Cowork sandbox.
# Schedule: 4:30 PM ET, Sunday

set -euo pipefail

BACKEND_URL="http://localhost:8080"
BACKEND_DIR="$HOME/Documents/Codebases/fintheon/backend-hono"
RECIPIENT="+15618490392"
BRIEF_TYPE="TOTT"
BRIEF_LABEL="TOTT — The Weekly Tribune"
LOG_FILE="$BACKEND_DIR/logs/dispatch-tott.log"
MAX_RETRIES=2
RETRY_DELAY=5

mkdir -p "$(dirname "$LOG_FILE")"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

send_imessage() {
  local msg="$1"
  osascript -e "
    tell application \"Messages\"
      set targetService to 1st account whose service type = iMessage
      set targetBuddy to participant \"$RECIPIENT\" of targetService
      send \"$msg\" to targetBuddy
    end tell
  " 2>> "$LOG_FILE"
}

# --- Step 0: Ensure backend is running ---
if ! lsof -i :8080 -sTCP:LISTEN >/dev/null 2>&1; then
  log "Backend not running. Starting..."
  cd "$BACKEND_DIR"
  nohup bun run dev >> "$LOG_FILE" 2>&1 &
  sleep 8
  if ! lsof -i :8080 -sTCP:LISTEN >/dev/null 2>&1; then
    log "FATAL: Backend failed to start after 8s"
    send_imessage "⚠️ $BRIEF_TYPE dispatch failed — backend unreachable after startup attempt."
    exit 1
  fi
  log "Backend started (PID $!)"
fi

# --- Step 1: Trigger brief generation ---
log "Triggering $BRIEF_TYPE generation..."
RESPONSE=""
for i in $(seq 1 $MAX_RETRIES); do
  RESPONSE=$(curl -s -X POST "$BACKEND_URL/api/data/brief/generate" 2>> "$LOG_FILE") && break
  log "Attempt $i failed. Retrying in ${RETRY_DELAY}s..."
  sleep "$RETRY_DELAY"
done

if [ -z "$RESPONSE" ]; then
  log "FATAL: All curl attempts failed"
  send_imessage "⚠️ $BRIEF_TYPE dispatch failed — backend unreachable after $MAX_RETRIES retries."
  exit 1
fi

log "Generate response: $RESPONSE"

# --- Step 2: Extract content ---
CONTENT=""
ERROR=$(echo "$RESPONSE" | jq -r '.error // empty' 2>/dev/null)
if [ -n "$ERROR" ]; then
  ALREADY=$(echo "$RESPONSE" | jq -r '.message // empty' 2>/dev/null)
  if echo "$ALREADY" | grep -qi "already"; then
    log "Already generated today. Fetching latest..."
  else
    log "FATAL: Generation error — $ERROR"
    DETAILS=$(echo "$RESPONSE" | jq -r '.details // empty' 2>/dev/null)
    send_imessage "⚠️ $BRIEF_TYPE generation failed: $ERROR ${DETAILS:+(${DETAILS})}"
    exit 1
  fi
fi

CONTENT=$(echo "$RESPONSE" | jq -r '.content // empty' 2>/dev/null)

# --- Step 3: Fallback to /latest ---
if [ -z "$CONTENT" ]; then
  log "No content in generate response. Fetching latest $BRIEF_TYPE..."
  LATEST=$(curl -s "$BACKEND_URL/api/data/brief/latest?type=$BRIEF_TYPE" 2>> "$LOG_FILE")
  log "Latest response: $LATEST"
  CONTENT=$(echo "$LATEST" | jq -r '.content // empty' 2>/dev/null)

  if [ -z "$CONTENT" ]; then
    log "FATAL: No $BRIEF_TYPE content found via /latest either"
    send_imessage "⚠️ $BRIEF_TYPE dispatch failed — no brief content available."
    exit 1
  fi
fi

# --- Step 4: Send via iMessage ---
MSG=$(printf "📊 %s\n\n%s" "$BRIEF_LABEL" "$CONTENT")
log "Sending $BRIEF_TYPE via iMessage to $RECIPIENT (${#MSG} chars)..."
send_imessage "$MSG"

log "$BRIEF_TYPE dispatched successfully."
exit 0
