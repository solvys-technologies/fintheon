// [claude-code 2026-04-11] S14-T6: Liquid glass splash screen — replaces temple doors
import { useState, useEffect, useMemo } from "react";

interface SplashScreenProps {
  isReady: boolean;
}

const HERO_BACKGROUNDS = [
  "./halftone-heroes/hero-bg-1.png",
  "./halftone-heroes/hero-bg-2.png",
  "./halftone-heroes/hero-bg-3.png",
];

const STATUS_MESSAGES = [
  "Initializing Strategium...",
  "Summoning the Consilium...",
  "Agents standing by...",
  "The Tape is unwinding...",
];

export default function SplashScreen({ isReady }: SplashScreenProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);
  const [unmounted, setUnmounted] = useState(false);

  const bg = useMemo(
    () => HERO_BACKGROUNDS[Math.floor(Math.random() * HERO_BACKGROUNDS.length)],
    [],
  );

  // Cycle status messages
  useEffect(() => {
    if (fadeOut) return;
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [fadeOut]);

  // When ready, fade out then unmount
  useEffect(() => {
    if (!isReady) return;
    setFadeOut(true);
    const timer = setTimeout(() => setUnmounted(true), 900);
    return () => clearTimeout(timer);
  }, [isReady]);

  if (unmounted) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        opacity: fadeOut ? 0 : 1,
        transition: "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
        pointerEvents: fadeOut ? "none" : "all",
      }}
    >
      {/* Shuffled hero background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${bg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.3) saturate(0.6)",
        }}
      />

      {/* Dark vignette overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 20%, rgba(5,4,2,0.7) 70%, rgba(5,4,2,0.95) 100%)",
        }}
      />

      {/* Center: liquid glass window */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "20px",
            width: "220px",
            height: "220px",
            borderRadius: "28px",
            background: "rgba(0, 0, 0, 0.35)",
            backdropFilter: "blur(40px) saturate(1.4)",
            WebkitBackdropFilter: "blur(40px) saturate(1.4)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            boxShadow:
              "0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
          }}
        >
          {/* Logo — no app name text */}
          <img
            src="./fintheon-logo.png"
            alt=""
            style={{
              width: "80px",
              height: "80px",
              objectFit: "contain",
              opacity: 0.9,
              filter: "drop-shadow(0 0 12px rgba(199, 159, 74, 0.25))",
            }}
          />

          {/* Subtle breathing indicator */}
          <div
            style={{
              width: "32px",
              height: "2px",
              borderRadius: "1px",
              backgroundColor: "rgba(199, 159, 74, 0.25)",
              animation: "splashBreath 2.5s ease-in-out infinite",
            }}
          />
        </div>
      </div>

      {/* Status text — below the glass window */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          justifyContent: "center",
          paddingBottom: "calc(50vh - 150px)",
        }}
      >
        <p
          style={{
            fontFamily: "'Playfair Display', 'Georgia', serif",
            fontStyle: "normal",
            fontSize: "0.8rem",
            fontWeight: 400,
            color: "#c79f4a",
            letterSpacing: "0.08em",
            opacity: 0.7,
            margin: 0,
            minHeight: "1.2em",
            transition: "opacity 0.3s ease",
          }}
        >
          {STATUS_MESSAGES[messageIndex]}
        </p>
      </div>

      <style>{`
        @keyframes splashBreath {
          0%, 100% { opacity: 0.2; transform: scaleX(1); }
          50% { opacity: 0.5; transform: scaleX(1.6); }
        }
      `}</style>
    </div>
  );
}
