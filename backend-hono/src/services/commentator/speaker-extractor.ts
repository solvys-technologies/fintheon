// [claude-code 2026-03-26] S2-T3: Speaker extraction — regex-based identification of who is speaking in a headline

export interface SpeakerExtraction {
  speaker: string | null;
  institution: string | null;
  isOfficial: boolean;
  confidence: number;
}

const INSTITUTION_MAP: Record<string, string> = {
  fed: 'Federal Reserve',
  fomc: 'Federal Reserve',
  ecb: 'European Central Bank',
  boj: 'Bank of Japan',
  boe: 'Bank of England',
  pboc: "People's Bank of China",
  treasury: 'US Treasury',
  rba: 'Reserve Bank of Australia',
  rbnz: 'Reserve Bank of New Zealand',
  boc: 'Bank of Canada',
  snb: 'Swiss National Bank',
};

// Known officials grouped by institution — used for isOfficial detection and institution reverse-lookup.
// The actual tier weighting comes from the registry (Supabase), not from this map.
const KNOWN_OFFICIALS: Record<string, string> = {
  // Federal Reserve
  powell: 'Federal Reserve',
  waller: 'Federal Reserve',
  bowman: 'Federal Reserve',
  barkin: 'Federal Reserve',
  bostic: 'Federal Reserve',
  daly: 'Federal Reserve',
  williams: 'Federal Reserve',
  goolsbee: 'Federal Reserve',
  kashkari: 'Federal Reserve',
  harker: 'Federal Reserve',
  mester: 'Federal Reserve',
  logan: 'Federal Reserve',
  collins: 'Federal Reserve',
  jefferson: 'Federal Reserve',
  cook: 'Federal Reserve',
  kugler: 'Federal Reserve',
  // US Treasury
  bessent: 'US Treasury',
  lutnick: 'US Treasury',
  // Political
  trump: 'White House',
  // ECB
  lagarde: 'European Central Bank',
  schnabel: 'European Central Bank',
  lane: 'European Central Bank',
  panetta: 'European Central Bank',
  villeroy: 'European Central Bank',
  // BOJ
  ueda: 'Bank of Japan',
  // BOE
  bailey: 'Bank of England',
  // Media (Fed whisperer)
  timiraos: 'WSJ',
};

const TITLE_PREFIXES = [
  'fed chair',
  'fed governor',
  'fed vice chair',
  'treasury secretary',
  'treasury sec',
  'president',
  'vice president',
  'potus',
  'ecb president',
  'boj governor',
  'boe governor',
];

const NULL_EXTRACTION: SpeakerExtraction = {
  speaker: null,
  institution: null,
  isOfficial: false,
  confidence: 0,
};

/**
 * Extracts the speaker/official from a headline using pattern matching.
 * No LLM calls — purely heuristic.
 */
export function extractSpeaker(headline: string): SpeakerExtraction {
  const text = headline.trim();

  // Pattern 1: "Fed's LASTNAME:" or "ECB's LASTNAME:"
  const possessiveMatch = text.match(
    /\b(fed|ecb|boj|boe|pboc|treasury|rba|boc|snb|rbnz)'?s\s+([A-Z][a-z]+)/i
  );
  if (possessiveMatch) {
    const inst = possessiveMatch[1].toLowerCase();
    const name = possessiveMatch[2];
    return {
      speaker: name,
      institution: INSTITUTION_MAP[inst] ?? inst.toUpperCase(),
      isOfficial: true,
      confidence: 0.9,
    };
  }

  // Pattern 2: "TITLE LASTNAME says/said/warns/signals/confirms..."
  for (const prefix of TITLE_PREFIXES) {
    const re = new RegExp(`\\b${prefix}\\s+([A-Z][a-z]+)`, 'i');
    const m = text.match(re);
    if (m) {
      const name = m[1];
      const inst = resolveInstitution(name, prefix);
      return {
        speaker: name,
        institution: inst,
        isOfficial: true,
        confidence: 0.9,
      };
    }
  }

  // Pattern 3: "LASTNAME (Fed/ECB/BOJ) says..."
  const parenMatch = text.match(
    /\b([A-Z][a-z]+)\s+\((Fed|ECB|BOJ|BOE|PBOC|Treasury|RBA|BOC|SNB|RBNZ)\)/i
  );
  if (parenMatch) {
    const name = parenMatch[1];
    const inst = INSTITUTION_MAP[parenMatch[2].toLowerCase()] ?? parenMatch[2];
    return {
      speaker: name,
      institution: inst,
      isOfficial: true,
      confidence: 0.85,
    };
  }

  // Pattern 4: "KNOWN_OFFICIAL says/said/warns/signals..."
  const verbPattern =
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:says?|said|warns?|warned|signals?|signaled|confirms?|confirmed|expects?|sees?|suggests?|urged?|remarks?|noted?|stated?|commented?|hints?|hinted|reiterates?|reiterated|predicts?|indicated?|announces?|announced|speaks?|spoke|testifies?|testified)\b/i;
  const verbMatch = text.match(verbPattern);
  if (verbMatch) {
    const rawName = verbMatch[1];
    const parts = rawName.split(/\s+/);
    // Check last name (or full name) against known officials
    const lastName = parts[parts.length - 1].toLowerCase();
    const fullNameLower = rawName.toLowerCase();

    if (KNOWN_OFFICIALS[lastName]) {
      return {
        speaker: parts[parts.length - 1],
        institution: KNOWN_OFFICIALS[lastName],
        isOfficial: true,
        confidence: 0.85,
      };
    }
    if (fullNameLower === 'nick timiraos' || fullNameLower === 'timiraos') {
      return {
        speaker: 'Timiraos',
        institution: 'WSJ',
        isOfficial: true,
        confidence: 0.85,
      };
    }

    // Unknown person — could be analyst, could be official not in our list
    return {
      speaker: rawName,
      institution: null,
      isOfficial: false,
      confidence: 0.5,
    };
  }

  // Pattern 5: Headline contains a known official name anywhere (lower confidence)
  const lowerText = text.toLowerCase();
  for (const [name, inst] of Object.entries(KNOWN_OFFICIALS)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(lowerText)) {
      return {
        speaker: name.charAt(0).toUpperCase() + name.slice(1),
        institution: inst,
        isOfficial: true,
        confidence: 0.6,
      };
    }
  }

  return NULL_EXTRACTION;
}

function resolveInstitution(name: string, titlePrefix: string): string {
  const lowerName = name.toLowerCase();
  if (KNOWN_OFFICIALS[lowerName]) return KNOWN_OFFICIALS[lowerName];
  const lp = titlePrefix.toLowerCase();
  if (lp.includes('fed')) return 'Federal Reserve';
  if (lp.includes('treasury')) return 'US Treasury';
  if (lp.includes('ecb')) return 'European Central Bank';
  if (lp.includes('boj')) return 'Bank of Japan';
  if (lp.includes('boe')) return 'Bank of England';
  if (lp.includes('potus') || lp.includes('president')) return 'White House';
  return '';
}
