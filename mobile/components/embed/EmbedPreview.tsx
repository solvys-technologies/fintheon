// [claude-code 2026-04-19] S25: peek window of the original post on news/catalyst detail modals.
//   Shapes: tweet iframe (platform.twitter.com), YouTube embed, or generic OG glass card.
//   Micro-interactions:
//     • shimmer skeleton while loading (respects prefers-reduced-motion)
//     • fade+lift-in when content settles
//     • tap opens source in new tab with subtle scale feedback
//     • errors fall back to a compact source-link glass pill
import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { useEmbedPreview } from "../../hooks/useEmbedPreview";

interface Props {
  url: string | null | undefined;
}

export function EmbedPreview({ url }: Props) {
  const { preview, isLoading, error } = useEmbedPreview(url);
  const reduceMotion = useReducedMotion();

  if (!url) return null;

  if (isLoading) {
    return <Skeleton reduceMotion={reduceMotion ?? false} />;
  }

  if (error || !preview) {
    return <FallbackLink url={url} />;
  }

  // Tweet: sandboxed iframe via platform.twitter.com (Twitter handles layout)
  if (preview.kind === "tweet" && preview.embedUrl) {
    return (
      <Shell>
        <iframe
          title="Tweet preview"
          src={preview.embedUrl}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          style={{
            width: "100%",
            minHeight: 240,
            border: "none",
            background: "transparent",
            display: "block",
          }}
        />
        <SourceChip
          siteName={preview.siteName ?? "X"}
          url={preview.url}
          favicon={preview.favicon}
        />
      </Shell>
    );
  }

  // YouTube: responsive 16:9 iframe embed
  if (preview.kind === "youtube" && preview.embedUrl) {
    return (
      <Shell>
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "56.25%",
            overflow: "hidden",
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        >
          <iframe
            title="YouTube preview"
            src={preview.embedUrl}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
          />
        </div>
        <SourceChip
          siteName={preview.siteName ?? "YouTube"}
          url={preview.url}
          favicon={preview.favicon}
        />
      </Shell>
    );
  }

  // Generic URL: OG card with hero image, title, description, source chip
  return (
    <Shell
      as="a"
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${preview.siteName ?? "source"}`}
    >
      {preview.image && (
        <motion.img
          src={preview.image}
          alt=""
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            display: "block",
            width: "100%",
            aspectRatio: "16 / 9",
            objectFit: "cover",
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
          }}
        />
      )}
      <div style={{ padding: "10px 14px 4px" }}>
        {preview.title && (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              lineHeight: 1.4,
              color: "var(--text-primary)",
              fontWeight: 600,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }}
          >
            {preview.title}
          </div>
        )}
        {preview.description && (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 12,
              lineHeight: 1.45,
              color: "var(--text-secondary)",
              marginTop: 4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as const,
              overflow: "hidden",
            }}
          >
            {preview.description}
          </div>
        )}
      </div>
      <SourceChip
        siteName={preview.siteName ?? new URL(preview.url).hostname}
        url={preview.url}
        favicon={preview.favicon}
      />
    </Shell>
  );
}

// ── Sub-components ──

function Shell({
  children,
  as: Tag = "div",
  ...rest
}: React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "a";
  href?: string;
  target?: string;
  rel?: string;
}) {
  // motion wrapper for fade-up + whileTap scale on link variants
  const Component = Tag as "div";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 0.1, 0.2, 1] }}
      whileTap={Tag === "a" ? { scale: 0.99 } : undefined}
      style={{
        display: "block",
        background: "color-mix(in srgb, var(--bg, #050402) 60%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 14%, transparent)",
        borderRadius: 14,
        overflow: "hidden",
        backdropFilter: "blur(18px) saturate(1.3)",
        WebkitBackdropFilter: "blur(18px) saturate(1.3)",
        textDecoration: "none",
      }}
    >
      <Component {...rest} style={{ display: "block", color: "inherit" }}>
        {children}
      </Component>
    </motion.div>
  );
}

function SourceChip({
  siteName,
  url,
  favicon,
}: {
  siteName: string;
  url: string;
  favicon?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px 10px",
        borderTop:
          "1px solid color-mix(in srgb, var(--accent) 8%, transparent)",
      }}
    >
      {favicon && (
        <img
          src={favicon}
          alt=""
          width={12}
          height={12}
          style={{ borderRadius: 2, opacity: 0.75 }}
        />
      )}
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          flex: 1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {siteName}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Open source"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          color: "var(--accent)",
          textDecoration: "none",
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Open
        <ExternalLink size={10} />
      </a>
    </div>
  );
}

function Skeleton({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{
        width: "100%",
        borderRadius: 14,
        border: "1px solid color-mix(in srgb, var(--accent) 10%, transparent)",
        overflow: "hidden",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: reduceMotion
            ? "color-mix(in srgb, var(--accent) 4%, transparent)"
            : undefined,
          backgroundImage: reduceMotion
            ? undefined
            : "linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 8%, transparent), transparent)",
          backgroundSize: "200% 100%",
          animation: reduceMotion
            ? undefined
            : "embed-shimmer 1.6s ease-in-out infinite",
        }}
      />
      <div style={{ padding: 14 }}>
        <div
          style={{
            width: "70%",
            height: 12,
            borderRadius: 3,
            background: "color-mix(in srgb, var(--accent) 8%, transparent)",
            marginBottom: 8,
          }}
        />
        <div
          style={{
            width: "92%",
            height: 10,
            borderRadius: 3,
            background: "color-mix(in srgb, var(--accent) 5%, transparent)",
          }}
        />
      </div>
      {!reduceMotion && (
        <style>{`
          @keyframes embed-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      )}
    </motion.div>
  );
}

function FallbackLink({ url }: { url: string }) {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    host = "source";
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        borderRadius: 999,
        border: "1px solid color-mix(in srgb, var(--accent) 18%, transparent)",
        background: "color-mix(in srgb, var(--bg, #050402) 60%, transparent)",
        color: "var(--accent)",
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.06em",
        textDecoration: "none",
      }}
    >
      <ExternalLink size={12} />
      {host}
    </a>
  );
}
