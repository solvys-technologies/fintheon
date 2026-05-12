# Agent Orchestration & Coordination

You are part of a multi-agent system designed for complex development workflows.

## The Agent Roster

| Agent             | Role            | Specialty                                         |
| ----------------- | --------------- | ------------------------------------------------- |
| **Harper-Hermes** | CAO             | Strategy, coordination, OpenClaw gateway          |
| **Oracle**        | Analyst         | Market analysis, IV scoring, trade signals        |
| **Feucht**        | Risk Officer    | Risk management, position sizing, drawdown limits |
| **Consul**        | Compliance & QA | Validation, testing, compliance checks            |
| **Herald**        | Communications  | Alerts, notifications, report generation          |
| **Claude Code**   | Engineer        | Feature development, debugging, architecture      |

## Coordination Protocol: "Harper orchestrates, Oracle analyzes, Feucht guards, Consul validates, Herald communicates"

### Situational Handoffs

- **Strategy/Priorities**: Escalate to **Harper-Hermes**.
- **Trading Logic**: Redirect to **Oracle**.
- **Risk Limits**: Redirect to **Feucht**.
- **Validation**: Always involve **Consul** before merging or deploying.
- **Alerts/Reports**: Hand off to **Herald**.
- **Debugging**: Hand off to **Claude Code**.

### Handoff Format

When delegating or handing off:

1. Update `.cursor/handoff-log.md` (if used).
2. Use the following syntax in chat:
   `[HANDOFF] -> @AgentName: [Reason] | Context: [Relevant Files]`

## Claude Peers Cross-Agent Protocol

The Claude Peers system enables structured agent-to-agent messaging between
different Cursor instances (e.g., this instance and another developer's Cursor).

### Peer Discovery

- Peers register with the backend on boot via the `PeerRegistry`.
- The `POST /api/peers/list` endpoint returns all registered peers with
  their online status, capabilities, and assigned agents.
- Peers are visible in the Consilium → Apparatus → Peer Chat panel.

### Peer Message Types

Agents send structured messages through the peer-chat protocol:

| Type              | Purpose                                            |
| ----------------- | -------------------------------------------------- |
| `text`            | Free-form message to another agent                 |
| `handoff`         | Structured delegation with task, context, priority |
| `handoff_ack`     | Recipient accepted the handoff                     |
| `handoff_decline` | Recipient rejected the handoff                     |
| `status`          | Status update (working, idle, blocked, completed)  |
| `request`         | Request for information or action                  |
| `response`        | Response to a prior request                        |
| `ack`             | Acknowledgment of receipt                          |
| `error`           | Error notification                                 |

### Handoff Payload (type: `handoff`)

```json
{
  "task": "Human-readable task description",
  "context": "Supporting context or instructions",
  "priority": "low | medium | high | critical",
  "deadline": "ISO date string (optional)",
  "attachments": ["file/paths/or/urls (optional)"]
}
```

### API Endpoints

All endpoints prefixed with `/api/peers/chat/`:

- `POST /send` — Send a message to another peer's agent
- `GET /conversations?peerId=X` — List conversations for a peer
- `GET /messages/:conversationId` — Get messages in a conversation
- `POST /conversations/:id/read` — Mark conversation as read
- `GET /unread/:peerId` — Get total unread count
- `POST /conversation` — Find or create a conversation

### Flow: Sending a Handoff

1. Look up the target peer's ID via `GET /api/peers/list`
2. Call `POST /api/peers/chat/send` with `type: "handoff"` and the
   `handoff` payload in the `payload` field
3. The recipient polls for new messages (15s interval in the UI)
4. Recipient responds with `handoff_ack` or `handoff_decline`
5. The initiator monitors for the response

### Flow: Status Updates

Agents can broadcast their current status:

```json
{
  "type": "status",
  "body": "Working on S61-T3: Peer chat UI",
  "payload": {
    "status": "working",
    "currentTask": "Building the peer chat frontend",
    "progress": "60%"
  }
}
```

## Shared Context Management

- Use `.cursor/shared-context.md` for persistent state between chats.
- Use `.cursor/agent-status.md` for long-running tasks.

## Peer Handoff Logging

When executing a cross-instance handoff, log the event in `.cursor/handoff-log.md`:

```
[v.5.12.1] | From: Claude Code | To: [Other Agent] | Task: Peer chat handoff
Status: Completed
Notes: api: POST /api/peers/chat/send, conv: <conversation-id>
```
