import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { LOADING_GREETINGS, LOADING_PHRASES } from "./loading-globe-config";

interface LoadingStatusCardProps {
  phrase?: string;
  showBrand?: boolean;
  showGreeting?: boolean;
  compact?: boolean;
  bare?: boolean;
  style?: CSSProperties;
}

export function LoadingStatusCard({
  phrase,
  showBrand = true,
  showGreeting = true,
  compact = false,
  bare = false,
  style,
}: LoadingStatusCardProps) {
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const dots = useMemo(
    () => Array.from({ length: 24 }, (_, index) => index),
    [],
  );

  useEffect(() => {
    const greetingTimer = window.setInterval(
      () => setGreetingIndex((prev) => (prev + 1) % LOADING_GREETINGS.length),
      3200,
    );
    const phraseTimer = window.setInterval(
      () => setPhraseIndex((prev) => (prev + 1) % LOADING_PHRASES.length),
      1500,
    );
    return () => {
      window.clearInterval(greetingTimer);
      window.clearInterval(phraseTimer);
    };
  }, []);

  return (
    <div style={{ ...cardStyle(compact, bare), ...style }}>
      {showBrand ? <div style={brandStyle}>Fintheon</div> : null}
      {showGreeting ? (
        <div style={greetingStyle}>{LOADING_GREETINGS[greetingIndex]}</div>
      ) : null}
      <div style={phraseStyle}>{phrase ?? LOADING_PHRASES[phraseIndex]}</div>
      <div aria-hidden="true" style={brailleStyle}>
        {dots.map((dot) => {
          const row = Math.floor(dot / 12);
          const column = dot % 12;
          const lead = column % 2 === 0 ? row : 1 - row;
          return (
            <i
              key={dot}
              style={{
                ...dotStyle,
                animationDelay: `${column * 180 + lead * 95}ms`,
              }}
            />
          );
        })}
      </div>
      <style>{`
        @keyframes fintheon-loading-dot {
          0%, 38%, 100% {
            opacity: 0.13;
            transform: scale(0.78);
            box-shadow: none;
          }
          16% {
            opacity: 0.9;
            transform: scale(1.08);
            box-shadow: 0 0 10px color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 72%, transparent);
          }
        }
      `}</style>
    </div>
  );
}

function cardStyle(compact: boolean, bare: boolean): CSSProperties {
  if (bare) {
    return {
      display: "grid",
      justifyItems: "center",
      gap: compact ? 7 : 9,
      width: "100%",
      minWidth: 0,
      overflow: "hidden",
      textAlign: "center",
    };
  }

  return {
    display: "grid",
    justifyItems: "center",
    gap: compact ? 7 : 9,
    width: "min(340px, calc(100vw - 48px))",
    minWidth: compact
      ? "min(276px, calc(100vw - 48px))"
      : "min(300px, calc(100vw - 48px))",
    padding: compact ? "12px 13px" : "13.2px 14px",
    border:
      "1px solid color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 18%, transparent)",
    borderRadius: 8,
    background:
      "color-mix(in srgb, var(--fintheon-surface, #0a0905) 83%, transparent)",
    backdropFilter: "blur(18px) saturate(1.18)",
    WebkitBackdropFilter: "blur(18px) saturate(1.18)",
    overflow: "hidden",
    textAlign: "center",
  };
}

const brandStyle: CSSProperties = {
  color: "var(--fintheon-primary, var(--fintheon-accent))",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.22em",
};

const greetingStyle: CSSProperties = {
  minHeight: 16,
  color:
    "color-mix(in srgb, var(--fintheon-muted, #6b6455) 70%, var(--fintheon-text, #f0ead6))",
  fontSize: 11,
  fontStyle: "italic",
  maxWidth: "100%",
};

const phraseStyle: CSSProperties = {
  minHeight: 15,
  color:
    "color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 72%, var(--fintheon-text, #f0ead6))",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.2em",
  lineHeight: 1.45,
  overflowWrap: "anywhere",
  maxWidth: "100%",
};

const brailleStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(12, 5px)",
  gridTemplateRows: "repeat(2, 5px)",
  gap: 3,
  minHeight: 13,
  justifyContent: "center",
};

const dotStyle: CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: "var(--fintheon-primary, var(--fintheon-accent))",
  opacity: 0.16,
  animation:
    "fintheon-loading-dot 2700ms cubic-bezier(0.16, 1, 0.3, 1) infinite",
};
