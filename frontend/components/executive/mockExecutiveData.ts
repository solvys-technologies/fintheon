export interface ExecutiveKpi {
  label: string;
  value: string;
  meta: string;
}

export interface ExecutiveAlert {
  title: string;
  detail: string;
}

export interface ExecutiveAgentHealth {
  name: string;
  status: string;
  lastCheckin: string;
}

export interface ExecutiveBriefItem {
  title: string;
  detail: string;
}

export interface ExecutiveScheduleItem {
  title: string;
  detail: string;
  forecast?: string;
  actual?: string;
  previous?: string;
  /** ISO date string (YYYY-MM-DD). If omitted, treated as today. */
  date?: string;
}

export const executiveKpis: ExecutiveKpi[] = [
  { label: 'Net Exposure', value: '42%', meta: '+6% WoW · Within guardrails' },
  { label: 'Gross Leverage', value: '1.8x', meta: 'Stable · Limit 2.2x' },
  { label: 'Intraday PnL', value: '+$480k', meta: 'Momentum aligned' },
  { label: 'Risk Mode', value: 'Selective', meta: 'Risk budget 68%' },
];

export const executiveAlerts: ExecutiveAlert[] = [
  {
    title: 'CPI head fake detected',
    detail: 'Macro agent suggests trimming beta into 10:00 data release.',
  },
  {
    title: 'PMA-2 throttle request',
    detail: 'Volatility band widened; awaiting H.E. approval.',
  },
  {
    title: 'Energy block alert',
    detail: 'Crude inventory anomaly + options sweep in CL 86C.',
  },
];

export const executiveAgentHealth: ExecutiveAgentHealth[] = [
  { name: 'Harper / CAO', status: 'Operational', lastCheckin: '2 min ago' },
  { name: 'PMA-1', status: 'Monitoring', lastCheckin: '6 min ago' },
  { name: 'PMA-2', status: 'Awaiting Approval', lastCheckin: '1 min ago' },
  { name: 'Futures Desk', status: 'Hedging', lastCheckin: '4 min ago' },
];

export const executiveNeedToKnow: ExecutiveBriefItem[] = [
  {
    title: 'Liquidity depth favors range expansion',
    detail: 'Watch 12:30 re-open; keep stops 5 pts beyond extremes.',
  },
  { title: 'RiskFlow bias: defensive', detail: 'Reduce duration in rate-sensitive book.' },
  { title: 'Research memo: AI infra pricing', detail: 'Comp stack suggests margin compression in Q2.' },
];

// Helper to generate date strings relative to today
function relativeDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export const executiveSchedule: ExecutiveScheduleItem[] = [
  // Today
  {
    title: '09:30 NY Open',
    detail: 'Harper sets session bias',
    forecast: '-',
    actual: '-',
    previous: '-',
    date: relativeDate(0),
  },
  {
    title: '10:00 CPI Print',
    detail: 'Risk pause window',
    forecast: '0.3%',
    actual: '-',
    previous: '0.2%',
    date: relativeDate(0),
  },
  {
    title: '14:15 RiskFlow Sync',
    detail: 'Executive checkpoint',
    forecast: '-',
    actual: '-',
    previous: '-',
    date: relativeDate(0),
  },
  {
    title: '15:00 Options Expiry Review',
    detail: 'Weekly pin risk assessment',
    forecast: '-',
    actual: '-',
    previous: '-',
    date: relativeDate(0),
  },
  // Tomorrow
  {
    title: '08:30 Jobless Claims',
    detail: 'Weekly initial claims release',
    forecast: '220K',
    actual: '-',
    previous: '215K',
    date: relativeDate(1),
  },
  {
    title: '09:30 NY Open',
    detail: 'Session bias recalibration',
    forecast: '-',
    actual: '-',
    previous: '-',
    date: relativeDate(1),
  },
  {
    title: '13:00 30Y Bond Auction',
    detail: 'Duration supply event — watch tail',
    forecast: '4.62%',
    actual: '-',
    previous: '4.58%',
    date: relativeDate(1),
  },
  // Day +2
  {
    title: '10:00 UMich Sentiment',
    detail: 'Consumer confidence prelim',
    forecast: '78.5',
    actual: '-',
    previous: '79.4',
    date: relativeDate(2),
  },
  {
    title: '11:00 Crude Inventories',
    detail: 'EIA weekly petroleum status',
    forecast: '-1.2M',
    actual: '-',
    previous: '-2.5M',
    date: relativeDate(2),
  },
  // Day +3
  {
    title: '08:30 PPI Final',
    detail: 'Producer prices — inflation pipeline',
    forecast: '0.2%',
    actual: '-',
    previous: '0.1%',
    date: relativeDate(3),
  },
  {
    title: '14:00 FOMC Minutes',
    detail: 'December meeting minutes release',
    forecast: '-',
    actual: '-',
    previous: '-',
    date: relativeDate(3),
  },
];

