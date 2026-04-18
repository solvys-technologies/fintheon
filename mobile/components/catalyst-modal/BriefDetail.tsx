// [claude-code 2026-04-19] S25: Daily Brief detail — uses existing useBriefing hook,
//   renders full markdown body with fade-in rows, IV fuse (brief-level) + Ask CAO footer.
//   Brief IV is derived from current aggregate IV (useIVScore) since briefs don't carry
//   a per-item score — gives the footer a meaningful severity color and number.
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DetailHeader } from "./DetailHeader";
import { DetailFooter } from "./DetailFooter";
import { useBriefing } from "../../hooks/useBriefing";
import { useIVScore } from "../../hooks/useIVScore";
import { DETAIL_STAGGER } from "../../lib/sheet-motion";

interface Props {
  briefId?: string;
  onClose: () => void;
  onDispatched: (conversationId: string) => void;
}

function sevFromIv(iv: number): "low" | "medium" | "high" | "critical" {
  if (iv >= 8) return "critical";
  if (iv >= 6) return "high";
  if (iv >= 4) return "medium";
  return "low";
}

export function BriefDetail({ onClose, onDispatched }: Props) {
  const { items, isLoading, error } = useBriefing();
  const { score: ivScore } = useIVScore();

  const iv = ivScore ?? 0;
  const severity = sevFromIv(iv);

  if (isLoading) {
    return (
      <div>
        <DetailHeader label="Daily Brief" onClose={onClose} />
        <LoadingBlock />
      </div>
    );
  }

  if (error || items.length === 0) {
    return (
      <div>
        <DetailHeader label="Daily Brief" onClose={onClose} />
        <ErrorBlock message={error ?? "Brief unavailable."} />
      </div>
    );
  }

  const fullText = items.map((i) => `**${i.title}**\n${i.detail}`).join("\n\n");
  const title = items[0]?.title ?? "Daily Brief";

  return (
    <div>
      <DetailHeader label="Daily Brief" severity={severity} onClose={onClose} />

      <motion.div
        initial="hidden"
        animate="shown"
        variants={{
          hidden: {},
          shown: { transition: { staggerChildren: DETAIL_STAGGER } },
        }}
      >
        {items.map((it, idx) => (
          <motion.section
            key={`${it.title}-${idx}`}
            variants={{
              hidden: { opacity: 0, y: 6 },
              shown: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.28, ease: [0.22, 0.1, 0.2, 1] },
              },
            }}
            style={{
              marginBottom: 18,
              paddingBottom: 14,
              borderBottom:
                "1px solid color-mix(in srgb, var(--accent) 8%, transparent)",
            }}
          >
            <h3
              style={{
                margin: "0 0 8px",
                fontFamily: "var(--font-body)",
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text-primary)",
                lineHeight: 1.35,
              }}
            >
              {it.title}
            </h3>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
              className="chat-markdown"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {it.detail}
              </ReactMarkdown>
            </div>
          </motion.section>
        ))}
      </motion.div>

      <DetailFooter
        iv={iv}
        severity={severity}
        label="IV · BRIEF"
        dispatch={{
          source: "brief",
          sourceId: "daily",
          context: {
            title,
            summary: fullText.slice(0, 800),
            severity,
            iv,
          },
        }}
        onDispatched={onDispatched}
      />
    </div>
  );
}

function LoadingBlock() {
  return (
    <div
      style={{ padding: "40px 0", display: "flex", justifyContent: "center" }}
    >
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: "var(--text-disabled)",
        }}
      >
        [LOADING BRIEF...]
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
