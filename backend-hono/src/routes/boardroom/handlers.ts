// [claude-code 2026-03-16] Agent backend v7.9: updated agent names (Harper-Hermes, Consul, Herald)
// [claude-code 2026-03-20] Added standup triggers, breaking news, herald alert, scheduler status routes
// [claude-code 2026-03-20] T2: Consilium routes — filter params on /messages, developments, scorecards, predictions
// [claude-code 2026-03-23] fix(boardroom): switch message fetching from JSONL to Supabase boardroom-store
// [claude-code 2026-03-26] Thought bank handlers + "show full analysis" command detection
import type { Context } from 'hono';
import {
  getInterventionMessages,
  sendToIntervention,
  sendMentionToBoardroom,
  checkBoardroomStatus,
  appendToBoardroom,
} from '../../services/hermes-sessions.js';
import { getOrCreateTodaySession, getSessionMessages } from '../../services/boardroom-store.js';
import { toLegacyMessage, type BoardroomSessionFilter } from '../../types/boardroom-db.js';
import { getBoardroomMeetingSchedule } from '../../services/boardroom-schedule.js';
import type { InterventionType, InterventionSeverity, BoardroomAgent } from '../../types/boardroom.js';
import { spawnBoardroomStandup, spawnBoardroomNewsResponse, spawnBoardroomBroadcast, type StandupTask } from '../../services/boardroom-spawner.js';
import { triggerBoardroomForNews, createHeraldAlert } from '../../services/boardroom-news-trigger.js';
import { getBoardroomSchedulerStatus } from '../../services/cron/boardroom-scheduler.js';
import {
  getRecentThoughts,
  getThoughtById,
  getAgentThoughts as getAgentThoughtsFromStore,
  getThoughtByMessageId,
} from '../../services/thought-bank-store.js';
import type { AgentName } from '../../types/context-bank.js';
import { VALID_AGENTS } from '../../types/context-bank.js';

interface SendInterventionBody {
  message?: string;
}

interface SendMentionBody {
  message?: string;
  agent?: string;
  thinkHarder?: boolean;
}

/**
 * GET /api/boardroom/messages
 * Read boardroom coordination transcript.
 */
export async function handleGetBoardroomMessages(c: Context) {
  try {
    const agentParam = c.req.query('agent');
    const search = c.req.query('search');
    const since = c.req.query('since');
    const until = c.req.query('until');
    const limitParam = c.req.query('limit');
    const offsetParam = c.req.query('offset');

    const session = await getOrCreateTodaySession();

    const filter: BoardroomSessionFilter = {};
    if (agentParam) filter.agent = agentParam.split(',')[0] as BoardroomAgent;
    if (search) filter.search = search;
    if (since) filter.since = since;
    if (until) filter.until = until;
    if (limitParam) filter.limit = parseInt(limitParam, 10);
    if (offsetParam) filter.offset = parseInt(offsetParam, 10);

    const dbMessages = await getSessionMessages(session.id, Object.keys(filter).length ? filter : undefined);
    const messages = dbMessages.map(toLegacyMessage);

    return c.json({ messages, total: messages.length });
  } catch (error) {
    console.error('[Boardroom] Failed to fetch boardroom messages:', error);
    return c.json({ error: 'Failed to fetch boardroom messages' }, 500);
  }
}

/**
 * GET /api/boardroom/intervention/messages
 * Read intervention transcript (User <-> Harper channel).
 */
export async function handleGetInterventionMessages(c: Context) {
  try {
    const messages = await getInterventionMessages('pic-intervention');
    return c.json({ messages });
  } catch (error) {
    console.error('[Boardroom] Failed to fetch intervention messages:', error);
    return c.json({ error: 'Failed to fetch intervention messages' }, 500);
  }
}

/**
 * POST /api/boardroom/intervention/send
 * Send a user command to Harper via intervention session.
 */
export async function handleSendInterventionMessage(c: Context) {
  try {
    const body = await c.req.json<SendInterventionBody>().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';

    if (!message) {
      return c.json({ error: 'message is required' }, 400);
    }

    await sendToIntervention(message, 'pic-intervention');
    return c.json({ success: true });
  } catch (error) {
    console.error('[Boardroom] Failed to send intervention message:', error);
    return c.json({ error: 'Failed to send intervention message' }, 500);
  }
}

