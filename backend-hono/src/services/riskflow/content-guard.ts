// [claude-code 2026-04-29] S48-T5: Wired speculation-filter as gate 5.5.
//   Hedged wire-language ("reportedly", "could trigger", "sources say") demotes
//   IV by 0.7× for wire-source items and blocks for everything else. Econ
//   pipeline ("economic-calendar") always passes — those are confirmed prints.
// [claude-code 2026-04-19] Added scraper-artifact guard — catches bot-checks, paywalls, error pages (e.g. "Bloomberg - Are you a robot?")
// [claude-code 2026-04-15] Fix: MARKET_KEYWORDS missing all FX/currency terms — headlines like "bold actions on FX" blocked as no-market-relevance
// [claude-code 2026-04-15] Fix: FJ_ALLOWED_EMOJIS was missing 🟠🟡🔵 — medium/low severity items were blocked as "non-fj-emoji"
// [claude-code 2026-04-12] Pre-ingestion content guard — blocks garbage before it hits raw_riskflow_items
// Catches: slurs, profanity, political spam, non-financial govt agencies, junk slang, drunk/incoherent text, @ mention replies
// This is a PROFESSIONAL trading platform. Zero tolerance for non-market content.

// [claude-code 2026-04-24] S34-T4: wired bumpCounter into filterWithContentGuard
// so every content-guard rejection lands in riskflow_drop_counters with its
// reason + source. Default stage = "content-guard".

import { createLogger } from "../../lib/logger.js";
import { bumpCounter } from "./drop-counters.js";
import { getSpeculationAction } from "./speculation-filter.js";

const log = createLogger("ContentGuard");

// ── Racial / ethnic / homophobic slurs ──────────────────────────────────────
// Hard block — zero tolerance. Includes leetspeak variants.
const SLUR_PATTERNS = [
  // N-word variants
  /\bn[i1!][g9]{1,2}[ae3]r?s?\b/i,
  /\bn[i1!][g9]{1,2}[ae3]?\b/i,
  /\bn[i1!][g9]{1,2}[aeu3]h?\b/i,
  // Anti-semitic
  /\bk[i1!]ke[s]?\b/i,
  // Anti-Hispanic
  /\bsp[i1!]c[ks]?\b/i,
  /\bwetback[s]?\b/i,
  /\bbeaner[s]?\b/i,
  // Anti-Asian
  /\bch[i1!]nk[s]?\b/i,
  /\bgook[s]?\b/i,
  /\bch[i1!]ng\s*ch[o0]ng/i,
  /\bslant[\s-]?eye/i,
  // Anti-Arab / Middle Eastern
  /\brag\s*head[s]?\b/i,
  /\btowel\s*head[s]?\b/i,
  /\bsand\s*n[i1!]gg/i,
  /\bcamel\s*jockey/i,
  // Anti-Black (other)
  /\bcoon[s]?\b/i,
  /\bdarkie[s]?\b/i,
  /\bjigaboo/i,
  /\bporch\s*monkey/i,
  // General slurs
  /\bfagg?[o0]t[s]?\b/i,
  /\bdyke[s]?\b/i,
  /\btrann[yi]/i,
  /\bretard(ed|s)?\b/i,
];

// ── Profanity / junk language ───────────────────────────────────────────────
// Hard block — this is a professional platform, not Twitter replies.
// Only blocks when these appear as the DOMINANT content (not buried in a headline).
const JUNK_LANGUAGE_PATTERNS = [
  /\b(lol|lmao|lmfao|rofl|roflmao)\b/i,
  /\b(simp|simping|simps)\b/i,
  /\b(stfu|gtfo|foh|smfh)\b/i,
  /\b(clown\s*world|honk\s*honk)\b/i,
  /\b(cope|copium|seethe|mald|malding)\b/i,
  /\b(ratio|ratioed|L\s+take|W\s+take)\b/i,
  /\b(deez\s+nuts|ligma|sugma)\b/i,
  /\b(bruh|bruhhh|bro\s+what|fam|no\s+cap|bussin|deadass|fr\s+fr|ong|ngl)\b/i,
  /\b(sus|sussy|amogus)\b/i,
  /\b(based\s+and|redpill|blackpill|whitepill)\b/i,
  /\b(normie|chad|virgin|incel|beta\s*male|alpha\s*male|sigma)\b/i,
  /\b(cuck|soy\s*boy|snowflake|libtard|conservatard|demoncrat|republicunt)\b/i,
  /\b(rekt|wrecked|owned|pwned)\b/i,
  /\b(cringe|yikes|oof|sheesh)\b/i,
  /\b(wtf|smh|smfh|omfg|jfc)\b/i,
  /\bcomedy\b/i,
  /\bblurb\b/i,
  /\bno[\s-]no\b/i,
  /\bunverified\b/i,
  /\bdeepfake\b/i,
  /\bTucker\s+Carlson\b/i,
];

