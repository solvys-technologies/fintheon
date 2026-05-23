import type { ProxVoiceSocialLinks } from "./types.js";

const SOCIAL_KEYS = ["x", "substack", "telegram", "discord"] as const;

function cleanHandle(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/^@+/, "");
  if (!trimmed) return undefined;
  return trimmed.slice(0, 80);
}

export function normalizeSocialLinks(input: unknown): ProxVoiceSocialLinks {
  if (!input || typeof input !== "object") return {};
  const source = input as Record<string, unknown>;
  const links: ProxVoiceSocialLinks = {};
  for (const key of SOCIAL_KEYS) {
    const value = cleanHandle(source[key]);
    if (value) links[key] = value;
  }
  return links;
}

export function socialUrl(key: keyof ProxVoiceSocialLinks, handle: string) {
  const safe = handle.replace(/^@+/, "").trim();
  if (key === "x") return `https://x.com/${safe}`;
  if (key === "substack") {
    return safe.includes(".") ? `https://${safe}` : `https://${safe}.substack.com`;
  }
  if (key === "telegram") return `https://t.me/${safe}`;
  return null;
}
