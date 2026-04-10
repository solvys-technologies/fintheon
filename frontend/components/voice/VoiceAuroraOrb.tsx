// [claude-code 2026-04-03] SiriOrb-based voice indicator — gold idle/listening, green speaking, red error/infraction
import { useMemo } from "react";
import type { VoiceOrbState } from "../../types/voice";

interface VoiceAuroraOrbProps {
  state: VoiceOrbState;
  compact?: boolean;
}

const STATE_CONFIG: Record<
  VoiceOrbState,
  { c1: string; c2: string; c3: string; speed: number; border: string }
> = {
  idle: {
    c1: "oklch(72% 0.12 70)",
    c2: "oklch(68% 0.10 55)",
    c3: "oklch(75% 0.14 80)",
    speed: 24,
    border: "var(--fintheon-accent)",
  },
  listening: {
    c1: "oklch(72% 0.14 70)",
    c2: "oklch(70% 0.12 60)",
    c3: "oklch(78% 0.16 75)",
    speed: 14,
    border: "var(--fintheon-accent)",
  },
  speaking: {
    c1: "oklch(72% 0.18 145)",
    c2: "oklch(68% 0.14 155)",
    c3: "oklch(75% 0.16 135)",
    speed: 8,
    border: "#22c55e",
  },
  thinking: {
    c1: "oklch(72% 0.12 70)",
    c2: "oklch(68% 0.10 55)",
    c3: "oklch(75% 0.14 80)",
    speed: 6,
    border: "var(--fintheon-accent)",
  },
  error: {
    c1: "oklch(60% 0.20 25)",
    c2: "oklch(55% 0.18 15)",
    c3: "oklch(65% 0.22 30)",
    speed: 30,
    border: "#ef4444",
  },
  infraction: {
    c1: "oklch(60% 0.22 25)",
    c2: "oklch(55% 0.20 15)",
    c3: "oklch(65% 0.24 30)",
    speed: 4,
    border: "#ef4444",
  },
};

export function VoiceAuroraOrb({
  state,
  compact = false,
}: VoiceAuroraOrbProps) {
  const size = compact ? 24 : 28;
  const cfg = STATE_CONFIG[state];
  const blur = Math.max(size * 0.08, 4);
  const contrast = Math.max(size * 0.003, 1.6);
  const orbId = useMemo(
    () => `orb-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  return (
    <>
      <style>{`
        @property --${orbId}-angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }
        @keyframes ${orbId}-rotate {
          from { --${orbId}-angle: 0deg; }
          to { --${orbId}-angle: 360deg; }
        }
      `}</style>

      <div
        aria-hidden="true"
        className="relative rounded-full shrink-0"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          border: `1.5px solid ${cfg.border}`,
          transition: "border-color 0.4s ease",
        }}
      >
        {/* Orb core */}
        <div
          style={{
            position: "absolute",
            inset: "1px",
            borderRadius: "50%",
            overflow: "hidden",
            display: "grid",
            gridTemplateAreas: '"stack"',
            background:
              "radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 30%, transparent 70%)",
          }}
        >
          <div
            style={{
              gridArea: "stack",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: [
                `conic-gradient(from calc(var(--${orbId}-angle) * 1.2) at 30% 65%, ${cfg.c3} 0deg, transparent 45deg 315deg, ${cfg.c3} 360deg)`,
                `conic-gradient(from calc(var(--${orbId}-angle) * 0.8) at 70% 35%, ${cfg.c2} 0deg, transparent 60deg 300deg, ${cfg.c2} 360deg)`,
                `conic-gradient(from calc(var(--${orbId}-angle) * -1.5) at 65% 75%, ${cfg.c1} 0deg, transparent 90deg 270deg, ${cfg.c1} 360deg)`,
                `conic-gradient(from calc(var(--${orbId}-angle) * 2.1) at 25% 25%, ${cfg.c2} 0deg, transparent 30deg 330deg, ${cfg.c2} 360deg)`,
                `radial-gradient(ellipse 120% 80% at 40% 60%, ${cfg.c3} 0%, transparent 50%)`,
              ].join(", "),
              filter: `blur(${blur}px) contrast(${contrast}) saturate(1.3)`,
              animation: `${orbId}-rotate ${cfg.speed}s linear infinite`,
              transform: "translateZ(0)",
              willChange: "transform",
              transition: "filter 0.4s ease",
            }}
          />
          {/* Gloss overlay */}
          <div
            style={{
              gridArea: "stack",
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 45% 55%, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.04) 30%, transparent 60%)",
              mixBlendMode: "overlay",
            }}
          />
        </div>
      </div>
    </>
  );
}
