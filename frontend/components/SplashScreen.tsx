// [codex 2026-05-23] Cold-start globe transition: spin-up, camera zoom,
// fade to black, then reveal the app from black.
import { useEffect, useState } from "react";
import { DotMatrixLoader } from "./icon-bank/DotMatrixLoader";

interface SplashScreenProps {
  isReady: boolean;
}

const STATUS_MESSAGES = [
  "Initializing Strategium",
  "Summoning Consilium",
  "Agents standing by",
  "The tape is unwinding",
];

export default function SplashScreen({ isReady }: SplashScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [phase, setPhase] = useState<"idle" | "zoom" | "black" | "reveal">(
    "idle",
  );
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    if (phase !== "idle") return;
    const interval = window.setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 1500);
    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (!isReady) return;
    setPhase("zoom");
    const blackTimer = window.setTimeout(() => setPhase("black"), 900);
    const revealTimer = window.setTimeout(() => setPhase("reveal"), 1650);
    const unmountTimer = window.setTimeout(() => setUnmounted(true), 2650);
    return () => {
      window.clearTimeout(blackTimer);
      window.clearTimeout(revealTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [isReady]);

  if (unmounted) return null;

  const isAccelerated = phase !== "idle";
  const isBlack = phase === "black";
  const isReveal = phase === "reveal";

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050402]"
      style={{
        opacity: isReveal ? 0 : 1,
        transition: "opacity 900ms cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: isReveal ? "none" : "all",
      }}
    >
      <div
        className="flex flex-col items-center gap-5"
        style={{
          opacity: isBlack || isReveal ? 0 : 1,
          transform: phase === "zoom" ? "scale(3.8)" : "scale(1)",
          transition:
            "transform 900ms cubic-bezier(0.16, 1, 0.3, 1), opacity 520ms ease",
        }}
      >
        <SplashGlobe accelerated={isAccelerated} />
        <div className="rounded-[22px] border border-[#c79f4a]/18 bg-[#0a0905]/92 px-5 py-3">
          <div className="flex items-center justify-center gap-3">
            <span className="h-[2px] w-12 overflow-hidden rounded-[2px] bg-[#c79f4a]/15">
              <span
                className="block h-full w-1/2 bg-[#c79f4a]/55"
                style={{ animation: "splashFuse 1600ms ease-in-out infinite" }}
              />
            </span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#c79f4a]/70">
              {STATUS_MESSAGES[messageIndex]}
            </span>
          </div>
          {isReady ? (
            <div className="mt-3 flex justify-center">
              <DotMatrixLoader variant="diagonal-scan" size={28} label="Loading" />
            </div>
          ) : null}
        </div>
      </div>
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: isBlack ? 1 : isReveal ? 0 : 0,
          transition: "opacity 650ms ease",
        }}
      />
      <style>{`
        @keyframes splashFuse {
          0%, 100% { transform: translateX(-85%); opacity: 0.35; }
          50% { transform: translateX(170%); opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}

function SplashGlobe({ accelerated }: { accelerated: boolean }) {
  return (
    <svg viewBox="0 0 160 160" className="h-52 w-52 text-[#c79f4a]">
      <circle cx="80" cy="80" r="58" fill="none" stroke="currentColor" strokeOpacity=".42" />
      <g style={{ transformOrigin: "80px 80px", animation: `splashGlobe ${accelerated ? "5s" : "15s"} linear infinite` }}>
        <ellipse cx="80" cy="80" rx="58" ry="18" fill="none" stroke="currentColor" strokeOpacity=".28" />
        <ellipse cx="80" cy="80" rx="58" ry="34" fill="none" stroke="currentColor" strokeOpacity=".22" />
        <path d="M80 22c-22 20-22 96 0 116M80 22c22 20 22 96 0 116" fill="none" stroke="currentColor" strokeOpacity=".32" />
        <path d="M28 58h104M28 102h104" fill="none" stroke="currentColor" strokeOpacity=".2" />
      </g>
      <circle cx="80" cy="80" r="4" fill="currentColor" opacity=".75" />
      <style>{`
        @keyframes splashGlobe {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}
