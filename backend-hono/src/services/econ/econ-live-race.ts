// [claude-code 2026-04-30] S55: Econ live-race service. Event-window observation
// model: scheduled event opens a window, official/WIRE/TradingView fallback
// observations race, first valid print is provisional, later authoritative
// source reconciles.
//
// Print status lifecycle:
//   scheduled → provisional → confirmed (or corrected, or missed)
//
// TradingView is schedule-only. It opens the window. It does not own live actual truth.

import { createLogger } from "../../lib/logger.js";

const log = createLogger("EconLiveRace");

export type PrintStatus = "scheduled" | "provisional" | "confirmed" | "corrected" | "missed";

export interface LiveRaceWindow {
  eventId: string;
  eventName: string;
  scheduledAt: string; // ISO timestamp
  windowOpenedAt?: string;
  windowClosedAt?: string;
  status: PrintStatus;
  provisionalPrint?: LivePrintResult;
  confirmedPrint?: LivePrintResult;
  participants: string[]; // sourceIds that observed
}

export interface LivePrintResult {
  actual: number;
  forecast?: number;
  previous?: number;
  sourceId: string;
  sourceLabel: string;
  provenance: "wire-word-gate" | "official-page" | "tradingview-actual" | "rss-feed";
  arrivedAt: string;
}

const activeWindows = new Map<string, LiveRaceWindow>();
const completedWindows: LiveRaceWindow[] = [];

export function openRaceWindow(
  eventId: string,
  eventName: string,
  scheduledAt: string,
): LiveRaceWindow {
  const window: LiveRaceWindow = {
    eventId,
    eventName,
    scheduledAt,
    windowOpenedAt: new Date().toISOString(),
    status: "scheduled",
    participants: [],
  };
  activeWindows.set(eventId, window);
  log.info(`Live race window opened: ${eventName} (${eventId})`);
  return window;
}

export function submitProvisionalPrint(
  eventId: string,
  print: Omit<LivePrintResult, "arrivedAt">,
): LiveRaceWindow | null {
  const window = activeWindows.get(eventId);
  if (!window) {
    log.warn(`No active window for event ${eventId} — print discarded`);
    return null;
  }

  // First valid print is provisional
  if (!window.provisionalPrint) {
    window.provisionalPrint = { ...print, arrivedAt: new Date().toISOString() };
    window.status = "provisional";
    window.participants.push(print.sourceId);
    log.info(
      `Provisional print: ${window.eventName} = ${print.actual} (from ${print.sourceLabel}, ${print.provenance})`,
    );
  } else {
    // Already have a provisional — track as additional observation
    window.participants.push(print.sourceId);
    log.info(
      `Additional observation: ${window.eventName} = ${print.actual} (from ${print.sourceLabel})`,
    );
  }

  return window;
}

export function reconcilePrint(
  eventId: string,
  print: Omit<LivePrintResult, "arrivedAt">,
): LiveRaceWindow | null {
  const window = activeWindows.get(eventId);
  if (!window) return null;

  window.confirmedPrint = { ...print, arrivedAt: new Date().toISOString() };
  window.status = "confirmed";

  // Check if correction needed
  if (window.provisionalPrint && window.provisionalPrint.actual !== print.actual) {
    window.status = "corrected";
    log.info(
      `Corrected: ${window.eventName} ${window.provisionalPrint.actual} → ${print.actual} (from ${print.sourceLabel})`,
    );
  }

  log.info(`Reconciled: ${window.eventName} final = ${print.actual} (source: ${print.sourceLabel})`);
  return window;
}

export function closeRaceWindow(eventId: string): LiveRaceWindow | null {
  const window = activeWindows.get(eventId);
  if (!window) return null;

  activeWindows.delete(eventId);
  window.windowClosedAt = new Date().toISOString();

  if (!window.provisionalPrint) {
    window.status = "missed";
  }

  completedWindows.push(window);
  log.info(`Live race window closed: ${window.eventName} (status: ${window.status})`);
  return window;
}

export function getActiveWindows(): LiveRaceWindow[] {
  return Array.from(activeWindows.values());
}

export function getActiveWindow(eventId: string): LiveRaceWindow | undefined {
  return activeWindows.get(eventId);
}

export function getCompletedWindows(limit = 50): LiveRaceWindow[] {
  return completedWindows.slice(-limit);
}
