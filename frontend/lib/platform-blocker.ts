import type { ProposerIframeSource } from "../contexts/SettingsContext";

export type BlockerQuickTargetMode = "platform" | "link";

export interface BlockerQuickTarget {
  mode: BlockerQuickTargetMode;
  platformId: string;
  url: string;
}

export interface BlockerSettings {
  quickTarget: BlockerQuickTarget;
  customDomains: string[];
}

export interface BlockerStatus {
  blocked: boolean;
  layers: {
    hosts: boolean;
    resolver: boolean;
    runtime?: boolean;
    helper?: boolean;
  };
  helper?: BlockerHelperStatus;
  domains?: string[];
}

export interface BlockerHelperStatus {
  ok: boolean;
  installed: boolean;
  running: boolean;
  blocked?: boolean;
  reason?: string;
}

export interface BlockerApi {
  enable: () => Promise<unknown>;
  enableFast: () => Promise<unknown>;
  disable: () => Promise<unknown>;
  disableFast?: () => Promise<unknown>;
  getStatus: () => Promise<BlockerStatus>;
  getHelperStatus?: () => Promise<BlockerHelperStatus>;
  installHelper?: () => Promise<BlockerHelperStatus>;
  getDomains: () => Promise<{ domains: string[] }>;
  setDomains: (
    domains: string[],
  ) => Promise<{ ok: boolean; domains?: string[]; reason?: string }>;
}

export interface ResolvedBlockerTarget {
  label: string;
  url: string;
  domains: string[];
}

export const BLOCKER_QUICK_TARGET_STORAGE_KEY = "fintheon:blocker-quick-target";
export const BLOCKER_CUSTOM_DOMAINS_STORAGE_KEY =
  "fintheon:blocker-custom-domains";
export const DEFAULT_BLOCKER_PLATFORM_ID = "topstepx";
const BLOCKER_SETTINGS_VERSION_STORAGE_KEY =
  "fintheon:blocker-settings-version";
const CURRENT_BLOCKER_SETTINGS_VERSION = "2";

export function createDefaultBlockerQuickTarget(): BlockerQuickTarget {
  return {
    mode: "platform",
    platformId: DEFAULT_BLOCKER_PLATFORM_ID,
    url: "",
  };
}

export function coerceBlockerQuickTarget(value: unknown): BlockerQuickTarget {
  const fallback = createDefaultBlockerQuickTarget();
  if (!value || typeof value !== "object") return fallback;
  const parsed = value as Partial<BlockerQuickTarget>;
  if (parsed.mode !== "platform") return fallback;
  const platformId =
    typeof parsed.platformId === "string" && parsed.platformId.trim()
      ? parsed.platformId
      : DEFAULT_BLOCKER_PLATFORM_ID;
  return { mode: "platform", platformId, url: "" };
}

export function coerceBlockerCustomDomains(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return mergeDomainLists(value.filter((item) => typeof item === "string"));
}

export function getBlockerApi(): BlockerApi | null {
  const e = window as unknown as { electron?: { blocker?: BlockerApi } };
  return e.electron?.blocker ?? null;
}

export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, "");
  s = s.replace(/\/.*$/, "");
  s = s.replace(/^www\./, "");
  if (!s.includes(".") || s.endsWith(".")) return null;
  return s;
}

export function domainsFromUrl(rawUrl: string): string[] {
  if (!rawUrl) return [];
  try {
    const withProtocol = /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;
    const host = new URL(withProtocol).hostname;
    const normalized = normalizeDomain(host);
    if (!normalized) return [];
    return Array.from(new Set([normalized, `www.${normalized}`]));
  } catch {
    const normalized = normalizeDomain(rawUrl);
    return normalized
      ? Array.from(new Set([normalized, `www.${normalized}`]))
      : [];
  }
}

export function mergeDomainLists(...lists: string[][]): string[] {
  return Array.from(
    new Set(
      lists
        .flat()
        .map((domain) => normalizeDomain(domain))
        .filter((domain): domain is string => !!domain),
    ),
  ).sort();
}