/**
 * POST /api/boardroom/mention/send
 * Send a @mention message directly to the boardroom thread targeting a specific agent.
 * When agent is '@everyone', triggers all agents to respond hierarchically
 * (most relevant sub-agent first → CAO last).
 */
export async function handleSendMentionMessage(c: Context) {
  try {
    const body = await c.req.json<SendMentionBody>().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const agent = typeof body?.agent === 'string' ? body.agent.trim() : '';
    const thinkHarder = body?.thinkHarder === true;

    if (!message) {
      return c.json({ error: 'message is required' }, 400);
    }
    if (!agent) {
      return c.json({ error: 'agent is required' }, 400);
    }

    // Detect "show full analysis" command
    const showFullPattern = /show\s+full\s+analysis/i;
    if (showFullPattern.test(message)) {
      const agentName = agent as AgentName;
      if (VALID_AGENTS.includes(agentName)) {
        const thoughts = await getAgentThoughtsFromStore(agentName, { limit: 1 });
        if (thoughts.length > 0) {
          const thought = thoughts[0];
          const header = `📄 **Full Analysis** — ${agent} (${thought.title || 'Recent'})\n\n`;
          await appendToBoardroom(header + thought.fullAnalysis, 'assistant');
          return c.json({ success: true, expanded: true, thoughtId: thought.id });
        }
      }
      await appendToBoardroom(`_No recent analysis found for ${agent}._`, 'system');
      return c.json({ success: true, expanded: false });
    }

    // @everyone broadcast: all agents respond hierarchically
    if (agent === '@everyone') {
      // Fire-and-forget — responses stream into boardroom as each agent finishes
      spawnBoardroomBroadcast(message, thinkHarder).catch((err) => {
        console.error('[Boardroom] @everyone broadcast failed:', err);
      });
      return c.json({ success: true, broadcast: true });
    }

    await sendMentionToBoardroom(message, agent);
    return c.json({ success: true });
  } catch (error) {
    console.error('[Boardroom] Failed to send mention message:', error);
    return c.json({ error: 'Failed to send mention message' }, 500);
  }
}

/**
 * POST /api/boardroom/intervention/trigger
 * Trigger a structured intervention that posts to the boardroom chat.
 */
export async function handleTriggerIntervention(c: Context) {
  try {
    const body = await c.req.json<{
      agent?: string;
      type?: InterventionType;
      severity?: InterventionSeverity;
      message?: string;
      metadata?: Record<string, unknown>;
    }>().catch(() => null);

    // Default to Feucht for system alerts (risk desk); frontends may pass any BoardroomAgent
    const agent = (body?.agent as BoardroomAgent) || 'Feucht';
    const type = body?.type || 'risk_alert';
    const severity = body?.severity || 'warning';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const metadata = body?.metadata;

    if (!message) {
      return c.json({ error: 'message is required' }, 400);
    }

    const SEVERITY_EMOJI: Record<InterventionSeverity, string> = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
    };

    const TYPE_LABEL: Record<InterventionType, string> = {
      risk_alert: 'RISK ALERT',
      overtrading_warning: 'OVERTRADING WARNING',
      rule_violation: 'RULE VIOLATION',
      market_event: 'MARKET EVENT',
      position_check: 'POSITION CHECK',
      huddle: 'HUDDLE',
      standup: 'STANDUP',
      briefing: 'BRIEFING',
    };

    const emoji = SEVERITY_EMOJI[severity];
    const label = TYPE_LABEL[type];
    const metaStr = metadata ? `\n\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\`` : '';

    const content = `${emoji} **[${label}]** (${severity.toUpperCase()}) — ${agent}\n\n${message}${metaStr}`;

    // Write to boardroom as a system-level message
    await appendToBoardroom(content, 'assistant');

    return c.json({ success: true, id: crypto.randomUUID() });
  } catch (error) {
    console.error('[Boardroom] Failed to trigger intervention:', error);
    return c.json({ error: 'Failed to trigger intervention' }, 500);
  }
}

/**
 * POST /api/boardroom/trade-idea
 * Post a structured trade idea to the boardroom chat.
 */