// ── Political spam / partisan noise ─────────────────────────────────────────
const POLITICAL_SPAM_PATTERNS = [
  /\bMAGA\b/,
  /\bMake\s+America\s+Great\b/i,
  /\bTrump\s+2028\b/i,
  /\bTrump\s+won\b/i,
  /\bstolen\s+election\b/i,
  /\bstop\s+the\s+steal\b/i,
  /\bdeep\s+state\b/i,
  /\bwoke\s+mob\b/i,
  /\bLGBT\b.*\b(agenda|groomer)\b/i,
  /\bLet'?s\s+go\s+Brandon\b/i,
  /\bFJB\b/,
  /\bBrandon\s+(administration|regime)\b/i,
  /\bDrain\s+the\s+swamp\b/i,
  /\bBuild\s+the\s+wall\b/i,
  /\bWWG1WGA\b/i,
  /\bQAnon\b/i,
  /\bgreat\s+awakening\b/i,
  /\bplandemic\b/i,
  /\bsheeple\b/i,
  /\bfascist[s]?\b/i,
  /\bcommie[s]?\b/i,
  /\bmarxi[st]/i,
  /\bwoke\s+(capitalism|agenda|ideology)\b/i,
  /\banti[\s-]?woke\b/i,
  /\bblue\s*anon\b/i,
  /\bdemocRAT\b/,
  /\bRepubliKKKan\b/i,
  /\bTrump\s+derangement\b/i,
  /\b(Biden|Kamala|AOC)\s+(regime|cartel|crime)\b/i,
];

// ── Market relevance keywords (used by multiple filters below) ─────────────
// [claude-code 2026-04-28] S48-T1: Fix 3 — added TradingView descriptive event titles
// (Gross Domestic Product, Consumer Price Index, etc.) so econ items from the
// economic-feed pipeline pass the market-relevance gate.
// [claude-code 2026-04-24] S34-T4: appended FJ-density keywords (see
// fj-keyword-baseline.json). Append-only — NEVER remove a keyword without
// TP signoff, per S34-T4 scope (it only widens the pass rate).
const MARKET_KEYWORDS =
  /\b(tariff|trade\s+war|sanction|executive\s+order|bill\s+sign|deficit|spending|budget|tax|debt|rate|inflation|CPI|PPI|GDP|NFP|FOMC|Fed\b|Gross Domestic Product|Consumer Price Index|Producer Price Index|ISM Manufacturing|ISM Services|Retail Sales|Trade Balance|Durable Goods|Building Permits|Housing Starts|Industrial Production|Jobless Claims|Consumer Confidence|Michigan Sentiment|JOLTS|Average Hourly Earnings|Employment Cost Index|Treasury|yield|bond|equity|stock|futures|oil|crude|gold|VIX|earnings|revenue|IPO|merger|acquisition|bankruptcy|default|downgrade|upgrade|PMI|jobless|unemployment|retail\s+sales|housing|consumer|manufacturing|import|export|supply\s+chain|semiconductor|chip|OPEC|barrel|EIA|DOE|refinery|pipeline|LNG|natgas|interest\s+rate|basis\s+point|hike|cut|hawkish|dovish|tightening|easing|QE|QT|balance\s+sheet|repo|liquidity|margin|leverage|short|long|hedge|derivative|swap|option|put|call|strike|expiry|settlement|clearing|regulation|SEC|CFTC|DOJ|antitrust|compliance|stimulus|infrastructure|appropriation|continuing\s+resolution|shutdown|ceiling|sequester|reconciliation|USMCA|NATO|AUKUS|BRICS|G7|G20|IMF|World\s+Bank|WTO|BIS|ceasefire|escalat|de-?escalat|retaliati|mobiliz|airstrike|missile|nuclear|military|deploy|naval|carrier|drone|IRGC|Houthi|Hezbollah|IDF|Pentagon|CENTCOM|strait|blockade|proxy|invasion|annex|occupation|incursion|FX|forex|currency|currencies|USD|EUR|GBP|JPY|CNY|CHF|AUD|CAD|NZD|DXY|dollar|euro|yen|yuan|sterling|cable|carry\s+trade|intervention|Fin\.?\s*Min|Finance\s+Minister|BOJ|BOC|SNB|RBA|RBNZ|Riksbank|Norges\s+Bank|monetary\s+policy|devaluat|revaluat|peg|depreciat|appreciat|Lagarde|Powell|Draghi|Villeroy|Nagel|Kazaks|Kazimir|Knot|Holzmann|Wunsch|Centeno|Rehn|Stournaras|Simkus|auction|bid-to-cover|spread|widen|reverse\s+repo|standing\s+facility|MRO|TLTRO|tapering|forward\s+guidance|terminal\s+rate|inversion|curve\s+steepener|curve\s+flattener|real\s+yield|breakeven|TIPS|OIS|dot\s+plot|SEP|dissent|minutes|jawboning|refunding|QRA|bill\s+issuance|coupon|fixing|LIBOR|SOFR|ESTR|SONIA|TONAR|Nikkei|Hang\s+Seng|Topix|CSI|DAX|CAC|FTSE|IBEX|MIB|buyback|dividend|guidance\s+cut|guidance\s+raise|short\s+squeeze|gamma\s+squeeze|open\s+interest|skew|term\s+structure|contango|backwardation|inventory\s+draw|inventory\s+build|rig\s+count|crush\s+spread|crack\s+spread|heating\s+oil|gasoline|distillate|ISM|JOLTS|ADP|Challenger|Empire\s+State|Philly\s+Fed|Kansas\s+City\s+Fed|Dallas\s+Fed|Richmond\s+Fed|Beige\s+Book|core\s+PCE|supercore|trimmed\s+mean|Atlanta\s+Fed)\b/i;

