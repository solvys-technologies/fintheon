// [claude-code 2026-03-22] Added @everyone broadcast with hierarchical relevance ordering
// [claude-code 2026-03-20] Boardroom agent spawner — triggers agent discussions for standup/breaking news
/**
 * Boardroom Spawner
 *
 * Spawns P.I.C. agents to discuss market conditions during morning standup,
 * breaking news events, and @everyone broadcasts. Each agent posts its
 * response to the boardroom session via hermes-sessions.ts.
 *
 * Agent roster: Harper-Hermes (CAO), Feucht (Futures), Consul (Fundamentals), Oracle (Quant), Herald (Sentiment)
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

// ─── @everyone Broadcast ─────────────────────────────────────────────

/** Keyword sets for determining agent relevance to a user message */
const AGENT_KEYWORDS: Record<string, string[]> = {
  'futures-desk': [
    'futures', 'nq', 'es', 'mnq', 'mes', 'risk', 'position', 'stop', 'vix',
    'volatility', 'trade', 'entry', 'exit', 'drawdown', 'topstep', 'level',
    'price', 'bid', 'ask', 'fill', 'execution', 'contract', 'lot', 'size',
  ],
  'pma-merged': [
    'prediction', 'probability', 'kalshi', 'forecast', 'cycle', 'correlation',
    'model', 'quant', 'spx', 'btc', 'crypto', 'regime', 'statistical',
    'backtest', 'alpha', 'signal', 'indicator', 'pattern',
  ],
  'fundamentals-desk': [
    'earnings', 'revenue', 'pe', 'valuation', 'company', 'stock', 'nvda',
    'aapl', 'fundamental', 'thesis', 'sec', 'antitrust', 'gdp', 'rate',
    'fed', 'fomc', 'inflation', 'cpi', 'ppi', 'macro', 'economic',
  ],
  herald: [
    'news', 'sentiment', 'twitter', 'aaii', 'survey', 'headline', 'breaking',
    'media', 'bearish', 'bullish', 'fear', 'greed', 'narrative', 'flow',
    'put', 'call', 'skew', 'crowd', 'retail',
  ],
};

/** Sub-agents only (excludes Harper — she always goes last as CAO) */
const SUB_AGENTS = BOARDROOM_AGENTS.filter(a => a.role !== 'harper-cao');

/**
 * Score agent relevance to a message based on keyword frequency.
 * Returns a map of role → score.
 */
function scoreAgentRelevance(message: string): Map<string, number> {
  const lower = message.toLowerCase();
  const scores = new Map<string, number>();

  for (const [role, keywords] of Object.entries(AGENT_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    scores.set(role, score);
  }

  return scores;
}

/**
 * Order sub-agents by relevance to the message (descending score).
 * Ties broken by default order. Harper is excluded — she always goes last.
 */
function orderByRelevance(message: string): AgentStandupConfig[] {
  const scores = scoreAgentRelevance(message);

  return [...SUB_AGENTS].sort((a, b) => {
    const sa = scores.get(a.role) ?? 0;
    const sb = scores.get(b.role) ?? 0;
    if (sb !== sa) return sb - sa;
    // Tie-break: preserve default order
    return SUB_AGENTS.indexOf(a) - SUB_AGENTS.indexOf(b);
  });
}

/**
 * @everyone broadcast — all agents respond sequentially, most relevant first, CAO last.
 * Each agent sees the user message + all prior agent responses for context.
 */
export async function spawnBoardroomBroadcast(
  userMessage: string,
  thinkHarder = false,
): Promise<void> {
  console.log(`[BoardroomSpawner] @everyone broadcast: "${userMessage.slice(0, 80)}..."`);

  // Post the user's message to boardroom
  await appendToBoardroom(`**Human Executive** (@everyone): ${userMessage}`, 'user');

  // Order sub-agents by relevance
  const ordered = orderByRelevance(userMessage);
  const harper = BOARDROOM_AGENTS.find(a => a.role === 'harper-cao')!;

  // Collect responses for context chain
  const responses: string[] = [];

  // Sub-agents respond sequentially, most relevant first
  for (const agent of ordered) {
    const contextBlock = responses.length
      ? `\n\nPrior agent responses (for context):\n${responses.join('\n---\n')}`
      : '';

    const prompt = `[BOARDROOM — @everyone broadcast from the Human Executive]
Message: "${userMessage}"
${contextBlock}

Respond to the Human Executive's message from your desk's perspective.${
  thinkHarder ? ' Think deeper — provide extra analysis and reasoning.' : ''
} Be concise but substantive. 3-5 sentences max unless the topic demands more.`;

    await spawnAgentResponse(agent, prompt);
    responses.push(`${agent.displayName}: [responded]`);
  }

  // Harper (CAO) always responds last — synthesizes and moderates
  const allResponses = responses.join('\n');
  const harperPrompt = `[BOARDROOM — @everyone broadcast from the Human Executive]
Message: "${userMessage}"

All sub-agents have reported in:
${allResponses}

You are the CAO. Synthesize the team's input, resolve any conflicts, and provide the final word.${
    thinkHarder ? ' Think deeper — provide extra analysis.' : ''
  } Address the Human Executive directly.`;

  await spawnAgentResponse(harper, harperPrompt);

  console.log(`[BoardroomSpawner] @everyone broadcast complete (${ordered.length + 1} agents responded)`);
}
