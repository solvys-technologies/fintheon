// [claude-code 2026-04-19] Catalyst tag rendering utility. Raw tags like
// `url:https://bloomberg.com/...` used to render as a long ugly hashtag chip
// that spanned the card width. This helper partitions tags into:
//   - a single primary link (if any `url:` tag exists) → rendered as a paperclip
//   - the remaining category tags → rendered as normal hashtag chips
// Timeline and Catalyst cards share this so the treatment is consistent.

import type { CSSProperties, ReactNode } from "react";
import { Link as LinkIcon } from "lucide-react";

const URL_PREFIX = "url:";

export interface TagPartition {
  linkHref: string | null;
  categoryTags: string[];
}

export function partitionCatalystTags(
  tags: string[] | null | undefined,
): TagPartition {
  if (!tags || tags.length === 0) {
    return { linkHref: null, categoryTags: [] };
  }
  let linkHref: string | null = null;
  const categoryTags: string[] = [];
  for (const raw of tags) {
    const tag = typeof raw === "string" ? raw.trim() : "";
    if (!tag) continue;
    const lower = tag.toLowerCase();
    if (lower.startsWith(URL_PREFIX) || lower.startsWith(`#${URL_PREFIX}`)) {
      if (!linkHref) {
        const cleaned = tag.replace(/^#/, "").slice(URL_PREFIX.length).trim();
        if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) {
          linkHref = cleaned;
        }
      }
      continue;
    }
    categoryTags.push(tag.replace(/^#/, ""));
  }
  return { linkHref, categoryTags };
}

interface CatalystLinkChipProps {
  href: string;
  color?: string;
  background?: string;
  size?: number;
  label?: string;
  style?: CSSProperties;
}

export function CatalystLinkChip({
  href,
  color = "var(--fintheon-accent)",
  background = "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
  size = 10,
  label = "link",
  style,
}: CatalystLinkChipProps): ReactNode {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={href}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono transition-colors hover:brightness-125"
      style={{
        color,
        backgroundColor: background,
        fontSize: size,
        textDecoration: "none",
        ...style,
      }}
    >
      <LinkIcon size={Math.max(8, size - 1)} strokeWidth={2} />
      <span>{label}</span>
    </a>
  );
}