// ── Platform ad / promo prefixes ───────────────────────────────────────────
// "FinancialJuice | ..." is their ad/promo format on X. Block at ingestion.
// [claude-code 2026-04-20] "Markets Wrap" / regional "Wrap" titles are Bloomberg
//   scheduled recaps, not catalysts. TP: these read like ads and drive dupe pushes.
// [claude-code 2026-04-20] Commodity/asset recap verbs — "Gold Steadies", "Oil Holds",
//   "Dollar Edges Lower" are color-commentary wraps, not catalysts. The verb signals
//   incremental non-actionable price movement. Only fires on known recap verbs at
//   sentence start so genuine breaking moves ("Gold Surges 5%") still pass.
const PLATFORM_AD_PATTERNS = [
  /FinancialJuice\s*\|/i,
  /financialjuice\.com/i,
  /\b(markets?|europe|asia|americas|global|us|u\.?s\.?)\s+wrap\b/i,
  // Commodity/asset recap headlines: "[Asset] [recap verb] as [color commentary]"
  /^(gold|oil|silver|copper|crude|brent|wti|dollar|euro|yen|sterling|treasur(?:y|ies)|bonds?)\s+(steadies|steady|holds?|edges?|drifts?|flat(?:tens?)?|little changed|barely moved?|muted|subdued|treads?\s+water|hovers?|lingers?|consolidates?|pares?|trims?|retreats?\s+from)\b/i,
];

