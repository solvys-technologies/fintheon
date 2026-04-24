// [claude-code 2026-04-24] S34-T1: Econ-watch filter — country × category pair
// that governs which economic events the populator watches. Seed is 28 rows
// (7 countries × 4 categories). Categories and countries are narrowed unions
// so the UI dropdowns and the populator stay aligned.

export const ECON_WATCH_COUNTRIES = [
  "US",
  "EU",
  "UK",
  "JP",
  "NZ",
  "AU",
  "CA",
] as const;

export type EconWatchCountry = (typeof ECON_WATCH_COUNTRIES)[number];

export const ECON_WATCH_CATEGORIES = [
  "Fiscal",
  "Supply Chain",
  "Inflation",
  "Job Market",
] as const;

export type EconWatchCategory = (typeof ECON_WATCH_CATEGORIES)[number];

export interface EconWatchFilter {
  id: string;
  country: EconWatchCountry | string;
  category: EconWatchCategory | string;
  active: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_ECON_WATCH_FILTERS: Omit<
  EconWatchFilter,
  "id" | "created_at" | "updated_at"
>[] = ECON_WATCH_COUNTRIES.flatMap((country) =>
  ECON_WATCH_CATEGORIES.map((category) => ({
    country,
    category,
    active: true,
    user_id: null,
  })),
);