export async function handlePostTradeIdea(c: Context) {
  try {
    const body = await c.req.json<{
      agent?: string;
      instrument?: string;
      direction?: string;
      conviction?: string;
      entry?: number;
      stopLoss?: number;
      target?: number;
      thesis?: string;
      keyLevels?: { label: string; price: number }[];
    }>().catch(() => null);

    const agent = body?.agent || 'Harper-Hermes';
    const instrument = body?.instrument;
    const direction = body?.direction || 'neutral';
    const conviction = body?.conviction || 'medium';
    const thesis = body?.thesis || '';

    if (!instrument || !thesis) {
      return c.json({ error: 'instrument and thesis are required' }, 400);
    }

    const DIR_EMOJI: Record<string, string> = { long: '🟢', short: '🔴', neutral: '🟡' };
    const emoji = DIR_EMOJI[direction] || '🟡';

    let content = `${emoji} **[TRADE IDEA]** — ${agent}\n`;
    content += `**${instrument}** | ${direction.toUpperCase()} | Conviction: ${conviction.toUpperCase()}\n`;
    if (body?.entry) content += `Entry: ${body.entry} `;
    if (body?.stopLoss) content += `| Stop: ${body.stopLoss} `;
    if (body?.target) content += `| Target: ${body.target}`;
    if (body?.entry || body?.stopLoss || body?.target) content += '\n';
    if (body?.keyLevels?.length) {
      content += `Key Levels: ${body.keyLevels.map(l => `${l.label} @ ${l.price}`).join(', ')}\n`;
    }
    content += `\n${thesis}`;

    await appendToBoardroom(content, 'assistant');

    return c.json({ success: true, id: crypto.randomUUID() });
  } catch (error) {
    console.error('[Boardroom] Failed to post trade idea:', error);
    return c.json({ error: 'Failed to post trade idea' }, 500);
  }
}

/**
 * GET /api/boardroom/status
 * Quick check that expected Hermes sessions are available.
 */
export async function handleGetBoardroomStatus(c: Context) {
  try {
    const status = await checkBoardroomStatus();
    return c.json(status);
  } catch (error) {
    console.error('[Boardroom] Failed to fetch boardroom status:', error);
    return c.json({ error: 'Failed to fetch boardroom status' }, 500);
  }
}

/**
 * GET /api/boardroom/meeting-schedule
 * Returns schedule derived from the Hermes cron that drives boardroom polling.
 */
export async function handleGetBoardroomMeetingSchedule(c: Context) {
  try {
    const schedule = getBoardroomMeetingSchedule();
    return c.json(schedule);
  } catch (error) {
    console.error('[Boardroom] Failed to compute meeting schedule:', error);
    return c.json({ error: 'Failed to compute meeting schedule' }, 500);
  }
}

// ─── Standup Trigger Routes ──────────────────────────────────────────

const VALID_STANDUP_TASKS: StandupTask[] = [
  'morning-standup',
  'checkin-8am',
  'econ-scan',
  'premarket',
  'market-open',
];

/**
 * POST /api/boardroom/standup/:task
 * Manually trigger a specific standup phase.
 * Task param: morning-standup | checkin-8am | econ-scan | premarket | market-open
 */
