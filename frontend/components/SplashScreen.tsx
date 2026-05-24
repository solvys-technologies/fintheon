// [codex 2026-05-23] Cold-start globe transition: auth pulse, zoom, black fade,
// then app reveal. The globe implementation is shared with login/mobile.
import { useEffect, useState } from "react";
import { LoadingGlobe } from "./loading/LoadingGlobe";
import { LoadingStatusCard } from "./loading/LoadingStatusCard";

interface SplashScreenProps {
  isReady: boolean;
}

export default function SplashScreen({ isReady }: SplashScreenProps) {
  const [phase, setPhase] = useState<"idle" | "zoom" | "black" | "reveal">("idle");
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    setPhase("zoom");
    const blackTimer = window.setTimeout(() => setPhase("black"), 950);
    const revealTimer = window.setTimeout(() => setPhase("reveal"), 1760);
    const unmountTimer = window.setTimeout(() => setUnmounted(true), 2650);
    return () => {
      window.clearTimeout(blackTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [isReady]);

  if (unmounted) return null;

  const isReadyPhase = phase !== "idle";
  const isReveal = phase === "reveal";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483000,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: "var(--fintheon-bg, #050402)",
        opacity: isReveal ? 0 : 1,
        pointerEvents: isReveal ? "none" : "all",
        transition: "opacity 900ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div style={scanlineStyle} />
      <div
        style={{
          position: "absolute",
          inset: "-6vmin",
          opacity: phase === "black" || isReveal ? 0 : 1,
          transform: isReadyPhase ? "scale(1.24)" : "scale(1)",
          transition:
            "transform 1200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 520ms ease",
        }}
      >
        <LoadingGlobe
          phase={isReadyPhase ? "ready" : "auth"}
          style={{ width: "100%", height: "100%" }}
        />
      </div>
      <div
        style={{
          position: "relative",
          zIndex: 2,
          opacity: isReadyPhase ? 0 : 1,
          transform: isReadyPhase ? "translateY(14px)" : "translateY(0)",
          transition:
            "opacity 520ms ease, transform 900ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <LoadingStatusCard />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          background: "#000",
          pointerEvents: "none",
          opacity: phase === "black" ? 1 : 0,
          transition: "opacity 650ms ease",
        }}
      />
    </div>
  );
}

const scanlineStyle = {
  position: "absolute",
  inset: 0,
  background:
    "repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 3px), radial-gradient(circle at center, transparent 0 42%, rgba(0,0,0,0.56) 78%)",
  mixBlendMode: "screen",
  opacity: 0.28,
  pointerEvents: "none",
} as const;
