export const BULLETIN_WATCHLIST_STORAGE_KEY =
  "fintheon.bulletinWatchlist.enabledNarratives";

export const DESK_NARRATIVES = [
  {
    slug: "middle-east-conflict",
    title: "Middle East",
    color: "#EF4444",
    keywords: ["iran", "israel", "gaza", "houthi", "red sea"],
  },
  {
    slug: "liquidity-credit-contraction",
    title: "Liquidity",
    color: "#A855F7",
    keywords: ["liquidity", "credit", "spread", "default", "bank"],
  },
  {
    slug: "ai-singularity",
    title: "AI",
    color: "#14B8A6",
    keywords: ["ai", "nvidia", "gpu", "openai", "semiconductor"],
  },
  {
    slug: "usd-jpy-carry-trade",
    title: "Carry Trade",
    color: "#A855F7",
    keywords: ["yen", "jpy", "boj", "carry trade", "usdjpy"],
  },
  {
    slug: "trade-war",
    title: "Trade War",
    color: "#EF4444",
    keywords: ["tariff", "trade war", "reciprocal", "customs"],
  },
  {
    slug: "us-china-relations",
    title: "US-China",
    color: "#A855F7",
    keywords: ["china", "beijing", "huawei", "tiktok", "yuan"],
  },
  {
    slug: "rate-cut-cycle",
    title: "Rate Cuts",
    color: "#EAB308",
    keywords: ["rate cut", "fomc", "powell", "dovish", "basis points"],
  },
  {
    slug: "trump-presidency",
    title: "Trump",
    color: "#EF4444",
    keywords: ["trump", "white house", "bessent", "vance"],
  },
  {
    slug: "price-stability",
    title: "Inflation",
    color: "#EAB308",
    keywords: ["cpi", "ppi", "pce", "inflation", "price stability"],
  },
  {
    slug: "maximum-employment",
    title: "Employment",
    color: "#EAB308",
    keywords: ["nfp", "jobs", "payroll", "jobless", "labor"],
  },
] as const;

export function enrichPost(post: BulletinPost): EnrichedPost {
  return { ...post, narratives: inferNarratives(post) };
}

export function isVisibleForZen(post: EnrichedPost, enabled: Set<string>): boolean {
  if (post.narratives.length === 0) return true;
  return post.narratives.some((slug) => enabled.has(slug));
}

export function readEnabledNarratives(): Set<string> {
  const all = DESK_NARRATIVES.map((item) => item.slug);
  try {
    const raw = localStorage.getItem(BULLETIN_WATCHLIST_STORAGE_KEY);
    if (!raw) return new Set(all);
    const parsed = JSON.parse(raw);
    const slugs = normalizeSlugs(parsed);
    return new Set(slugs.length > 0 ? slugs : all);
  } catch {
    return new Set(all);
  }
}

export function writeEnabledNarratives(value: Set<string>) {
  localStorage.setItem(BULLETIN_WATCHLIST_STORAGE_KEY, JSON.stringify([...value]));
}

export function readZenMode(): boolean {
  return document.body.dataset.fintheonZenMode === "true";
}

export function toPost(value: unknown): BulletinPost {
  const item = isObject(value) ? value : {};
  return {
    id: String(item.id ?? crypto.randomUUID()),
    authorAgent: typeof item.authorAgent === "string" ? item.authorAgent : null,
    content: String(item.content ?? ""),
    contentParts: Array.isArray(item.contentParts) ? item.contentParts : [],
    createdAt: String(item.createdAt ?? new Date().toISOString()),
  };
}

export function formatBulletinTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function inferNarratives(post: BulletinPost): string[] {
  const metadata = readNarrativeMetadata(post.contentParts);
  if (metadata.length > 0) return metadata;
  const tagged = readNarrativeTags(post.content);
  if (tagged.length > 0) return tagged;
  const lower = post.content.toLowerCase();
  return DESK_NARRATIVES.filter((narrative) =>
    narrative.keywords.some((keyword) => lower.includes(keyword)),
  ).map((narrative) => narrative.slug);
}

function readNarrativeMetadata(parts: unknown[]): string[] {
  for (const part of parts) {
    if (!isObject(part) || !isObject(part.data)) continue;
    const value =
      part.data.narrativeThreads ?? part.data.narratives ?? part.data.narrative;
    const slugs = normalizeSlugs(value);
    if (slugs.length > 0) return slugs;
  }
  return [];
}

function readNarrativeTags(content: string): string[] {
  const match = content.match(/\[narratives?:\s*([^\]]+)\]/i);
  if (!match) return [];
  return normalizeSlugs(match[1].split(","));
}

function normalizeSlugs(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? [value]
      : [];
  return list
    .map((item) => String(item).trim())
    .filter((slug) => DESK_NARRATIVES.some((n) => n.slug === slug));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export interface BulletinPost {
  id: string;
  authorAgent: string | null;
  content: string;
  contentParts: unknown[];
  createdAt: string;
}

export interface EnrichedPost extends BulletinPost {
  narratives: string[];
}
