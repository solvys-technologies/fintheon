// [claude-code 2026-04-26] Allowlist for non-Twitter web ingest. Per TP:
// "ONLY government sites, and OFFICIAL bank reports straight from the banks
// research desk. Everything else should come from the twitter sources that
// I DESIGNATE in the settings [Refinement Engine]."
//
// Used by the Exa collector to constrain `includeDomains` and by persist.ts
// as a defense-in-depth gate so even hand-supplied URLs in browser-harness
// can't smuggle in CNBC / Yahoo Finance / etc.

const GOV_DOMAINS = [
  // US executive + legislative
  "federalreserve.gov",
  "treasury.gov",
  "sec.gov",
  "cftc.gov",
  "bls.gov",
  "bea.gov",
  "census.gov",
  "congress.gov",
  "whitehouse.gov",
  "state.gov",
  "defense.gov",
  "fdic.gov",
  "occ.gov",
  "consumerfinance.gov",
  "fhfa.gov",
  "trade.gov",
  // US Fed regional banks
  "newyorkfed.org",
  "frbatlanta.org",
  "bostonfed.org",
  "chicagofed.org",
  "clevelandfed.org",
  "dallasfed.org",
  "kansascityfed.org",
  "minneapolisfed.org",
  "philadelphiafed.org",
  "richmondfed.org",
  "stlouisfed.org",
  "frbsf.org",
  // International central banks + regulators
  "ecb.europa.eu",
  "bankofengland.co.uk",
  "boj.or.jp",
  "bankofcanada.ca",
  "rba.gov.au",
  "rbnz.govt.nz",
  "snb.ch",
  "bundesbank.de",
  "banque-france.fr",
  "bancaditalia.it",
  "bde.es",
  "imf.org",
  "worldbank.org",
  "bis.org",
  "oecd.org",
  // Wider .gov / .gov.uk / .gov.eu catch-alls handled in isAllowedWebDomain.
];

const BANK_RESEARCH_DOMAINS = [
  // Bulge bracket
  "goldmansachs.com",
  "gs.com",
  "jpmorgan.com",
  "jpmorganchase.com",
  "morganstanley.com",
  "bofa.com",
  "bofaml.com",
  "merrilledge.com",
  "ml.com",
  "citigroup.com",
  "citi.com",
  "ubs.com",
  "barclays.com",
  "barclayscapital.com",
  "hsbc.com",
  "hsbcnet.com",
  "db.com",
  "deutsche-bank.com",
  "credit-suisse.com",
  "creditsuisse.com",
  "nomura.com",
  "nomuraconnects.com",
  "mizuho-sc.com",
  "mizuhogroup.com",
  // Canada
  "cibc.com",
  "scotiabank.com",
  "td.com",
  "tdsecurities.com",
  "rbc.com",
  "rbcgam.com",
  "bmocm.com",
  // Asset managers w/ macro research desks
  "blackrock.com",
  "pimco.com",
  "vanguard.com",
  "schwab.com",
  "fidelity.com",
  "tradestation.com",
  "wellington.com",
  "brk.com",
  "berkshirehathaway.com",
  // Macro research houses
  "ned-davis.com",
  "ndr.com",
  "yardeni.com",
  "rhg.com",
  "alpinemacro.com",
];

export const ALLOWED_WEB_DOMAINS = new Set<string>([
  ...GOV_DOMAINS,
  ...BANK_RESEARCH_DOMAINS,
]);

function normalizeHost(host: string): string {
  return host.replace(/^www\./, "").toLowerCase();
}

/** Returns true if the host belongs to a sanctioned web source for non-Twitter
 *  ingest. Matches exact entries plus any *.gov / *.gov.uk / *.gov.au / *.gc.ca
 *  catch-alls (covers Treasury subdomains, Fed regional, etc.) */
export function isAllowedWebDomain(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = normalizeHost(host);
  if (ALLOWED_WEB_DOMAINS.has(h)) return true;
  // Subdomain match against the allow-list.
  for (const allowed of ALLOWED_WEB_DOMAINS) {
    if (h === allowed || h.endsWith("." + allowed)) return true;
  }
  // Catch-alls for governments worldwide.
  if (/(^|\.)gov(\.[a-z]{2,3})?$/.test(h)) return true;
  if (/\.gc\.ca$/.test(h)) return true;
  return false;
}

/** Allowlist as a flat array for Exa's includeDomains parameter. */
export const ALLOWED_WEB_DOMAINS_LIST: string[] = [...ALLOWED_WEB_DOMAINS];
