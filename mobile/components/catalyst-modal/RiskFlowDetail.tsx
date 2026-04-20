// [claude-code 2026-04-19] S26-P1 T3: collapse preview/headline duplication per TP —
//   body only renders when it's materially distinct from the headline (not a prefix/echo).
//   Adds a "View original" link below the headline when item.url is present so users can
//   jump to the source (Twitter / Reuters / etc.). EmbedPreview stays — that's the rich
//   Twitter/OG peek and it's intentional per S25.
// [claude-code 2026-04-19] S25: full news-headline detail — source/time header, headline,
//   body, ticker chips, EmbedPreview peek of original post, footer (IV fuse + Ask CAO).
//   Stagger-in so header lands first, body second, embed third, footer last.
import { motion } from "framer-motion";
import { ArrowUpRight } from "../shared/iso-icons";
import { DetailHeader } from "./DetailHeader";
import { DetailFooter } from "./DetailFooter";
import { EmbedPreview } from "../embed/EmbedPreview";
import { useRiskFlowItem } from "../../hooks/useRiskFlowItem";
import { DETAIL_STAGGER } from "../../lib/sheet-motion";

/** Body is a "duplicate" of the headline when it's empty, identical, or one is a
 *  prefix/contains-loose-match of the other (common for Twitter headlines where
 *  `body` ends up being the truncated tweet text and `headline` is the full tweet). */
function bodyDuplicatesHeadline(
  headline: string,
  body: string | null | undefined,
): boolean {
  if (!body) return true;
  const h = headline.trim().toLowerCase();
  const b = body.trim().toLowerCase();
  if (!b) return true;
  if (h === b) return true;
  if (h.startsWith(b) || b.startsWith(h)) return true;
  // fuzzy contains: body fully embedded in headline (or vice-versa) is also a dup
  if (h.length > 40 && (h.includes(b) || b.includes(h))) return true;
  return false;
}

interface Props {
  itemId: string;
  onClose: () => void;
  onDispatched: (conversationId: string) => void;
}

function sevFromMacro(
  level?: number | null,
): "low" | "medium" | "high" | "critical" {
  if (!level) return "low";
  if (level >= 4) return "critical";
  if (level >= 3) return "high";
  if (level >= 2) return "medium";
  return "low";
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    hour12: true,
  });
}

export function RiskFlowDetail({ itemId, onClose, onDispatched }: Props) {
  const { item, isLoading, error } = useRiskFlowItem(itemId);

  if (isLoading) {
    return (
      <div>
        <DetailHeader label="Headline" onClose={onClose} />
        <LoadingBlock />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div>
        <DetailHeader label="Headline" onClose={onClose} />
        <ErrorBlock message={error ?? "Headline not available."} />
      </div>
    );
  }

  const sev = sevFromMacro(item.macroLevel);
  const iv = typeof item.ivScore === "number" ? item.ivScore : 0;

  return (
    <div>
      <DetailHeader
        label={item.riskType ?? "Headline"}
        severity={sev}
        timeLabel={formatTime(item.publishedAt)}
        onClose={onClose}
      />

      <motion.div
        initial="hidden"
        animate="shown"
        variants={{
          hidden: {},
          shown: { transition: { staggerChildren: DETAIL_STAGGER } },
        }}
      >
        <Row>
          <h2
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 20,
              lineHeight: 1.28,
              color: "var(--text-primary)",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {item.headline}
          </h2>
          <SourceRow source={item.source} author={item.authorHandle} />
          {item.url && <ViewOriginalLink url={item.url} />}
        </Row>

        {item.body && !bodyDuplicatesHeadline(item.headline, item.body) && (
          <Row>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--text-secondary)",
                margin: 0,
              }}
            >
              {item.body}
            </p>
          </Row>
        )}

        {item.symbols && item.symbols.length > 0 && (
          <Row>
            <TickerChips symbols={item.symbols} />
          </Row>
        )}

        {(item.url || item.video_url) && (
          <Row>
            <EmbedPreview url={item.video_url || item.url} />
          </Row>
        )}

        {item.agentNote && (
          <Row>
            <AgentNoteBlock note={item.agentNote} />
          </Row>
        )}
      </motion.div>

      <DetailFooter
        iv={iv}
        severity={sev === "critical" ? "critical" : sev}
        label={`IV · ${item.source.toUpperCase()}`}
        dispatch={{
          source: "riskflow",
          sourceId: item.id,
          context: {
            title: item.headline,
            summary: item.body ?? undefined,
            severity: sev,
            iv,
            sentiment: item.sentiment,
            tickers: item.symbols,
            sourceUrl: item.url ?? undefined,
          },
        }}
        onDispatched={onDispatched}
      />
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 6 },
        shown: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.28, ease: [0.22, 0.1, 0.2, 1] },
        },
      }}
      style={{ marginBottom: 14 }}
    >
      {children}
    </motion.div>
  );
}

function ViewOriginalLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginTop: 10,
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--accent)",
        textDecoration: "none",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span>View original</span>
      <ArrowUpRight size={12} strokeWidth={1.8} />
    </a>
  );
}

function SourceRow({
  source,
  author,
}: {
  source: string;
  author?: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 8,
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      <span>{source}</span>
      {author && (
        <>
          <span style={{ color: "var(--text-disabled)" }}>·</span>
          <span>@{author}</span>
        </>
      )}
    </div>
  );
}

function TickerChips({ symbols }: { symbols: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {symbols.slice(0, 8).map((s) => (
        <span
          key={s}
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            border:
              "1px solid color-mix(in srgb, var(--accent) 18%, transparent)",
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.06em",
            color: "var(--accent)",
          }}
        >
          {s}
        </span>
      ))}
    </div>
  );
}

function AgentNoteBlock({ note }: { note: string }) {
  return (
    <div
      style={{
        borderLeft: "2px solid var(--accent)",
        padding: "6px 10px",
        background: "color-mix(in srgb, var(--accent) 5%, transparent)",
        borderRadius: "0 8px 8px 0",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 9,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--accent)",
          marginBottom: 4,
        }}
      >
        Harper's take
      </div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          lineHeight: 1.5,
          color: "var(--text-primary)",
        }}
      >
        {note}
      </div>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div
      style={{
        padding: "40px 0",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: "var(--text-disabled)",
        }}
      >
        [LOADING CATALYST...]
      </span>
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "24px 16px",
        textAlign: "center",
        color: "var(--text-secondary)",
        fontSize: 13,
      }}
    >
      {message}
    </div>
  );
}
