# S8-T8: Infrastructure (Context Bank, CLI Updater, Device Handoff)

**Sprint**: S8 — The Mega Sprint
**Track**: T8 (after T1)
**Branch**: `v.8.28.1`

## Context
Claude CLI (Harper-Opus) is becoming instrumental to Fintheon's operations. All agents need a unified context bank on the backend (Supabase) with user-scoped partitions. A Fintheon CLI auto-updater command needs to exist. Agent state must sync across devices.

## Files to Read First
- `backend-hono/src/services/supabase-service.ts` — existing Supabase operations
- `backend-hono/src/services/hermes-service.ts` — agent definitions
- `backend-hono/src/services/hermes-sessions.ts` — session management
- `backend-hono/scripts/` — existing dispatch/install scripts
- `frontend/lib/backend.ts` — auth detection, BYPASS_AUTH

## Files to Create
- `backend-hono/src/services/context-bank-service.ts` (<250 lines) — unified context bank
- `backend-hono/src/routes/context-bank/index.ts` (<100 lines) — API routes
- `scripts/fintheon-update.sh` (<80 lines) — CLI auto-updater
- Supabase migration: `agent_context_bank` table

## Implementation

### 1. Unified Context Bank (Supabase)

**Table schema:**
```sql
CREATE TABLE agent_context_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  agent_id TEXT NOT NULL,          -- 'harper-opus', 'oracle', 'feucht', etc.
  memory_type TEXT NOT NULL,       -- 'soul', 'protocol', 'observation', 'preference', 'artifact'
  content TEXT NOT NULL,           -- the memory content
  metadata JSONB DEFAULT '{}',    -- tags, source, confidence, etc.
  is_shared BOOLEAN DEFAULT false, -- visible to all agents for this user
  is_master BOOLEAN DEFAULT false, -- TP's master template entries
  exclude_from_sync BOOLEAN DEFAULT false, -- cron jobs, doodads
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,          -- optional TTL for decay

  -- User scoping: each user has their own partition
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE INDEX idx_context_bank_user ON agent_context_bank(user_id);
CREATE INDEX idx_context_bank_agent ON agent_context_bank(agent_id);
CREATE INDEX idx_context_bank_type ON agent_context_bank(memory_type);
```

**Service: `context-bank-service.ts`:**
- `getContextForAgent(userId, agentId)` — returns all non-excluded memories for this agent + shared memories
- `saveMemory(userId, agentId, memory)` — upserts a memory entry
- `syncFromCliMemory(userId, memoryEntries)` — bulk sync from Claude CLI's local memory
- `getSharedProtocol(userId)` — returns soul + protocol entries visible to all agents
- `seedNewUser(userId)` — copies TP's `is_master` entries to new user's partition

**Retention rules:**
- Only Fintheon-related memories: soul, protocol, observations, preferences, artifacts
- Exclude: `exclude_from_sync = true` entries (cron jobs, extra doodads from non-TP users)
- User-scoped: each user sees only their own memories + shared protocol
- TP's memories with `is_master = true` are the template for new users

**API routes:**
```
GET    /api/context-bank?agent=harper-opus     — get context for agent
POST   /api/context-bank                        — save memory entry
POST   /api/context-bank/sync                   — bulk sync from CLI
GET    /api/context-bank/protocol               — get shared protocol
DELETE /api/context-bank/:id                     — remove memory
```

### 2. Hardwired Memory Sync
Every time any Claude CLI agent updates its memory:
- Backend webhook/endpoint receives the update
- Stores in `agent_context_bank` with appropriate user_id + agent_id
- Filters: only save entries tagged as Fintheon-related
- Skip: entries from non-TP users that are marked as cron/utility

In `harper-handler.ts` (T7 creates this):
- After each Claude CLI response, check if memory was updated
- If yes, call `contextBankService.syncFromCliMemory()` with new entries
- This is HARDWIRED — not optional, not configurable

### 3. Fintheon CLI Auto-Updater

