// [claude-code 2026-03-06] Regime Tracker types and seed data for institutional/session/report trading windows
// [claude-code 2026-03-12] Replaced W/L record with ORB bullish/bearish day tracking

export interface TradingRegime {
  id: string;
  name: string;
  description: string;
  category: 'institutional' | 'session' | 'report' | 'custom';
  timeRange: { start: string; end: string }; // HH:MM in ET
  timezone: 'ET' | 'UTC' | 'GMT' | 'JST';
  daysActive: ('Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri')[];
  confidence: number; // 0-100
  record: { bullishDays: number; bearishDays: number };
  daysObserved: number;
  bias: 'long' | 'short' | 'fade' | 'neutral';
  source?: string;
  instruments: string[];
  notes?: string;
}

const ALL_WEEKDAYS: TradingRegime['daysActive'] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

export const SEED_REGIMES: TradingRegime[] = [
  // INSTITUTIONAL
  {
    id: 'cash-open-manipulation',
    name: 'Cash Open Manipulation',
    description: 'Institutions (Jane Street etc.) manipulate price at cash open. Wait for the fake move, fade it.',
    category: 'institutional',
    timeRange: { start: '09:30', end: '09:45' },
    timezone: 'ET',
    daysActive: ALL_WEEKDAYS,
    confidence: 72,
    record: { bullishDays: 36, bearishDays: 14 },
    daysObserved: 50,
    bias: 'fade',
    source: 'Jane Street',
    instruments: ['/NQ', '/ES', '/MNQ'],
  },
  {
    id: 'gs-morning-note',
    name: 'Goldman Sachs Morning Note',
    description: 'GS publishes morning research. Lean OPPOSITE to their stated bias.',
    category: 'institutional',
    timeRange: { start: '07:00', end: '08:00' },
    timezone: 'ET',
    daysActive: ALL_WEEKDAYS,
    confidence: 65,
    record: { bullishDays: 28, bearishDays: 15 },
    daysObserved: 43,
    bias: 'fade',
    source: 'Goldman Sachs',
    instruments: ['/NQ', '/ES'],
  },
  {
    id: 'jpm-flow-report',
    name: 'JPM Flow Report',
    description: 'JPMorgan flow desk reports. Fade the stated direction.',
    category: 'institutional',
    timeRange: { start: '08:00', end: '09:00' },
    timezone: 'ET',
    daysActive: ALL_WEEKDAYS,
    confidence: 62,
    record: { bullishDays: 25, bearishDays: 15 },
    daysObserved: 40,
    bias: 'fade',
    source: 'JPMorgan',
    instruments: ['/NQ', '/ES'],
  },
  {
    id: 'citi-boa-positioning',
    name: 'Citi/BOA Institutional Positioning',
    description: 'Citibank and Bank of America positioning reports. Fade bias.',
    category: 'institutional',
    timeRange: { start: '07:30', end: '08:30' },
    timezone: 'ET',
    daysActive: ALL_WEEKDAYS,
    confidence: 60,
    record: { bullishDays: 22, bearishDays: 15 },
    daysObserved: 37,
    bias: 'fade',
    source: 'Citi/BOA',
    instruments: ['/NQ', '/ES'],
  },

  // SESSION
  {
    id: 'asian-session',
    name: 'Asian Session Volume',
    description: 'Easy setups during Asian session. Low competition, clear levels. Like taking candy from a baby.',
    category: 'session',
    timeRange: { start: '20:00', end: '00:00' },
    timezone: 'ET',
    daysActive: ALL_WEEKDAYS,
    confidence: 70,
    record: { bullishDays: 30, bearishDays: 13 },
    daysObserved: 43,
    bias: 'neutral',
    instruments: ['/NQ', '/ES'],
  },
  {
    id: 'london-open',
    name: 'London Open',
    description: 'London session opens with directional intent. Strong moves off London open levels.',
    category: 'session',
    timeRange: { start: '03:00', end: '04:30' },
    timezone: 'ET',
    daysActive: ALL_WEEKDAYS,
    confidence: 68,
    record: { bullishDays: 27, bearishDays: 12 },
    daysObserved: 39,
    bias: 'neutral',
    instruments: ['/NQ', '/ES', '/MNQ'],
  },
  {
    id: 'london-ny-overlap',
    name: 'London/NY Overlap',
    description: 'Highest volume period. Big moves happen here.',
    category: 'session',
    timeRange: { start: '08:00', end: '11:00' },
    timezone: 'ET',
    daysActive: ALL_WEEKDAYS,
    confidence: 75,
    record: { bullishDays: 38, bearishDays: 12 },
    daysObserved: 50,
    bias: 'neutral',
    instruments: ['/NQ', '/ES', '/MNQ'],
  },

  // REPORT
  {
    id: 'fomc-days',
    name: 'FOMC Days',
    description: 'Fed rate decision + presser. Extreme volatility. Wait for the whipsaw, trade the trend after.',
    category: 'report',
    timeRange: { start: '14:00', end: '15:00' },
    timezone: 'ET',
    daysActive: ['Wed'],
    confidence: 80,
    record: { bullishDays: 8, bearishDays: 2 },
    daysObserved: 10,
    bias: 'neutral',
    instruments: ['/NQ', '/ES', '/MNQ'],
    notes: 'Only on scheduled FOMC meeting dates',
  },
  {
    id: 'nfp-friday',
    name: 'NFP Friday',
    description: 'Non-Farm Payroll release. Initial spike is noise, trade the reversal.',
    category: 'report',
    timeRange: { start: '08:30', end: '09:30' },
    timezone: 'ET',
    daysActive: ['Fri'],
    confidence: 71,
    record: { bullishDays: 7, bearishDays: 3 },
    daysObserved: 10,
    bias: 'fade',
    instruments: ['/NQ', '/ES', '/MNQ'],
    notes: 'First Friday of each month',
  },
];
