// [claude-code 2026-03-20] Boardroom agent spawner — triggers agent discussions for standup/breaking news
/**
 * Boardroom Spawner
 *
 * Spawns P.I.C. agents to discuss market conditions during morning standup
 * and breaking news events. Each agent posts its response to the boardroom
 * session via hermes-sessions.ts.
 *
 * Agent roster: Harper-Hermes (CAO), Feucht (Futures), Consul (Fundamentals), Oracle (Quant)
 */

import { appendToBoardroom } from './hermes-sessions.js';
import { handleHermesChat } from './hermes-handler.js';
import type { HermesAgentRole } from './hermes-service.js';

/** Standup task types matching boardroom-cron.ts schedule IDs */
export type StandupTask =
  | 'morning-standup'
  | 'checkin-8am'
  | 'econ-scan'
  | 'premarket'
  | 'market-open';

interface AgentStandupConfig {
  role: HermesAgentRole;
  displayName: string;
  emoji: string;
}

const BOARDROOM_AGENTS: AgentStandupConfig[] = [
  { role: 'harper-cao', displayName: 'Harper-Hermes', emoji: '🎩' },
  { role: 'futures-desk', displayName: 'Feucht', emoji: '⚡' },
  { role: 'fundamentals-desk', displayName: 'Consul', emoji: '📜' },
  { role: 'pma-merged', displayName: 'Oracle', emoji: '📊' },
  { role: 'herald', displayName: 'Herald', emoji: '👴' },
];

/** Prompts for each standup phase */
const STANDUP_PROMPTS: Record<StandupTask, string> = {
  'morning-standup': `[BOARDROOM STANDUP — 7:30 AM ET]
It's time for the morning standup. You are clocking in to the PIC boardroom.
Provide your initial read on overnight moves, key levels to watch, and your bias for today.
Keep it concise — 3-5 bullet points. Reference specific price levels where possible.`,

  'checkin-8am': `[BOARDROOM CHECK-IN — 8:00 AM ET]
30-minute check-in. Update the boardroom on any developments since 7:30 AM.
Focus on: pre-market moves, overnight gaps, and any notable order flow.
If nothing has changed, say so briefly.`,

  'econ-scan': `[ECONOMIC DATA SCAN — 8:30 AM ET]
Scan for any economic data releases hitting at 8:30 AM (CPI, PPI, jobless claims, etc.).
Report: actual vs consensus, market reaction, and implications for today's trading.
If no data today, flag upcoming catalysts this week.`,

  'premarket': `[PRE-MARKET FINAL — 9:00 AM ET]
Final pre-market assessment. The opening bell is 30 minutes away.
Provide: bias confirmation/reversal, key levels for open, risk/reward setups.
Flag any positions that need attention at the open.`,

  'market-open': `[MARKET OPEN WRAP — 9:30 AM ET]
The bell has rung. Report on opening action: gap fill or trend?
Update key levels based on opening print. Any immediate setups triggered?
Brief summary — what's the plan for the first 30 minutes of RTH?`,
};

/**
 * Spawn a single agent to post to the boardroom.
 * Calls OpenRouter via handleHermesChat and appends the response.
 */
async function spawnAgentResponse(
  agent: AgentStandupConfig,
  prompt: string
): Promise<void> {
  try {
    const response = await handleHermesChat({
      message: prompt,
      agentOverride: agent.role,
    });

    const content = `${agent.emoji} **${agent.displayName}**:\n\n${response.content}`;
    await appendToBoardroom(content, 'assistant');
    console.log(`[BoardroomSpawner] ${agent.displayName} posted to boardroom`);
  } catch (error) {
    console.error(`[BoardroomSpawner] ${agent.displayName} failed:`, error);
    const fallback = `${agent.emoji} **${agent.displayName}**: _[Agent unavailable — check OpenRouter connection]_`;
    await appendToBoardroom(fallback, 'assistant');
  }
}

/**
 * Run a full standup round. Harper opens, then all agents respond in parallel.
 */
export async function spawnBoardroomStandup(task: StandupTask): Promise<{ success: boolean; task: StandupTask }> {
  const prompt = STANDUP_PROMPTS[task];
  if (!prompt) {
    console.error(`[BoardroomSpawner] Unknown task: ${task}`);
    return { success: false, task };
  }

  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });

  console.log(`[BoardroomSpawner] Starting ${task} at ${timestamp} ET`);

  // Harper opens the standup
  const harper = BOARDROOM_AGENTS[0];
  const openingMessage = `🎩 **Harper-Hermes** — _Opening ${task.replace(/-/g, ' ')} at ${timestamp} ET_\n\nAll agents, report in.`;
  await appendToBoardroom(openingMessage, 'assistant');

  // Spawn Harper first (as moderator)
  await spawnAgentResponse(harper, prompt + '\n\nYou are moderating this standup. Set the tone and ask agents to report.');

  // Spawn remaining agents in parallel
  const otherAgents = BOARDROOM_AGENTS.slice(1);
  await Promise.allSettled(
    otherAgents.map((agent) => spawnAgentResponse(agent, prompt))
  );

  console.log(`[BoardroomSpawner] ${task} complete`);
  return { success: true, task };
}

/**
 * Spawn all agents for a breaking news response.
 * Used by boardroom-news-trigger.ts after an alert is posted.
 */
export async function spawnBoardroomNewsResponse(headline: string, eventType: string): Promise<void> {
  const prompt = `[BREAKING NEWS — EMERGENCY BOARDROOM]
A Macro Level 3-4 event has been detected:
Event: ${eventType}
Headline: ${headline}

Provide your immediate assessment. What does this mean for our positions?
What action should we take? Be concise and decisive.`;

  console.log(`[BoardroomSpawner] Spawning news response for: ${headline}`);

  // All agents respond in parallel for breaking news (speed matters)
  await Promise.allSettled(
    BOARDROOM_AGENTS.map((agent) => spawnAgentResponse(agent, prompt))
  );

  console.log(`[BoardroomSpawner] Breaking news response complete`);
}