`scripts/fintheon-update.sh`:
```bash
#!/bin/bash
# fintheon update — one-command app update
set -e

LATEST_URL="https://releases.fintheon.com/latest/Fintheon-arm64.dmg"
DMG_PATH="/tmp/Fintheon-latest.dmg"
APP_NAME="Fintheon"
MOUNT_POINT="/Volumes/Fintheon"

echo "Checking for updates..."

# 1. Close running app
if pgrep -x "$APP_NAME" > /dev/null; then
    echo "Closing $APP_NAME..."
    osascript -e "quit app \"$APP_NAME\""
    sleep 2
fi

# 2. Download latest DMG
echo "Downloading latest version..."
curl -L -o "$DMG_PATH" "$LATEST_URL"

# 3. Mount DMG
echo "Mounting..."
hdiutil attach "$DMG_PATH" -nobrowse -quiet

# 4. Install (copy to Applications)
echo "Installing..."
cp -R "$MOUNT_POINT/$APP_NAME.app" /Applications/

# 5. Unmount + cleanup
echo "Cleaning up..."
hdiutil detach "$MOUNT_POINT" -quiet
rm -f "$DMG_PATH"

echo "Updated successfully. Launch Fintheon to continue."
```

Make it callable as `fintheon update`:
- Add to `package.json` bin field or create a symlink during install
- The Electron app's install process should add `fintheon` to PATH

### 4. Agent Source of Truth Handoff
When switching devices:
- On app launch, fetch user's context bank from Supabase
- Merge with any local Claude CLI memory (local takes precedence for conflicts by timestamp)
- Background sync: periodically push local memory to Supabase (every 5 minutes)
- On app close: final sync push

Scripts reference:
- `backend-hono/scripts/install-dispatchers.sh` — existing install script pattern
- Dispatch scripts (`dispatch-adb.sh`, etc.) — should check context bank for device-specific config

### 5. Browser STT/TTS Prep (S9 Foundation)
Document the integration point for replacing OpenAI Whisper:
- Web Speech API: `window.SpeechRecognition` for STT (free, built into Chrome/Electron)
- `window.speechSynthesis` for TTS (system voices, free)
- Create a stub service: `frontend/lib/speech-service.ts` with `startListening()`, `stopListening()`, `speak()` methods
- Wire to existing voice assistant UI (currently broken — actual fix in S9)
- This is PREP ONLY — not full implementation

## Verification
1. `bun run build` — clean
2. Supabase migration runs: `agent_context_bank` table exists
3. `curl localhost:8080/api/context-bank?agent=harper-opus` returns entries (or empty array)
4. `curl -X POST localhost:8080/api/context-bank` saves a memory entry
5. `fintheon-update.sh` runs without errors (may fail on DMG URL until CDN is set up)
6. `speech-service.ts` exports stub methods without errors

## Changelog Entry
```typescript
{ date: '2026-03-28T__:__:__', agent: 'claude-code', summary: 'S8-T8: Unified context bank (Supabase, user-scoped), Fintheon CLI auto-updater, device handoff sync, Browser STT/TTS prep', files: ['backend-hono/src/services/context-bank-service.ts', 'backend-hono/src/routes/context-bank/index.ts', 'scripts/fintheon-update.sh', 'frontend/lib/speech-service.ts'] }
```

### 6. Claude CLI Startup launchd Agent
The Fintheon install/update package must check for and install a macOS launchd agent that starts Claude CLI at system boot — so Harper-Opus is always running when Fintheon opens.

**Plist file**: `~/Library/LaunchAgents/com.fintheon.claude-cli.plist`
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.fintheon.claude-cli</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/claude</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/fintheon-claude-cli.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/fintheon-claude-cli.err.log</string>
</dict>
</plist>
```

**Install check** (add to `fintheon-update.sh` and Electron app startup):
```bash
PLIST="$HOME/Library/LaunchAgents/com.fintheon.claude-cli.plist"
if [ ! -f "$PLIST" ]; then
    # Copy plist and load it
    cp "$APP_RESOURCES/com.fintheon.claude-cli.plist" "$PLIST"
    launchctl load "$PLIST"
fi
```

- On install: copy plist + `launchctl load`
- On update: check if plist exists, update if version changed, `launchctl unload` + `load`
- On uninstall: `launchctl unload` + remove plist
- Verify Claude CLI binary exists at expected path before loading

## DO NOT
- Do NOT implement full voice assistant (S9 scope)
- Do NOT implement full CAO takeover (S9 scope)
- Do NOT modify any UI components (other tracks handle UI)
- Do NOT touch the Hermes agent system (it stays for other analysts)
