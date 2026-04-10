// [claude-code 2026-03-19] T1: Pre/post-market briefing scheduler

import { CronExpressionParser } from "cron-parser";
import { handleHermesChat } from "./hermes-handler.js";
import { appendToBoardroom } from "./hermes-sessions.js";
import { getCurrentSnapshot } from "./context-bank/context-bank-service.js";

let intervalId: ReturnType<typeof setInterval> | null = null;
let lastPreMarketDate: string | null = null;
let lastPostMarketDate: string | null = null;

const BRIEFING_WINDOW_MS = 30 * 60 * 1000; // 30-minute window after cron occurrence

function isInCronWindow(cronExpr: string, now: Date): boolean {
  try {
    const interval = CronExpressionParser.parse(cronExpr, { currentDate: now });
    const last = interval.prev().toDate();
    return now.getTime() - last.getTime() < BRIEFING_WINDOW_MS;
  } catch {
    return false;
  }
}

async function runPreMarketBriefing(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  lastPreMarketDate = today;

  const snapshot = getCurrentSnapshot();
  const context = snapshot
    ? JSON.stringify({
        vix: snapshot.vix,
        ivScores: Object.keys(snapshot.ivScores),
      })
    : "{}";

  const prompt = `[PRE-MARKET BRIEF] Generate a concise pre-market briefing. Include: overnight futures moves, key economic events today, open risk exposures, and critical levels to watch. Context: ${context}`;

  try {
    const response = await handleHermesChat({
      message: prompt,
      agentOverride: "harper-cao",
    });
    await appendToBoardroom(
      `[PRE-MARKET BRIEF]\n${response.content}`,
      "assistant",
    );
    console.log("[Briefings] Pre-market briefing posted");
  } catch (err) {
    console.error("[Briefings] Pre-market briefing failed:", err);
  }
}

async function runPostMarketBriefing(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  lastPostMarketDate = today;

  const snapshot = getCurrentSnapshot();
  const context = snapshot
    ? JSON.stringify({
        vix: snapshot.vix,
        ivScores: Object.keys(snapshot.ivScores),
      })
    : "{}";

  const prompt = `[POST-MARKET BRIEF] Generate a concise post-market briefing. Include: session recap, P&L summary, key moves of the day, and overnight catalysts to watch. Context: ${context}`;

  try {
    const response = await handleHermesChat({
      message: prompt,
      agentOverride: "harper-cao",
    });
    await appendToBoardroom(
      `[POST-MARKET BRIEF]\n${response.content}`,
      "assistant",
    );
    console.log("[Briefings] Post-market briefing posted");
  } catch (err) {
    console.error("[Briefings] Post-market briefing failed:", err);
  }
}

async function checkAndRunBriefings(): Promise<void> {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const preMarketCron = process.env.HERMES_PREMARKET_CRON ?? "0 7 * * 1-5";
    const postMarketCron =
      process.env.HERMES_POSTMARKET_CRON ?? "30 16 * * 1-5";

    // Pre-market check
    if (lastPreMarketDate !== today && isInCronWindow(preMarketCron, now)) {
      await runPreMarketBriefing();
    }

    // Post-market check
    if (lastPostMarketDate !== today && isInCronWindow(postMarketCron, now)) {
      await runPostMarketBriefing();
    }
  } catch (err) {
    console.error("[Briefings] Check failed:", err);
  }
}

export function startBriefingScheduler(): void {
  if (intervalId) return;
  console.log("[Briefings] Starting briefing scheduler (60s interval)");
  intervalId = setInterval(checkAndRunBriefings, 60_000);
  // Run initial check immediately
  checkAndRunBriefings();
}

export function stopBriefingScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[Briefings] Stopped");
  }
}
