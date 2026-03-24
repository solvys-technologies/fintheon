// [claude-code 2026-03-19] T1: Outcome tracker — JSONL-backed agent prediction tracking + scorecards

import { readFile, appendFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { getBoardroomMessages } from './hermes-sessions.js';
import type { TrackedPrediction, PredictionOutcome, AgentScorecard } from '../types/outcome-tracking.js';
import type { BoardroomAgent } from '../types/boardroom.js';

const TRACKING_FILE = join(process.env.HOME ?? '', '.hermes/agents/main/outcome-tracking.jsonl');

const safeJsonParse = <T>(line: string): T | null => {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
};

async function readAllPredictions(): Promise<TrackedPrediction[]> {
  const content = await readFile(TRACKING_FILE, 'utf-8').catch(() => '');
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => safeJsonParse<TrackedPrediction>(l))
    .filter((p): p is TrackedPrediction => p !== null);
}

async function writeAllPredictions(predictions: TrackedPrediction[]): Promise<void> {
  const content = predictions.map(p => JSON.stringify(p)).join('\n') + '\n';
  await writeFile(TRACKING_FILE, content, 'utf-8');
}

export async function trackPrediction(prediction: TrackedPrediction): Promise<void> {
  const line = JSON.stringify(prediction) + '\n';
  try {
    await access(TRACKING_FILE);
    await appendFile(TRACKING_FILE, line, 'utf-8');
  } catch {
    await writeFile(TRACKING_FILE, line, 'utf-8');
  }
}

export async function resolvePrediction(
  id: string,
  outcome: PredictionOutcome,
  actualResult: string,
  pnlImpact?: number
): Promise<void> {
  const predictions = await readAllPredictions();
  const idx = predictions.findIndex(p => p.id === id);
  if (idx === -1) throw new Error(`Prediction not found: ${id}`);

  predictions[idx] = {
    ...predictions[idx],
    outcome,
    actualResult,
    pnlImpact: pnlImpact ?? predictions[idx].pnlImpact,
    resolvedAt: new Date().toISOString(),
  };

  await writeAllPredictions(predictions);
}

export async function getPredictions(filter?: {
  agent?: BoardroomAgent;
  outcome?: string;
}): Promise<TrackedPrediction[]> {
  let predictions = await readAllPredictions();

  if (filter?.agent) {
    predictions = predictions.filter(p => p.agent === filter.agent);
  }
  if (filter?.outcome) {
    predictions = predictions.filter(p => p.outcome === filter.outcome);
  }

  return predictions;
}

export async function extractPredictions(): Promise<TrackedPrediction[]> {
  const { messages } = await getBoardroomMessages('pic-boardroom');
  const predictions: TrackedPrediction[] = [];

  for (const msg of messages) {
    if (!msg.content.includes('[TRADE IDEA]')) continue;

    const content = msg.content;

    // Extract instrument
    const instrumentMatch = content.match(/\b(\/ES|\/NQ|\/CL|SPX|VIX|BTC|ETH|[A-Z]{2,5})\b/i);
    const instrument = instrumentMatch?.[1]?.toUpperCase() ?? 'UNKNOWN';

    // Extract direction
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (/\blong\b|bullish/i.test(content)) direction = 'bullish';
    else if (/\bshort\b|bearish/i.test(content)) direction = 'bearish';

    // Extract prices
    const entryMatch = content.match(/entry[:\s]*\$?([\d,.]+)/i);
    const targetMatch = content.match(/target[:\s]*\$?([\d,.]+)/i);

    predictions.push({
      id: msg.id,
      agent: msg.agent,
      type: 'trade_idea',
      instrument,
      prediction: content.split('\n')[0]?.slice(0, 120) ?? '',
      predictionDate: msg.timestamp,
      direction,
      entryPrice: entryMatch ? parseFloat(entryMatch[1].replace(/,/g, '')) : undefined,
      targetPrice: targetMatch ? parseFloat(targetMatch[1].replace(/,/g, '')) : undefined,
    });
  }

  return predictions;
}

export async function getAgentScorecards(): Promise<AgentScorecard[]> {
  const predictions = await readAllPredictions();
  const agentMap = new Map<BoardroomAgent, TrackedPrediction[]>();

  for (const p of predictions) {
    const list = agentMap.get(p.agent) ?? [];
    list.push(p);
    agentMap.set(p.agent, list);
  }

  const scorecards: AgentScorecard[] = [];

  for (const [agent, preds] of agentMap) {
    const resolved = preds.filter(p => p.outcome);
    const correctCount = resolved.filter(p => p.outcome === 'correct').length;
    const incorrectCount = resolved.filter(p => p.outcome === 'incorrect').length;
    const partialCount = resolved.filter(p => p.outcome === 'partial').length;
    const denomintor = resolved.length || 1;
    const winRate = correctCount / denomintor;

    const totalPnl = preds.reduce((sum, p) => sum + (p.pnlImpact ?? 0), 0);
    const avgPnlPerPrediction = preds.length > 0 ? totalPnl / preds.length : 0;

    // Compute streaks
    let streakCurrent = 0;
    let bestStreak = 0;
    let currentRun = 0;

    // Sort by prediction date for streak calculation
    const sorted = [...resolved].sort(
      (a, b) => new Date(a.predictionDate).getTime() - new Date(b.predictionDate).getTime()
    );

    for (const p of sorted) {
      if (p.outcome === 'correct') {
        currentRun++;
        if (currentRun > bestStreak) bestStreak = currentRun;
      } else {
        currentRun = 0;
      }
    }
    streakCurrent = currentRun;

    scorecards.push({
      agent,
      totalPredictions: preds.length,
      correctCount,
      incorrectCount,
      partialCount,
      winRate,
      avgPnlPerPrediction,
      streakCurrent,
      bestStreak,
    });
  }

  return scorecards;
}
