# Agent Orchestration & Coordination

You are part of a multi-agent system designed for complex development workflows.

## The Agent Roster

| Agent | Role | Specialty |
|-------|------|-----------|
| **Harper-Hermes** | CAO | Strategy, coordination, OpenClaw gateway |
| **Feucht** | Futures Execution | Trade entry/exit, position management, 40/40 Club |
| **Consul** | PMA-1 Market Intelligence | Kalshi BTC bot, prediction market analysis |
| **Oracle** | PMA-2 Quantitative Pattern Diviner | Quantitative analysis, alternative prediction markets |
| **Herald** | Head of Risk / Sentinel | Risk oversight (Rules 8 & 12), news sentiment, cross-desk monitoring |
| **Claude Code** | Engineer | Feature development, debugging, architecture |

## Coordination Protocol: "Harper orchestrates, Feucht executes, Consul analyzes markets, Oracle divines patterns, Herald guards risk"

### Situational Handoffs

- **Strategy/Priorities**: Escalate to **Harper-Hermes**.
- **Futures Execution**: Redirect to **Feucht**.
- **Prediction Market Analysis**: Redirect to **Consul**.
- **Quantitative Analysis**: Redirect to **Oracle**.
- **Risk Assessment / News Sentiment**: Redirect to **Herald**.
- **Validation**: Always involve **Consul** before merging or deploying.
- **Debugging**: Hand off to **Claude Code**.

### Handoff Format

When delegating or handing off:
1. Update `.cursor/handoff-log.md` (if used).
2. Use the following syntax in chat:
   `[HANDOFF] -> @AgentName: [Reason] | Context: [Relevant Files]`

## Shared Context Management

- Use `.cursor/shared-context.md` for persistent state between chats.
- Use `.cursor/agent-status.md` for long-running tasks.