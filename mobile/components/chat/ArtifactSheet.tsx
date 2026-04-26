// [claude-code 2026-04-25] S42-T4: mobile artifact sheet — bottom sheet with three snap
// points (peek 40vh / full 95vh / closed). Swipe up advances, swipe down retreats; the X
// button dismisses entirely. Mounts at ChatPage shell level (sibling of message list) so
// it overlays the composer without re-flowing it.
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { X, ExternalLink } from "lucide-react";
import {
  ARTIFACT_EVENT,
  type ArtifactPayload,
} from "@frontend/components/chat/artifactTypes";

type SheetState = "closed" | "peek" | "full";

const HEIGHTS: Record<SheetState, string> = {
  closed: "0vh",
  peek: "40vh",
  full: "95vh",
};

export function ArtifactSheet() {
  const [artifact, setArtifact] = useState<ArtifactPayload | null>(null);
  const [state, setState] = useState<SheetState>("closed");

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ArtifactPayload>).detail;
      if (!detail || !detail.kind) return;
      setArtifact(detail);
      setState("peek");
    };
    window.addEventListener(ARTIFACT_EVENT, handler);
    return () => window.removeEventListener(ARTIFACT_EVENT, handler);
  }, []);

  const dismiss = useCallback(() => {
    setState("closed");
    // Defer payload clear so the exit animation can render
    setTimeout(() => setArtifact(null), 250);
  }, []);

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const dy = info.offset.y;
      const vy = info.velocity.y;
      // Down = positive y → retreat. Up = negative y → advance.
      if (dy > 80 || vy > 400) {
        if (state === "full") setState("peek");
        else dismiss();
      } else if (dy < -60 || vy < -400) {
        if (state === "peek") setState("full");
      }
    },
    [state, dismiss],
  );

  if (!artifact) return null;

  return (
    <AnimatePresence>
      {state !== "closed" && (
        <motion.div
          key="artifact-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.15}
          onDragEnd={handleDragEnd}
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: HEIGHTS[state],
            background: "var(--surface, #0c0a07)",
            borderTop: "1px solid rgba(199,159,74,0.25)",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            zIndex: 60,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Drag handle */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: 8,
              paddingBottom: 6,
              cursor: "grab",
            }}
          >
            <div
              style={{
                width: 36,
                height: 3,
                borderRadius: 2,
                background: "rgba(199,159,74,0.4)",
              }}
            />
          </div>

          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 12px 8px",
              borderBottom: "1px solid rgba(199,159,74,0.15)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-data)",
                fontSize: 11,
                color: "var(--accent, #c79f4a)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                fontWeight: 600,
              }}
            >
              {labelFor(artifact)}
            </span>
            <button
              onClick={dismiss}
              aria-label="Close artifact"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--accent, #c79f4a)",
                opacity: 0.7,
                padding: 6,
                cursor: "pointer",
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <ArtifactSheetBody artifact={artifact} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function labelFor(a: ArtifactPayload): string {
  if (a.kind === "tradingview") return `Chart · ${a.payload.symbol}`;
  if (a.kind === "browserbase") return "Browser";
  if (a.kind === "report") return a.payload.title ?? "Report";
  return a.payload.source ?? "Source";
}

// Mobile-styled body. Plain sandboxed iframe for tradingview/browserbase
// (mobile is browser-context PWA — no webview path needed); inline srcDoc
// iframe for HTML reports; flat surface card for citations.
const IFRAME_SANDBOX =
  "allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation";

function ArtifactSheetBody({ artifact }: { artifact: ArtifactPayload }) {
  if (artifact.kind === "tradingview") {
    const symbol = encodeURIComponent(artifact.payload.symbol);
    const interval = artifact.payload.interval ?? "D";
    return (
      <iframe
        title={`TradingView ${artifact.payload.symbol}`}
        src={`https://www.tradingview.com/chart/?symbol=${symbol}&interval=${interval}`}
        sandbox={IFRAME_SANDBOX}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "#fff",
        }}
      />
    );
  }

  if (artifact.kind === "browserbase") {
    return (
      <iframe
        title="Browserbase session"
        src={artifact.payload.sessionUrl}
        sandbox={IFRAME_SANDBOX}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "#fff",
        }}
      />
    );
  }

  if (artifact.kind === "report") {
    return (
      <iframe
        title={artifact.payload.title ?? "Report"}
        srcDoc={artifact.payload.html}
        sandbox="allow-scripts"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: "#fff",
        }}
      />
    );
  }

  const { title, snippet, source, url } = artifact.payload;
  return (
    <div style={{ padding: "16px" }}>
      <div
        style={{
          border: "1px solid rgba(199,159,74,0.2)",
          background: "rgba(199,159,74,0.04)",
          padding: 14,
        }}
      >
        {source && (
          <div
            style={{
              fontFamily: "var(--font-data)",
              fontSize: 9,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "rgba(199,159,74,0.7)",
              marginBottom: 8,
            }}
          >
            {source}
          </div>
        )}
        <h3
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-display, #f0ead6)",
            marginBottom: 10,
          }}
        >
          {title}
        </h3>
        {snippet && (
          <p
            style={{
              fontSize: 12,
              lineHeight: 1.55,
              color: "var(--text-secondary, #a1a1aa)",
              whiteSpace: "pre-wrap",
            }}
          >
            {snippet}
          </p>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--accent, #c79f4a)",
              textDecoration: "none",
            }}
          >
            <ExternalLink size={12} />
            <span>Open source</span>
          </a>
        )}
      </div>
    </div>
  );
}
