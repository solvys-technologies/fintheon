// [claude-code 2026-04-19] S25: catalyst narrative detail — narrative-thread ribbon, tags,
//   body, EmbedPreview peek, IV fuse + Ask CAO footer. Same stagger pattern as RiskFlowDetail.
import { motion } from "framer-motion";
import { DetailHeader } from "./DetailHeader";
import { DetailFooter } from "./DetailFooter";
import { EmbedPreview } from "../embed/EmbedPreview";
import { useCatalystById } from "../../hooks/useCatalystById";
import { DETAIL_STAGGER } from "../../lib/sheet-motion";

interface Props {
  catalystId: string;
  onClose: () => void;
  onDispatched: (conversationId: string) => void;
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

export function CatalystDetail({ catalystId, onClose, onDispatched }: Props) {
  const { catalyst, isLoading, error } = useCatalystById(catalystId);

  if (isLoading) {
    return (
      <div>
        <DetailHeader label="Catalyst" onClose={onClose} />
        <Loading />
      </div>
    );
  }

  if (error || !catalyst) {
    return (
      <div>
        <DetailHeader label="Catalyst" onClose={onClose} />
        <ErrorBlock message={error ?? "Catalyst unavailable."} />
      </div>
    );
  }

  const iv = typeof catalyst.ivScore === "number" ? catalyst.ivScore : 0;

  return (
    <div>
      <DetailHeader
        label={catalyst.category?.toUpperCase() ?? "Catalyst"}
        severity={catalyst.severity}
        timeLabel={formatTime(catalyst.date)}
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
            {catalyst.title}
          </h2>
          {catalyst.narrative && (
            <NarrativeRibbon narrative={catalyst.narrative} />
          )}
        </Row>

        {catalyst.description && (
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
              {catalyst.description}
            </p>
          </Row>
        )}

        {catalyst.tags && catalyst.tags.length > 0 && (
          <Row>
            <TagRow tags={catalyst.tags} />
          </Row>
        )}

        {catalyst.sourceUrl && (
          <Row>
            <EmbedPreview url={catalyst.sourceUrl} />
          </Row>
        )}

        {catalyst.agentNote && (
          <Row>
            <AgentNote note={catalyst.agentNote} />
          </Row>
        )}
      </motion.div>

      <DetailFooter
        iv={iv}
        severity={catalyst.severity}
        label={`IV · ${catalyst.narrative ?? "NARRATIVE"}`}
        dispatch={{
          source: "catalyst",
          sourceId: catalyst.id,
          context: {
            title: catalyst.title,
            summary: catalyst.description,
            severity: catalyst.severity,
            iv,
            sentiment: catalyst.sentiment,
            sourceUrl: catalyst.sourceUrl ?? undefined,
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

function NarrativeRibbon({ narrative }: { narrative: string }) {
  return (
    <div
      style={{
        marginTop: 10,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: "var(--accent)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 4,
          height: 4,
          borderRadius: 999,
          background: "var(--accent)",
        }}
      />
      {narrative}
    </div>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {tags.slice(0, 8).map((t) => (
        <span
          key={t}
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            border:
              "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.06em",
            color: "var(--text-secondary)",
          }}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function AgentNote({ note }: { note: string }) {
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
        Agent note
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

function Loading() {
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