function ensureBlockerSettingsDefaults() {
  try {
    const current = localStorage.getItem(BLOCKER_SETTINGS_VERSION_STORAGE_KEY);
    if (current === CURRENT_BLOCKER_SETTINGS_VERSION) return;
    localStorage.setItem(
      BLOCKER_QUICK_TARGET_STORAGE_KEY,
      JSON.stringify(createDefaultBlockerQuickTarget()),
    );
    localStorage.setItem(BLOCKER_CUSTOM_DOMAINS_STORAGE_KEY, "[]");
    localStorage.setItem(
      BLOCKER_SETTINGS_VERSION_STORAGE_KEY,
      CURRENT_BLOCKER_SETTINGS_VERSION,
    );
  } catch {
    /* localStorage may be unavailable */
  }
}

export function loadBlockerQuickTarget(): BlockerQuickTarget | null {
  ensureBlockerSettingsDefaults();
  try {
    const raw = localStorage.getItem(BLOCKER_QUICK_TARGET_STORAGE_KEY);
    if (!raw) return createDefaultBlockerQuickTarget();
    return coerceBlockerQuickTarget(JSON.parse(raw));
  } catch {
    return createDefaultBlockerQuickTarget();
  }
}

export function saveBlockerQuickTarget(target: BlockerQuickTarget) {
  const next =
    target.mode === "platform" && target.platformId
      ? { mode: "platform" as const, platformId: target.platformId, url: "" }
      : createDefaultBlockerQuickTarget();
  localStorage.setItem(BLOCKER_QUICK_TARGET_STORAGE_KEY, JSON.stringify(next));
  localStorage.setItem(
    BLOCKER_SETTINGS_VERSION_STORAGE_KEY,
    CURRENT_BLOCKER_SETTINGS_VERSION,
  );
  window.dispatchEvent(new Event("fintheon:blocker-quick-target-updated"));
}

export function loadBlockerCustomDomains(): string[] {
  ensureBlockerSettingsDefaults();
  try {
    const raw = localStorage.getItem(BLOCKER_CUSTOM_DOMAINS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return mergeDomainLists(parsed.filter((item) => typeof item === "string"));
  } catch {
    return [];
  }
}

export function saveBlockerCustomDomains(domains: string[]) {
  const next = mergeDomainLists(domains);
  localStorage.setItem(
    BLOCKER_CUSTOM_DOMAINS_STORAGE_KEY,
    JSON.stringify(next),
  );
  localStorage.setItem(
    BLOCKER_SETTINGS_VERSION_STORAGE_KEY,
    CURRENT_BLOCKER_SETTINGS_VERSION,
  );
  window.dispatchEvent(new Event("fintheon:blocker-custom-domains-updated"));
}

export function notifyBlockerStateUpdated() {
  window.dispatchEvent(new Event("fintheon:blocker-state-updated"));
}

export function resolveBlockerTarget({
  target,
  sources,
  selectedPlatform,
}: {
  target: BlockerQuickTarget | null;
  sources: ProposerIframeSource[];
  selectedPlatform: string;
}): ResolvedBlockerTarget | null {
  const targetPlatformId =
    target?.mode === "platform" && target.platformId
      ? target.platformId
      : selectedPlatform || DEFAULT_BLOCKER_PLATFORM_ID;
  const source =
    sources.find((item) => item.id === targetPlatformId) ??
    sources.find((item) => item.id === selectedPlatform) ??
    sources[0];
  if (!source?.url) return null;
  const domains = domainsFromUrl(source.url);
  if (domains.length === 0) return null;
  return { label: source.label, url: source.url, domains };
}

export function sameDomainSet(left: string[], right: string[]) {
  const a = mergeDomainLists(left);
  const b = mergeDomainLists(right);
  return (
    a.length === b.length && a.every((domain, index) => domain === b[index])
  );
}

export function domainSetsIntersect(left: string[], right: string[]) {
  const rightSet = new Set(mergeDomainLists(right));
  return mergeDomainLists(left).some((domain) => rightSet.has(domain));
}