// ── Scraper artifact / bot-check / error page detection ───────────────────
// When a source scrapes a URL and hits a captcha, paywall, or error page,
// the page title becomes the headline. These are NEVER real news.
// Checked against headline only (not body) to prevent body keywords from
// overriding the market-relevance gate.
const SCRAPER_ARTIFACT_PATTERNS = [
  /are you a robot/i,
  /are you human/i,
  /verify you are (a )?human/i,
  /captcha/i,
  /access denied/i,
  /403 forbidden/i,
  /404 not found/i,
  /page not found/i,
  /checking your browser/i,
  /enable javascript/i,
  /just a moment/i, // Cloudflare challenge page
  /attention required/i, // Cloudflare
  /please wait while we verify/i,
  /subscribe to (continue|read|access)/i,
  /sign in to (continue|read|access)/i,
  /log in to (continue|read|access)/i,
  /you('ve| have) been blocked/i,
  /too many requests/i,
  /rate limit/i,
  // [claude-code 2026-04-26] .gov throttle pages — SEC EDGAR, Federal Reserve,
  // BLS, BEA, etc. all serve these when a poller hits ratelimit. Headline
  // shape: "<Domain> | Request Rate Threshold Exceeded" / "Your access has
  // been blocked" / "undeclared automated tools".
  /request rate threshold exceeded/i,
  /undeclared automated tools/i,
  /your request rate has triggered/i,
  /your access has been blocked/i,
  /service unavailable/i,
  /502 bad gateway/i,
  /503 service/i,
  /connection timed? ?out/i,
  /unexpected error/i,
  /something went wrong/i,
  /we('re| are) sorry/i,
  /this page isn't available/i,
  /content is not available/i,
];

// ── Emdash rant detection ──────────────────────────────────────────────────
// Opinion posts separated by emdashes (U+2014) are a common X rant pattern.
// Block when no market keywords present — legit wire headlines don't use emdashes.
function isEmdashRant(text: string): boolean {
  const emdashCount = (text.match(/\u2014/g) || []).length;
  if (emdashCount < 1) return false;
  if (MARKET_KEYWORDS.test(text)) return false;
  return true;
}

// ── Sarcastic "genius" detection ───────────────────────────────────────────
// Catches sarcastic political posts like: "So now it's 'genius' to choke Hormuz"
const POLITICAL_FIGURES =
  /\b(Trump|Biden|Obama|Kamala|AOC|Pelosi|McConnell|DeSantis|Bessent|Rubio|Vance)\b/i;

function isSarcasticGenius(text: string): boolean {
  if (!/\b"?genius"?\b/i.test(text)) return false;
  if (!POLITICAL_FIGURES.test(text)) return false;
  if (MARKET_KEYWORDS.test(text)) return false;
  return true;
}

// ── Political opinion / rant detection ─────────────────────────────────────
// Clean-language rants that slip through profanity and political spam filters.
// These are opinion commentary, not wire news or market-moving statements.
const POLITICAL_RANT_PATTERNS = [
  // Emotional political language with no market content
  /\b(demon|demonic|evil|satan|antichrist)\b.*\b(president|white house|government|power|seat)\b/i,
  /\b(president|white house|government|power|seat)\b.*\b(demon|demonic|evil|satan|antichrist)\b/i,
  // Calls for violence / regime change (non-geopolitical context)
  /\bneed[s]?\s+(a\s+)?new\s+(form\s+of\s+)?government\b/i,
  /\bfire\s+a\s+missile\s+at\b/i,
  /\bend\s+this\s+once\s+and\s+for\s+all\b/i,
  // "Nobody wants to see X back" / nostalgia rants
  /\bnobody\s+(ever\s+)?wants?\s+to\s+see\b.*\bback\b/i,
  // Alex Jones / InfoWars / conspiracy media
  /\bAlex\s+Jones\b/i,
  /\bInfoWar[s]?\b/i,
  /\bJerome\s+Corsi\b/i,
  /\bPrisonPlanet\b/i,
  // "Hidden mirrors" / cryptic non-financial metaphors
  /\bhidden\s+all\s+the\s+mirrors\b/i,
  // Extinction / apocalypse + politics (not geopolitical)
  /\b(extinction|end\s+of\s+(the\s+)?world|apocalypse|human\s+race)\b.*\b(white house|president|government|obama|trump)\b/i,
  // Generic "world's problems will be solved" rant
  /\bworld'?s\s+\d+%\s+problems?\s+will\s+be\s+solved\b/i,
];

function isPoliticalRant(text: string): boolean {
  // Only fire if there are NO market keywords (legit geopolitical wire can sound dramatic)
  if (MARKET_KEYWORDS.test(text)) return false;
  return POLITICAL_RANT_PATTERNS.some((p) => p.test(text));
}

// ── Drunk / incoherent text ─────────────────────────────────────────────────
function isDrunkText(text: string): boolean {
  let signals = 0;

  // Excessive caps ratio (>60% caps in text with 20+ alpha chars)
  const alphaChars = text.replace(/[^a-zA-Z]/g, "");
  if (alphaChars.length >= 20) {
    const capsRatio =
      alphaChars.replace(/[^A-Z]/g, "").length / alphaChars.length;
    if (capsRatio > 0.6) signals++;
  }

  // Repeated characters (4+ of same char): "yesssss", "nooooo"
  if (/(.)\1{3,}/i.test(text)) signals++;

  // Excessive exclamation/question marks (3+)
  if (/[!?]{3,}/.test(text)) signals++;

  // Very short text with no substance (under 30 chars, no financial keywords)
  if (
    text.length < 30 &&
    !/\b(fed|cpi|ppi|gdp|nfp|fomc|tariff|rate|yield|treasury|earnings|vix|opec|sanctions?|missile|war)\b/i.test(
      text,
    )
  )
    signals++;

  // Excessive emoji count (5+)
  const emojiCount = (
    text.match(
      /[\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ) || []
  ).length;
  if (emojiCount >= 5) signals++;

  return signals >= 2;
}

// ── @ Mention / RT detection ────────────────────────────────────────────────
function isAtMentionOrRT(text: string): boolean {
  const trimmed = text.trim();
  // Starts with @user — reply
  if (/^@\w+/.test(trimmed)) return true;
  // Starts with RT — retweet
  if (/^RT\s+@/i.test(trimmed)) return true;
  // Any @ mention anywhere — not a professional wire headline
  if (/@\w+/.test(trimmed)) return true;
  // Any RT prefix
  if (/^RT\b/i.test(trimmed)) return true;
  return false;
}

// ── Emoji filter ────────────────────────────────────────────────────────────
// Only FJ severity emojis (🔴⚠️🚨🟡🟠🔵⭕) are allowed. Any other emoji = noise.
const FJ_ALLOWED_EMOJIS = new Set(["🔴", "⭕", "⚠️", "🚨", "🟠", "🟡", "🔵"]);

function hasNonFJEmojis(text: string): boolean {
  const allEmojis =
    text.match(
      /[\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1F300}-\u{1F5FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu,
    ) || [];
  if (allEmojis.length === 0) return false;
  // If ALL emojis are FJ severity indicators, allow
  return allEmojis.some((e) => !FJ_ALLOWED_EMOJIS.has(e));
}

// ── "false" prefix ──────────────────────────────────────────────────────────
// Items starting with "false" are fact-check / debunk content, not wire news.
function startsWithFalse(text: string): boolean {
  return /^\s*false\b/i.test(text);
}

// ── Non-financial government agencies ───────────────────────────────────────
// These agencies generate noise headlines (drug busts, immigration raids, safety
// recalls, weather alerts) that aren't market-moving unless paired with a real
// financial keyword. Block if the headline is ABOUT the agency but has no
// market relevance. Agencies that ARE market-relevant (SEC, CFTC, DOJ, Fed,
// DOE/EIA, Pentagon) are in MARKET_KEYWORDS and will pass through.
const NON_FINANCIAL_AGENCIES =
  /\b(DEA|DEI|ICE\b(?!\s*(?:futures|crude|brent))|ATF|TSA|CBP|FEMA|CDC|HHS|VA\b(?!\s*(?:stock|shares|rating))|USPS|USCIS|Secret\s+Service|FBI\b(?!\s*(?:raid|seiz|probe|investigat|charg)\w*\s+(?:crypto|bank|fund|hedge|trader|fraud|insider|securities|exchange))|EPA\b(?!\s*(?:regulat|rule|compliance|emission|carbon|fine|penalt))|FDA\b(?!\s*(?:approv|reject|clear|fast\s*track|breakthrough|panel|advisory|recall|warning|drug|pharma|biotech|EUA)))\b/i;

function isNonFinancialAgencyNoise(text: string): boolean {
  if (!NON_FINANCIAL_AGENCIES.test(text)) return false;
  // If it ALSO has market keywords, let it through (e.g. "FDA approves" or "EPA regulation")
  if (MARKET_KEYWORDS.test(text)) return false;
  return true;
}

// ── Market relevance gate ───────────────────────────────────────────────────
// If a headline has ZERO financial/market keywords, it's noise.
// This catches the "White House UFC" / "Obama" / comedy podcast garbage that
// slips through because it doesn't trigger slur/profanity/political patterns.

function lacksMarketRelevance(text: string): boolean {
  // If it has ANY market keyword, it's potentially relevant
  if (MARKET_KEYWORDS.test(text)) return false;
  // No market keywords = noise, regardless of length
  return true;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ContentGuardResult {
  blocked: boolean;
  reason: string | null;
  speculationDemote?: boolean;
}

export interface ContentGuardOpts {
  sourceType?: string;
  ingestPipeline?: string;
}

/**
 * Run all content guards on a headline/body.
 * Returns { blocked: true, reason } if the item should be dropped.
 * Call this BEFORE writing to raw_riskflow_items.
 */
// [claude-code 2026-04-26] Domain-only mainstream-media ban per TP:
//   "We just DO NOT want shit pulled from their website. Same goes for Reuters
//    & Bloomberg too." Text mentions in curated Twitter relays are fine —
//    Walter Bloomberg / DeItaone / etc. routinely quote wire headlines, and
//    those should pass through.
//
// Pipeline hierarchy:
//   1. Twitter handles designated in the Refinement Engine (primary intake)
//   2. .gov + bank research desks via the news-worker web-allowlist
//   3. Everything else dropped
//
// This list is the defense-in-depth — if the allowlist somehow lets a rehost
// or redirect through, the URL/host pattern catches it.
const BANNED_DOMAIN_PATTERNS: RegExp[] = [
  // Wires
  /(^|\.)reuters\.com$/i,
  /(^|\.)bloomberg\.com$/i,
  /(^|\.)bloomberglaw\.com$/i,
  /(^|\.)bloombergquint\.com$/i,
  // US cable / network
  /(^|\.)cnbc\.com$/i,
  /(^|\.)foxnews\.com$/i,
  /(^|\.)foxbusiness\.com$/i,
  /(^|\.)msnbc\.com$/i,
  /(^|\.)nbcnews\.com$/i,
  /(^|\.)abcnews\.go\.com$/i,
  /(^|\.)cbsnews\.com$/i,
  /(^|\.)cnn\.com$/i,
  // US prestige / general
  /(^|\.)nytimes\.com$/i,
  /(^|\.)washingtonpost\.com$/i,
  /(^|\.)usatoday\.com$/i,
  /(^|\.)huffpost\.com$/i,
  /(^|\.)huffingtonpost\.com$/i,
  /(^|\.)buzzfeed\.com$/i,
  /(^|\.)buzzfeednews\.com$/i,
  /(^|\.)vox\.com$/i,
  // Tabloid / opinion noise
  /(^|\.)thedailybeast\.com$/i,
  /(^|\.)newsweek\.com$/i,
  /(^|\.)dailymail\.co\.uk$/i,
  // Finance noise
  /(^|\.)marketwatch\.com$/i,
  /(^|\.)finance\.yahoo\.com$/i,
  /(^|\.)yahoo\.com$/i,
  /(^|\.)seekingalpha\.com$/i,
  /(^|\.)fool\.com$/i,
  /(^|\.)barrons\.com$/i,
  /(^|\.)benzinga\.com$/i,
  /(^|\.)zerohedge\.com$/i,
  /(^|\.)investopedia\.com$/i,
  // International prestige
  /(^|\.)bbc\.co\.uk$/i,
  /(^|\.)bbc\.com$/i,
  /(^|\.)theguardian\.com$/i,
  /(^|\.)ft\.com$/i,
  /(^|\.)economist\.com$/i,
  /(^|\.)aljazeera\.com$/i,
  /(^|\.)abc\.net\.au$/i,
  // Scoop outlets — domain-banned per TP "we DO NOT want shit pulled from
  // their website" — but their content reaching us via curated Twitter is OK.
  /(^|\.)axios\.com$/i,
  /(^|\.)politico\.com$/i,
  /(^|\.)semafor\.com$/i,
  /(^|\.)businessinsider\.com$/i,
  /(^|\.)insider\.com$/i,
  /(^|\.)theinformation\.com$/i,
  /(^|\.)punchbowl\.news$/i,
  /(^|\.)puck\.news$/i,
  // Other outlets explicitly cited as noise
  /(^|\.)dailywire\.com$/i,
  /(^|\.)newsmax\.com$/i,
  /(^|\.)oann\.com$/i,
  /(^|\.)motherjones\.com$/i,
  /(^|\.)slate\.com$/i,
  /(^|\.)salon\.com$/i,
  /(^|\.)thehill\.com$/i,
  /(^|\.)npr\.org$/i,
  /(^|\.)pbs\.org$/i,
];

function extractHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase().replace(/^www\./, "");
  }
}

export interface BannedPublisherProbe {
  text?: string;
  url?: string | null;
  tags?: string[];
}

export function isBannedPublisher(probe: BannedPublisherProbe): boolean {
  // URL host check — primary domain match.
  if (probe.url) {
    const host = extractHost(probe.url);
    if (BANNED_DOMAIN_PATTERNS.some((p) => p.test(host))) return true;
  }
  // Tags often carry `source_domain` from the news-worker; the Twitter
  // pipeline carries handle metadata that won't match these patterns.
  for (const tag of probe.tags ?? []) {
    const tagHost = tag.startsWith("url:")
      ? extractHost(tag.slice(4))
      : tag.toLowerCase().replace(/^www\./, "");
    if (BANNED_DOMAIN_PATTERNS.some((p) => p.test(tagHost))) return true;
  }
  return false;
}

export function checkContentGuard(text: string): ContentGuardResult {
  // [claude-code 2026-04-26] Banned-publisher check moved off the text scanner —
  // we no longer phrase-block mainstream-media mentions. Curated Twitter relays
  // can quote a Reuters/Bloomberg headline freely. Use isBannedPublisher() for
  // the URL/host gate at the news-worker layer.

  // 0. Platform ads / promos — fast reject before anything else
  for (const pattern of PLATFORM_AD_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "platform-ad" };
    }
  }

  // 0b. Scraper artifacts — bot-checks, paywalls, error pages
  // These are page titles from failed scrapes, never real headlines.
  for (const pattern of SCRAPER_ARTIFACT_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "scraper-artifact" };
    }
  }

  // 1. Slurs — hardest block
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "slur" };
    }
  }

  // 2. Junk language / profanity
  for (const pattern of JUNK_LANGUAGE_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "junk-language" };
    }
  }

  // 3. Political spam
  for (const pattern of POLITICAL_SPAM_PATTERNS) {
    if (pattern.test(text)) {
      return { blocked: true, reason: "political-spam" };
    }
  }

  // 3b. Political rants (clean-language opinion pieces, conspiracy media)
  if (isPoliticalRant(text)) {
    return { blocked: true, reason: "political-rant" };
  }

  // 3c. Emdash rants — opinion takes separated by emdashes, no market content
  if (isEmdashRant(text)) {
    return { blocked: true, reason: "emdash-rant" };
  }

  // 3d. Sarcastic "genius" + political figure, no market content
  if (isSarcasticGenius(text)) {
    return { blocked: true, reason: "sarcastic-genius" };
  }

  // 4. @ mention or RT — not professional wire content
  if (isAtMentionOrRT(text)) {
    return { blocked: true, reason: "at-mention-or-rt" };
  }

  // 5. Non-FJ emojis — professional wire headlines don't have 😂🔥💀
  if (hasNonFJEmojis(text)) {
    return { blocked: true, reason: "non-fj-emoji" };
  }

  // 6. "false" prefix — fact-check/debunk, not wire news
  if (startsWithFalse(text)) {
    return { blocked: true, reason: "false-prefix" };
  }

  // 7. Non-financial government agencies (DEA, DEI, ICE, ATF, TSA, etc.)
  if (isNonFinancialAgencyNoise(text)) {
    return { blocked: true, reason: "non-financial-agency" };
  }

  // 8. Market relevance — no financial keywords = noise
  if (lacksMarketRelevance(text)) {
    return { blocked: true, reason: "no-market-relevance" };
  }

  // 9. Drunk / incoherent
  if (isDrunkText(text)) {
    return { blocked: true, reason: "incoherent" };
  }

  return { blocked: false, reason: null };
}

/**
 * Filter an array of items with a text accessor.
 * Returns only items that pass the content guard.
 * Logs blocked items for audit trail.
 */
export function filterWithContentGuard<T>(
  items: T[],
  getText: (item: T) => string,
  opts?: { source?: string; getSource?: (item: T) => string | undefined },
): T[] {
  const passed: T[] = [];
  let blockedCount = 0;
  const blockedReasons: Record<string, number> = {};

  for (const item of items) {
    const text = getText(item);
    const result = checkContentGuard(text);
    if (result.blocked) {
      blockedCount++;
      blockedReasons[result.reason!] =
        (blockedReasons[result.reason!] || 0) + 1;
      const itemSource = opts?.getSource?.(item) || opts?.source || "unknown";
      bumpCounter(itemSource, "content-guard", result.reason || "unknown");
    } else {
      passed.push(item);
    }
  }

  if (blockedCount > 0) {
    log.info(
      `Blocked ${blockedCount}/${items.length} items: ${JSON.stringify(blockedReasons)}`,
    );
  }

  return passed;
}
