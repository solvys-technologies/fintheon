// [claude-code 2026-04-25] S35: Shared image+source-handoff primitive used by every
// expanded RiskFlow / catalyst surface (RiskFlowDetailCard, RiskFlowMini, Sanctum
// catalyst cards, NarrativeCanvas). Hides on load error so a broken image never
// breaks card layout. Click opens the source URL in a new tab — the canonical
// handoff to the original article.
import type { CSSProperties } from "react";

interface CatalystImageProps {
  imageUrl?: string | null;
  /** Falls back to imageUrl if not supplied. Used for the click-through. */
  href?: string | null;
  alt?: string;
  /** Cap the rendered height so we don't blow out compact cards. */
  maxHeight?: number;
  className?: string;
  style?: CSSProperties;
}

export function CatalystImage({
  imageUrl,
  href,
  alt = "",
  maxHeight = 192,
  className = "",
  style,
}: CatalystImageProps) {
  if (!imageUrl) return null;
  const target = href ?? imageUrl;
  return (
    <a
      href={target}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`block overflow-hidden border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] ${className}`}
      style={style}
    >
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => {
          const wrapper = e.currentTarget.parentElement as HTMLElement | null;
          if (wrapper) wrapper.style.display = "none";
        }}
        style={{
          width: "100%",
          maxHeight,
          objectFit: "contain",
          display: "block",
        }}
      />
    </a>
  );
}

interface SourceHandoffLinkProps {
  url?: string | null;
  /** Display label — defaults to the hostname. */
  label?: string | null;
  className?: string;
}

export function SourceHandoffLink({
  url,
  label,
  className = "",
}: SourceHandoffLinkProps) {
  if (!url) return null;
  let host = label ?? url;
  if (!label) {
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      host = url;
    }
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)] hover:underline ${className}`}
    >
      {host}
      <span aria-hidden style={{ fontSize: "0.85em" }}>
        ↗
      </span>
    </a>
  );
}
