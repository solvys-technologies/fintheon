// [claude-code 2026-03-11] Autopilot scheduler — manages RTH session detection, daily limits, and proposal expiry

/**
 * Autopilot Scheduler
 * Manages RTH session detection, daily limits, and proposal expiry
 */

import { expireOldProposals } from "./proposal-service.js";
import { getSignalStats } from "./signal-processor.js";

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let enabled = true;

export function isRTHActive(): boolean {
  const now = new Date();
  const est = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const day = est.getDay(); // 0=Sun, 6=Sat
  const hours = est.getHours();
  const minutes = est.getMinutes();
  const timeMinutes = hours * 60 + minutes;

  // Mon-Fri, 9:30 AM - 4:00 PM EST
  if (day === 0 || day === 6) return false;
  return timeMinutes >= 570 && timeMinutes <= 960; // 9:30=570, 16:00=960
}

export function getSessionWindow(): string | null {
  if (!isRTHActive()) return null;

  const now = new Date();
  const est = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  const hours = est.getHours();
  const minutes = est.getMinutes();
  const timeMinutes = hours * 60 + minutes;

  if (timeMinutes >= 480 && timeMinutes <= 645) return "morning_flush"; // 8:00-10:45
  if (timeMinutes >= 570 && timeMinutes <= 660) return "forty_forty"; // 9:30-11:00
  if (timeMinutes >= 690 && timeMinutes <= 750) return "lunch_flush"; // 11:30-12:30
  if (timeMinutes >= 900 && timeMinutes <= 960) return "power_hour"; // 3:00-4:00
  return "all_rth";
}

export function getAutopilotStatus() {
  const stats = getSignalStats();
  return {
    enabled,
    isRTH: isRTHActive(),
    activeSession: getSessionWindow(),
    signalsToday: stats.totalSignalsLogged,
    tradesToday: stats.tradesToday,
    maxTradesPerDay: stats.maxTradesPerDay,
    dailyPnL: 0, // TODO: wire to ProjectX position P&L
    dailyDrawdownLimit: 0.03, // 3%
    confidenceThreshold: 80,
  };
}

export function setAutopilotEnabled(value: boolean) {
  enabled = value;
  console.log(`[AutoPilot] Scheduler ${value ? "enabled" : "disabled"}`);
}

export function isAutopilotEnabled(): boolean {
  return enabled;
}

export function startAutopilotScheduler() {
  if (schedulerInterval) return;

  console.log("[AutoPilot] Scheduler started (30s cycle)");

  schedulerInterval = setInterval(async () => {
    try {
      // Expire old proposals every cycle
      const expired = await expireOldProposals();
      if (expired > 0) {
        console.log(`[AutoPilot] Expired ${expired} proposals`);
      }
    } catch (error) {
      console.error("[AutoPilot] Scheduler error:", error);
    }
  }, 30_000);
}

export function stopAutopilotScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[AutoPilot] Scheduler stopped");
  }
}
