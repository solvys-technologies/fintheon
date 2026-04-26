// [claude-code 2026-04-25] S42-T2 mobile: bottom-sheet command palette opened by
// swipe-up on the composer. Same group shape as the desktop palette (Agents,
// Surfaces, Recent) but laid out as a slide-up sheet, no cmdk dependency
// (mobile keeps its dep footprint minimal).
import { useEffect, useRef } from "react";

interface RecentMessage {
  id: string;
  text: string;
}

interface MobileCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  recent: RecentMessage[];
  onPickPersona: (personaId: "oracle" | "feucht" | "consul" | "herald") => void;
  onPickRecent: (text: string) => void;
}

const AGENTS: Array<{
  id: "oracle" | "feucht" | "consul" | "herald";
  label: string;
  hint: string;
}> = [
  { id: "oracle", label: "Oracle", hint: "/oracle — prediction markets" },
  { id: "feucht", label: "Feucht", hint: "/feucht — futures, IV, risk" },
  { id: "consul", label: "Consul", hint: "/consul — fundamentals" },
  { id: "herald", label: "Herald", hint: "/herald — news + sentiment" },
];

export default function MobileCommandPalette({
  open,
  onClose,
  recent,
  onPickPersona,
  onPickRecent,
}: MobileCommandPaletteProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(5,4,2,0.65)",
        display: "flex",
        alignItems: "flex-end",
      }}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxHeight: "70vh",
          background: "#050402",
          borderTop: "1px solid rgba(199,159,74,0.3)",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: "12px 16px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 36,
            height: 3,
            background: "rgba(199,159,74,0.3)",
            borderRadius: 2,
            margin: "0 auto 4px",
          }}
        />
        <SectionHeading>Agents</SectionHeading>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {AGENTS.map((a) => (
            <button
              key={a.id}
              onClick={() => {
                onPickPersona(a.id);
                onClose();
              }}
              style={paletteRowStyle}
            >
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                {a.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--text-disabled)",
                  marginLeft: 8,
                }}
              >
                {a.hint}
              </span>
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <>
            <SectionHeading>Recent</SectionHeading>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
                maxHeight: 240,
                overflowY: "auto",
              }}
            >
              {recent.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onPickRecent(m.text);
                    onClose();
                  }}
                  style={{ ...paletteRowStyle, textAlign: "left" }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.text}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const paletteRowStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "none",
  borderBottom: "1px solid rgba(199,159,74,0.08)",
  padding: "12px 4px",
  display: "flex",
  alignItems: "center",
  cursor: "pointer",
  textAlign: "left",
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "var(--accent, #c79f4a)",
        opacity: 0.7,
      }}
    >
      {children}
    </div>
  );
}