export async function handleTriggerStandup(c: Context) {
  try {
    const task = c.req.param('task') as StandupTask;

    if (!VALID_STANDUP_TASKS.includes(task)) {
      return c.json({
        error: `Invalid standup task: ${task}`,
        validTasks: VALID_STANDUP_TASKS,
      }, 400);
    }

    // Fire standup asynchronously — don't block the HTTP response
    const resultPromise = spawnBoardroomStandup(task);

    // Wait a brief moment to ensure the opening message is posted
    const result = await resultPromise;

    return c.json({
      success: result.success,
      task: result.task,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Boardroom] Failed to trigger standup:', error);
    return c.json({ error: 'Failed to trigger standup' }, 500);
  }
}

// ─── Breaking News Trigger ───────────────────────────────────────────

/**
 * POST /api/boardroom/trigger/breaking-news
 * Trigger boardroom discussion for a breaking news event.
 * Body: { eventType, macroLevel, headline, description?, affectedInstruments?, impactDirection?, impactMagnitude? }
 */
export async function handleBreakingNewsTrigger(c: Context) {
  try {
    const body = await c.req.json<{
      eventType?: string;
      macroLevel?: number;
      headline?: string;
      description?: string;
      affectedInstruments?: string[];
      impactDirection?: string;
      impactMagnitude?: number;
    }>().catch(() => null);

    if (!body?.headline) {
      return c.json({ error: 'headline is required' }, 400);
    }

    const alert = createHeraldAlert({
      eventType: (body.eventType as any) ?? 'OTHER',
      macroLevel: (body.macroLevel as any) ?? 3,
      headline: body.headline,
      description: body.description,
      affectedInstruments: body.affectedInstruments,
      impactDirection: body.impactDirection as any,
      impactMagnitude: body.impactMagnitude,
    });

    // Post the formatted alert to boardroom
    const result = await triggerBoardroomForNews(alert);

    // If triggered, also spawn agent responses
    if (result.triggered) {
      // Don't await — let agents respond asynchronously
      spawnBoardroomNewsResponse(alert.headline, alert.eventType).catch((err) =>
        console.error('[Boardroom] News response spawn failed:', err)
      );
    }

    return c.json({
      success: true,
      triggered: result.triggered,
      reason: result.reason,
      alertId: alert.id,
      triggeredAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Boardroom] Failed to trigger breaking news:', error);
    return c.json({ error: 'Failed to trigger breaking news' }, 500);
  }
}

// ─── Herald Sentinel Alert ───────────────────────────────────────────

/**
 * POST /api/boardroom/herald-alert
 * Webhook endpoint for Herald sentinel alerts (Macro Level 3-4 events).
 * Evaluates alert severity and triggers boardroom if criteria met.
 */
export async function handleHeraldAlert(c: Context) {
  try {
    const body = await c.req.json<{
      eventType?: string;
      macroLevel?: number;
      headline?: string;
      description?: string;
      affectedInstruments?: string[];
      impactDirection?: string;
      impactMagnitude?: number;
      source?: string;
    }>().catch(() => null);

    if (!body?.headline || !body?.macroLevel) {
      return c.json({ error: 'headline and macroLevel are required' }, 400);
    }

    // Validate macroLevel >= 3 for boardroom trigger
    if (body.macroLevel < 3) {
      return c.json({
        success: true,
        triggered: false,
        reason: `Macro level ${body.macroLevel} below threshold (min: 3)`,
      });
    }

    const alert = createHeraldAlert({
      eventType: (body.eventType as any) ?? 'OTHER',
      macroLevel: body.macroLevel as any,
      headline: body.headline,
      description: body.description,
      affectedInstruments: body.affectedInstruments,
      impactDirection: body.impactDirection as any,
      impactMagnitude: body.impactMagnitude,
      source: body.source,
    });

    const result = await triggerBoardroomForNews(alert);

    if (result.triggered) {
      spawnBoardroomNewsResponse(alert.headline, alert.eventType).catch((err) =>
        console.error('[Boardroom] Herald news response failed:', err)
      );
    }

    return c.json({
      success: true,
      triggered: result.triggered,
      reason: result.reason,
      alertId: alert.id,
    });
  } catch (error) {
    console.error('[Boardroom] Failed to process herald alert:', error);
    return c.json({ error: 'Failed to process herald alert' }, 500);
  }
}

// ─── Scheduler Status ────────────────────────────────────────────────

/**
 * GET /api/boardroom/scheduler/status
 * Returns the current state of the boardroom cron scheduler.
 */
export async function handleGetSchedulerStatus(c: Context) {
  try {
    const status = getBoardroomSchedulerStatus();
    return c.json(status);
  } catch (error) {
    console.error('[Boardroom] Failed to get scheduler status:', error);
    return c.json({ error: 'Failed to get scheduler status' }, 500);
  }
}

// ─── Consilium Intelligence Layer ───────────────────────────────────

import { extractDevelopments } from '../../services/developments-extractor.js';
import { getAgentScorecards, getPredictions, resolvePrediction } from '../../services/outcome-tracker.js';
import type { DevelopmentCategory } from '../../types/developments.js';
import type { PredictionOutcome } from '../../types/outcome-tracking.js';

/**
 * GET /api/boardroom/developments
 * Fetch extracted development events with optional filters.
 */
export async function handleGetDevelopments(c: Context) {
  try {
    const since = c.req.query('since');
    const category = c.req.query('category') as DevelopmentCategory | undefined;
    const agent = c.req.query('agent') as BoardroomAgent | undefined;
    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const events = await extractDevelopments({ since, category, agent, limit });
    return c.json({ events });
  } catch (error) {
    console.error('[Boardroom] Failed to fetch developments:', error);
    return c.json({ error: 'Failed to fetch developments' }, 500);
  }
}

/**
 * GET /api/boardroom/scorecards
 * Fetch agent prediction scorecards (win rate, streaks, P&L).
 */
export async function handleGetScorecards(c: Context) {
  try {
    const scorecards = await getAgentScorecards();
    return c.json({ scorecards });
  } catch (error) {
    console.error('[Boardroom] Failed to fetch scorecards:', error);
    return c.json({ error: 'Failed to fetch scorecards' }, 500);
  }
}

/**
 * GET /api/boardroom/predictions
 * Fetch tracked predictions with optional agent/outcome filters.
 */
export async function handleGetPredictions(c: Context) {
  try {
    const agent = c.req.query('agent') as BoardroomAgent | undefined;
    const outcome = c.req.query('outcome');
    const predictions = await getPredictions({ agent, outcome });
    return c.json({ predictions });
  } catch (error) {
    console.error('[Boardroom] Failed to fetch predictions:', error);
    return c.json({ error: 'Failed to fetch predictions' }, 500);
  }
}

/**
 * POST /api/boardroom/predictions/:id/resolve
 * Resolve a prediction with outcome, actual result, and optional P&L impact.
 */
export async function handleResolvePrediction(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<{ outcome: PredictionOutcome; actualResult: string; pnlImpact?: number }>().catch(() => null);
    if (!body?.outcome || !body?.actualResult) {
      return c.json({ error: 'outcome and actualResult are required' }, 400);
    }
    await resolvePrediction(id, body.outcome, body.actualResult, body.pnlImpact);
    return c.json({ success: true });
  } catch (error) {
    console.error('[Boardroom] Failed to resolve prediction:', error);
    return c.json({ error: 'Failed to resolve prediction' }, 500);
  }
}

// ─── Thought Bank Handlers ──────────────────────────────────────────

/**
 * GET /api/boardroom/thoughts
 * Fetch recent thoughts with optional ?agent= and ?category= filters.
 */
export async function handleGetThoughts(c: Context) {
  try {
    const agent = c.req.query('agent') as AgentName | undefined;
    const category = c.req.query('category') as any;
    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const thoughts = await getRecentThoughts({ agent, category, limit });
    return c.json({ thoughts });
  } catch (error) {
    console.error('[Boardroom] Failed to fetch thoughts:', error);
    return c.json({ error: 'Failed to fetch thoughts' }, 500);
  }
}

/**
 * GET /api/boardroom/thoughts/:id
 * Fetch a single thought by UUID.
 */
export async function handleGetThoughtById(c: Context) {
  try {
    const id = c.req.param('id');
    const thought = await getThoughtById(id);
    if (!thought) return c.json({ error: 'Thought not found' }, 404);
    return c.json({ thought });
  } catch (error) {
    console.error('[Boardroom] Failed to fetch thought:', error);
    return c.json({ error: 'Failed to fetch thought' }, 500);
  }
}

/**
 * GET /api/boardroom/thoughts/agent/:agent
 * Fetch thoughts for a specific agent.
 */
export async function handleGetAgentThoughts(c: Context) {
  try {
    const agent = c.req.param('agent') as AgentName;
    const limitParam = c.req.query('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const thoughts = await getAgentThoughtsFromStore(agent, { limit });
    return c.json({ thoughts });
  } catch (error) {
    console.error('[Boardroom] Failed to fetch agent thoughts:', error);
    return c.json({ error: 'Failed to fetch agent thoughts' }, 500);
  }
}

/**
 * POST /api/boardroom/thoughts/:messageId/full
 * Retrieve the full analysis linked to a boardroom message and post it to chat.
 */
export async function handleShowFullAnalysis(c: Context) {
  try {
    const messageId = c.req.param('messageId');
    const thought = await getThoughtByMessageId(messageId);

    if (!thought) {
      return c.json({ error: 'No analysis found for this message' }, 404);
    }

    const header = `📄 **Full Analysis** — ${thought.agent} (${thought.title || 'Recent'})\n\n`;
    await appendToBoardroom(header + thought.fullAnalysis, 'assistant');
    return c.json({ success: true, thoughtId: thought.id });
  } catch (error) {
    console.error('[Boardroom] Failed to show full analysis:', error);
    return c.json({ error: 'Failed to show full analysis' }, 500);
  }
}
