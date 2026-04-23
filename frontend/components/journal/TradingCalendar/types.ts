export interface CalendarSelection {
  kind: "day" | "week" | "month";
  from: Date;
  to: Date;
}

export interface CalendarTrade {
  id: string;
  date: string;
  realizedPnl: number;
  isWin: boolean;
  origin: "user" | "autopilot";
  entryAt: string;
}

export interface DayAggregate {
  date: string;
  pnl: number;
  count: number;
  wins: number;
  losses: number;
  trades: CalendarTrade[];
}

export type ByDay = Record<string, DayAggregate>;

export interface WeekTotal {
  weekNumber: number;
  pnl: number;
  count: number;
  wins: number;
  losses: number;
}

export type CalendarVariant = "projectx" | "solvys";
export type CalendarGranularity = "day" | "week" | "month";
export type OriginFilter = "all" | "user" | "autopilot";
