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

/** Default commentator roster — seeded on first load */
export const DEFAULT_COMMENTATORS: Omit<CommentatorEntry, 'id' | 'createdAt'>[] = [
  { name: 'Jerome Powell', aliases: ['Powell', 'Fed Chair Powell', 'Chair Powell'], tier: 1, role: 'Fed Chair', institution: 'Federal Reserve', weightMultiplier: 1.5, rank: 1, active: true },
  { name: 'Donald Trump', aliases: ['Trump', 'POTUS', 'President Trump'], tier: 1, role: 'President', institution: 'White House', weightMultiplier: 1.5, rank: 2, active: true },
  { name: 'Scott Bessent', aliases: ['Bessent', 'Treasury Secretary Bessent'], tier: 1, role: 'Treasury Secretary', institution: 'US Treasury', weightMultiplier: 1.5, rank: 3, active: true },
  { name: 'Christopher Waller', aliases: ['Waller', 'Fed Waller', "Fed's Waller"], tier: 2, role: 'Fed Governor', institution: 'Federal Reserve', weightMultiplier: 1.2, rank: 4, active: true },
  { name: 'Michael Barr', aliases: ['Barr', 'Fed Barr', "Fed's Barr"], tier: 2, role: 'Fed Vice Chair for Supervision', institution: 'Federal Reserve', weightMultiplier: 1.2, rank: 5, active: true },
  { name: 'Raphael Bostic', aliases: ['Bostic', 'Fed Bostic', "Fed's Bostic"], tier: 2, role: 'Atlanta Fed President', institution: 'Federal Reserve', weightMultiplier: 1.2, rank: 6, active: true },
  { name: 'Alberto Musalem', aliases: ['Musalem', 'Fed Musalem', "Fed's Musalem"], tier: 2, role: 'St. Louis Fed President', institution: 'Federal Reserve', weightMultiplier: 1.2, rank: 7, active: true },
  { name: 'Steve Witkoff', aliases: ['Witkoff', 'Envoy Witkoff'], tier: 2, role: 'Special Envoy', institution: 'White House', weightMultiplier: 1.2, rank: 8, active: true },
  { name: 'Kevin Warsh', aliases: ['Warsh'], tier: 2, role: 'Former Fed Governor', institution: 'Federal Reserve', weightMultiplier: 1.2, rank: 9, active: true },
  { name: 'Howard Lutnick', aliases: ['Lutnick', 'Commerce Secretary Lutnick'], tier: 2, role: 'Commerce Secretary', institution: 'Dept. of Commerce', weightMultiplier: 1.2, rank: 10, active: true },
  { name: 'Nick Timiraos', aliases: ['Timiraos', 'WSJ Timiraos'], tier: 2, role: 'Fed Whisperer', institution: 'Wall Street Journal', weightMultiplier: 1.2, rank: 11, active: true },
  { name: 'Austan Goolsbee', aliases: ['Goolsbee', 'Fed Goolsbee', "Fed's Goolsbee"], tier: 3, role: 'Chicago Fed President', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 12, active: true },
  { name: 'Neel Kashkari', aliases: ['Kashkari', 'Fed Kashkari', "Fed's Kashkari"], tier: 3, role: 'Minneapolis Fed President', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 13, active: true },
  { name: 'Mary Daly', aliases: ['Daly', 'Fed Daly', "Fed's Daly"], tier: 3, role: 'San Francisco Fed President', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 14, active: true },
  { name: 'John Williams', aliases: ['Williams', 'Fed Williams', "Fed's Williams"], tier: 3, role: 'New York Fed President', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 15, active: true },
  { name: 'Thomas Barkin', aliases: ['Barkin', 'Fed Barkin', "Fed's Barkin"], tier: 3, role: 'Richmond Fed President', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 16, active: true },
  { name: 'Michelle Bowman', aliases: ['Bowman', 'Fed Bowman', "Fed's Bowman"], tier: 3, role: 'Fed Governor', institution: 'Federal Reserve', weightMultiplier: 1.0, rank: 17, active: true },
  { name: 'Christine Lagarde', aliases: ['Lagarde', 'ECB Lagarde'], tier: 2, role: 'ECB President', institution: 'European Central Bank', weightMultiplier: 1.2, rank: 18, active: true },
];

export const TIER_DEFAULT_MULTIPLIERS: Record<CommentatorTier, number> = {
  1: 1.5, // Market Movers — Fed Chair, Treasury Sec, POTUS
  2: 1.2, // Notable Officials — Governors, key Cabinet, Timiraos
  3: 1.0, // Color Providers — Regional Feds, analysts
};

export const UNTAGGED_MULTIPLIER = 0.8;
