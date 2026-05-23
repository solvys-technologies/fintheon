import type { ProposerIframeSource } from "../contexts/SettingsContext";

export type BlockerQuickTargetMode = "platform" | "link";

export interface BlockerQuickTarget {
  mode: BlockerQuickTargetMode;
  platformId: string;
  url: string;
}

export interface BlockerStatus {
  blocked: boolean;
  layers: { hosts: boolean; resolver: boolean; runtime?: boolean };
  domains?: string[];
}

export interface BlockerApi {
  enable: () => Promise<unknown>;
  enableFast: () => Promise<unknown>;
  disable: () => Promise<unknown>;
  disableFast?: () => Promise<unknown>;
  getStatus: () => Promise<BlockerStatus>;
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

export const BLOCKER_QUICK_TARGET_STORAGE_KEY =
  "fintheon:blocker-quick-target";

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
    return normalized ? Array.from(new Set([normalized, `www.${normalized}`])) : [];
  }
}

export function loadBlockerQuickTarget(): BlockerQuickTarget | null {
  try {
    const raw = localStorage.getItem(BLOCKER_QUICK_TARGET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BlockerQuickTarget>;
    if (parsed.mode === "link") {
      return {
        mode: "link",
        platformId: typeof parsed.platformId === "string" ? parsed.platformId : "",
        url: typeof parsed.url === "string" ? parsed.url : "",
      };
    }
    return {
      mode: "platform",
      platformId: typeof parsed.platformId === "string" ? parsed.platformId : "",
      url: typeof parsed.url === "string" ? parsed.url : "",
    };
  } catch {
    return null;
  }
}

export function saveBlockerQuickTarget(target: BlockerQuickTarget) {
  localStorage.setItem(BLOCKER_QUICK_TARGET_STORAGE_KEY, JSON.stringify(target));
  window.dispatchEvent(new Event("fintheon:blocker-quick-target-updated"));
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
  if (target?.mode === "link" && target.url.trim()) {
    const domains = domainsFromUrl(target.url);
    if (domains.length === 0) return null;
    return { label: "Custom link", url: target.url.trim(), domains };
  }

  const targetPlatformId = target?.platformId || selectedPlatform;
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
  const a = [...new Set(left.map(normalizeDomain).filter(Boolean))].sort();
  const b = [...new Set(right.map(normalizeDomain).filter(Boolean))].sort();
  return a.length === b.length && a.every((domain, index) => domain === b[index]);
}
