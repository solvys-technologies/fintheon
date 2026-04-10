// [claude-code 2026-03-23] Price resolver — fetches instrument prices at specific times for outcome tracking
// Uses Yahoo Finance intraday bars to find the closest price to a given timestamp.

import type { ScoringObservation } from "./types.js";
import { getIntradayBars, getPriceNear } from "../market-data/yahoo-market.js";

/** Yahoo symbol mapping for futures */
const FUTURES_TO_YAHOO: Record<string, string> = {
  "/ES": "ES=F",
  "/MES": "ES=F",
  "/NQ": "NQ=F",
  "/MNQ": "NQ=F",
  "/YM": "YM=F",
  "/MYM": "YM=F",
  "/RTY": "RTY=F",
  "/M2K": "RTY=F",
  "/CL": "CL=F",
  "/GC": "GC=F",
  "/SI": "SI=F",
  "/NG": "NG=F",
  "/ZB": "ZB=F",
  "/ZN": "ZN=F",
  "/6E": "6E=F",
  "/6J": "6J=F",
  "/6B": "6B=F",
};

/**
 * Resolve the Yahoo Finance symbol for a given instrument.
 */
export function resolveYahooSymbol(instrument: string): string {
  return FUTURES_TO_YAHOO[instrument] ?? instrument;
}

/**
 * Get the price of an instrument near a specific timestamp.
 * Uses intraday 1-minute bars to find the closest match.
 */
export async function resolvePriceAt(
  instrument: string,
  timestamp: Date,
): Promise<number | null> {
  try {
    const yahooSymbol = resolveYahooSymbol(instrument);
    return await getPriceNear(yahooSymbol, timestamp);
  } catch (error) {
    console.error(
      `[PriceResolver] Failed to resolve price for ${instrument} at ${timestamp.toISOString()}:`,
      error,
    );
    return null;
  }
}

/**
 * Fill in outcome data for an observation.
 * Looks up the price N minutes after the event to determine actual move.
 */
export async function resolveOutcome(
  obs: ScoringObservation,
  afterMinutes: number = 30,
): Promise<{ priceAfter: number; actualMove: number } | null> {
  const eventTime = new Date(obs.publishedAt);
  const outcomeTime = new Date(eventTime.getTime() + afterMinutes * 60 * 1000);

  // Don't try to resolve future prices
  if (outcomeTime.getTime() > Date.now()) {
    return null;
  }

  const priceAfter = await resolvePriceAt(obs.instrument, outcomeTime);
  if (priceAfter == null) return null;

  const actualMove = priceAfter - obs.priceAtObservation;
  return { priceAfter, actualMove };
}

/**
 * Get intraday price bars for analysis.
 * Thin wrapper around yahoo-market for autoresearch use.
 */
export async function getInstrumentBars(
  instrument: string,
  range: string = "1d",
  interval: string = "1m",
): Promise<Array<{ timestamp: number; close: number }>> {
  const yahooSymbol = resolveYahooSymbol(instrument);
  return getIntradayBars(yahooSymbol, range, interval);
}
