// [claude-code 2026-03-16] Agent backend v7.9: updated agent names (Harper-Hermes, Consul, Herald)
import type { Context } from 'hono';
import {
  getBoardroomMessages,
  getInterventionMessages,
  sendToIntervention,
  sendMentionToBoardroom,
  checkBoardroomStatus,
  appendToBoardroom,
} from '../../services/hermes-sessions.js';
import { getBoardroomMeetingSchedule } from '../../services/boardroom-schedule.js';
import type { InterventionType, InterventionSeverity, BoardroomAgent } from '../../types/boardroom.js';

interface SendInterventionBody {
  message?: string;
}

interface SendMentionBody {
  message?: string;
  agent?: string;
}

/**
 * GET /api/boardroom/messages
 * Read boardroom coordination transcript.
 */
export async function handleGetBoardroomMessages(c: Context) {
  try {
    const messages = await getBoardroomMessages('pic-boardroom');
    return c.json({ messages });
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
 */
export async function handleSendMentionMessage(c: Context) {
  try {
    const body = await c.req.json<SendMentionBody>().catch(() => null);
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const agent = typeof body?.agent === 'string' ? body.agent.trim() : '';

    if (!message) {
      return c.json({ error: 'message is required' }, 400);
    }
    if (!agent) {
      return c.json({ error: 'agent is required' }, 400);
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
