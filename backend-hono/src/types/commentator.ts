// [claude-code 2026-03-27] S2-T1: Commentator tier system — 3 tiers for weighting official statements

export const COMMENTATOR_TIERS = [1, 2, 3] as const;
export type CommentatorTier = (typeof COMMENTATOR_TIERS)[number];

export interface CommentatorEntry {
  id: string;
  name: string;
  aliases: string[]; // ["Jerome Powell", "Powell", "Fed Chair Powell"]
  tier: CommentatorTier;
  role?: string; // "Fed Chair", "Treasury Secretary"
  institution?: string; // "Federal Reserve", "US Treasury"
  weightMultiplier: number; // Tier 1 = 1.5, Tier 2 = 1.2, Tier 3 = 1.0
  rank: number; // Position in the ranked list (1 = most important). Drag-and-drop reorder.
  active: boolean;
  createdAt: string;
}

// [claude-code 2026-03-28] S9-T2: Updated default Persons of Interest per brief spec.
// Top 8 POIs from the brief are Tier 1/2. Remaining Fed governors etc. kept as Tier 2/3.
/** Default Persons of Interest roster — seeded on first load */
export const DEFAULT_COMMENTATORS: Omit<CommentatorEntry, 'id' | 'createdAt'>[] = [
  // ── Top 8 Persons of Interest (per S9-T2 brief) ──
  { name: 'Jerome Powell', aliases: ['Powell', 'Fed Chair Powell', 'Chair Powell'], tier: 1, role: 'Fed Chair, data-dependent', institution: 'Federal Reserve', weightMultiplier: 1.5, rank: 1, active: true },
  { name: 'Donald Trump', aliases: ['Trump', 'POTUS', 'President Trump'], tier: 1, role: 'Executive, tariff hawk', institution: 'White House', weightMultiplier: 1.5, rank: 2, active: true },
  { name: 'Scott Bessent', aliases: ['Bessent', 'Treasury Secretary Bessent'], tier: 1, role: 'Treasury Secretary', institution: 'US Treasury', weightMultiplier: 1.5, rank: 3, active: true },
  { name: 'Marco Rubio', aliases: ['Rubio', 'Secretary Rubio', 'Senator Rubio'], tier: 2, role: 'Secretary of State, foreign policy', institution: 'State Department', weightMultiplier: 1.2, rank: 4, active: true },
  { name: 'Howard Lutnick', aliases: ['Lutnick', 'Commerce Secretary Lutnick'], tier: 2, role: 'Commerce Secretary', institution: 'Dept. of Commerce', weightMultiplier: 1.2, rank: 5, active: true },
  { name: 'Steve Witkoff', aliases: ['Witkoff', 'Envoy Witkoff'], tier: 2, role: 'Middle East envoy', institution: 'White House', weightMultiplier: 1.2, rank: 6, active: true },
  { name: 'Jamieson Greer', aliases: ['Greer', 'USTR Greer'], tier: 2, role: 'US Trade Representative', institution: 'USTR', weightMultiplier: 1.2, rank: 7, active: true },
  { name: 'Peter Navarro', aliases: ['Navarro', 'Adviser Navarro'], tier: 2, role: 'Trade advisor, protectionist', institution: 'White House', weightMultiplier: 1.2, rank: 8, active: true },
  // ── Extended roster (Fed officials, key analysts) ──
  { name: 'Christopher Waller', aliases: ['Waller', 'Fed Waller', "Fed's Waller"], tier: 2, role: 'Fed Governor', institution: 'Federal Reserve', weightMultiplier: 1.2, rank: 9, active: true },
  { name: 'Nick Timiraos', aliases: ['Timiraos', 'WSJ Timiraos'], tier: 2, role: 'Fed Whisperer', institution: 'Wall Street Journal', weightMultiplier: 1.2, rank: 10, active: true },
  { name: 'Christine Lagarde', aliases: ['Lagarde', 'ECB Lagarde'], tier: 2, role: 'ECB President', institution: 'European Central Bank', weightMultiplier: 1.2, rank: 11, active: true },
  { name: 'Austan Goolsbee', aliases: ['Goolsbee', 'Fed Goolsbee', "Fed's Goolsbee"], tier: 3, role: 'Chicago Fed President', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 12, active: true },
  { name: 'Neel Kashkari', aliases: ['Kashkari', 'Fed Kashkari', "Fed's Kashkari"], tier: 3, role: 'Minneapolis Fed President', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 13, active: true },
  { name: 'John Williams', aliases: ['Williams', 'Fed Williams', "Fed's Williams"], tier: 3, role: 'New York Fed President', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 14, active: true },
  { name: 'Mary Daly', aliases: ['Daly', 'Fed Daly', "Fed's Daly"], tier: 3, role: 'San Francisco Fed President', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 15, active: true },
  { name: 'Michelle Bowman', aliases: ['Bowman', 'Fed Bowman', "Fed's Bowman"], tier: 3, role: 'Fed Governor', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 16, active: true },
];

export const TIER_DEFAULT_MULTIPLIERS: Record<CommentatorTier, number> = {
  1: 1.5, // Market Movers — Fed Chair, Treasury Sec, POTUS
  2: 1.2, // Notable Officials — Governors, key Cabinet, Timiraos
  3: 1.0, // Color Providers — Regional Feds, analysts
};

export const UNTAGGED_MULTIPLIER = 0.8;
