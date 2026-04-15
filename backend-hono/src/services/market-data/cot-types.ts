// [claude-code 2026-04-14] COT and ORB types for regime tracker T1

export interface COTData {
  instrument: string;
  reportDate: string; // YYYY-MM-DD
  commercialNet: number;
  nonCommercialNet: number;
  managedMoneyNet: number;
  weekOverWeekChange: number;
  signal: "bullish" | "bearish" | "neutral";
  signalStrength: number; // 0-1
  fetchedAt: string; // ISO
}

export interface ORBResult {
  instrument: string;
  openPrice: number;
  price10Min: number;
  direction: "bullish" | "bearish";
  changeBps: number;
  changePercent: number;
  timestamp: string; // ISO
}
