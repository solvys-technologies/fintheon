import type { CSSProperties } from "react";
import { LoadingGlobe } from "./LoadingGlobe";
import { LoadingStatusCard } from "./LoadingStatusCard";

interface LoadingBootScreenProps {
  phrase?: string;
  compact?: boolean;
}

export function LoadingBootScreen({
  phrase = "Restoring session",
  compact = false,
}: LoadingBootScreenProps) {
  return (
    <div style={shellStyle}>
      <LoadingGlobe phase="idle" style={{ position: "absolute", inset: "-6vmin" }} />
      <div style={scanlineStyle} />
      <div style={contentStyle}>
        <LoadingStatusCard phrase={phrase} compact={compact} />
      </div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  position: "relative",
  minHeight: "100vh",
  width: "100%",
  overflow: "hidden",
  background: "var(--fintheon-bg, #050402)",
};

const contentStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "grid",
  minHeight: "100vh",
  placeItems: "center",
  padding: 24,
};

const scanlineStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background:
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px), radial-gradient(circle at center, transparent 0 42%, rgba(0,0,0,0.56) 78%)",
  mixBlendMode: "screen",
  opacity: 0.28,
  pointerEvents: "none",
};
