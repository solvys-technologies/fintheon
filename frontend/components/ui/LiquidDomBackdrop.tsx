import { useEffect, useMemo, useState } from "react";
import {
  Frame,
  Glass,
  GlassContainer,
  LiquidCanvas,
  ZStack,
} from "@liquid-dom/react";
import type { RgbaColor } from "@liquid-dom/core";

type ViewportSize = {
  width: number;
  height: number;
};

const fallbackTint: RgbaColor = { r: 0.78, g: 0.62, b: 0.29, a: 0.2 };

function readViewportSize(): ViewportSize {
  if (typeof window === "undefined") return { width: 1600, height: 980 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function canRenderLiquidDom(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return "gpu" in navigator;
}

function parseCssColor(value: string): RgbaColor | null {
  const color = value.trim();
  const hexMatch = /^#?([0-9a-f]{6})$/i.exec(color);
  if (hexMatch) {
    const raw = hexMatch[1];
    return {
      r: Number.parseInt(raw.slice(0, 2), 16) / 255,
      g: Number.parseInt(raw.slice(2, 4), 16) / 255,
      b: Number.parseInt(raw.slice(4, 6), 16) / 255,
      a: 0.2,
    };
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(color);
  if (!rgbMatch) return null;
  const channels = rgbMatch[1]
    .split(",")
    .map((part) => Number.parseFloat(part.trim()))
    .filter((part) => Number.isFinite(part));
  if (channels.length < 3) return null;
  return {
    r: channels[0] / 255,
    g: channels[1] / 255,
    b: channels[2] / 255,
    a: 0.2,
  };
}

function readPrimaryTint(): RgbaColor {
  if (typeof window === "undefined") return fallbackTint;
  const computed = window.getComputedStyle(document.documentElement);
  return (
    parseCssColor(computed.getPropertyValue("--fintheon-primary")) ??
    parseCssColor(computed.getPropertyValue("--fintheon-accent")) ??
    fallbackTint
  );
}

export function LiquidDomBackdrop({ enabled }: { enabled: boolean }) {
  const [supported, setSupported] = useState(false);
  const [size, setSize] = useState<ViewportSize>(() => readViewportSize());
  const [tint, setTint] = useState<RgbaColor>(() => fallbackTint);

  useEffect(() => {
    setSupported(enabled && canRenderLiquidDom());
    setTint(readPrimaryTint());
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onResize = () => setSize(readViewportSize());
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, [enabled]);

  const geometry = useMemo(() => {
    return {
      shellWidth: Math.max(size.width, 1),
      shellHeight: Math.max(size.height, 1),
    };
  }, [size.height, size.width]);

  if (!enabled || !supported) return null;

  return (
    <div className="fintheon-liquid-dom-backdrop" aria-hidden="true">
      <LiquidCanvas
        style={{ width: "100%", height: "100%" }}
        canvasStyle={{ width: "100%", height: "100%" }}
        proposal={{ width: size.width, height: size.height }}
        frameloop="demand"
        maxDpr={1.25}
        onError={() => setSupported(false)}
      >
        <GlassContainer
          blur={18}
          spacing={26}
          opacity={0.5}
          tint={tint}
          displacementFactor={0.18}
          displacementBlur={10}
          thickness={18}
          specularStrength={0.28}
          specularOpacity={0.3}
          shadowColor={{ r: 0, g: 0, b: 0, a: 0.24 }}
          shadowBlur={22}
          shadowSpread={0}
        >
          <ZStack>
            <Frame width={geometry.shellWidth} height={geometry.shellHeight}>
              <Glass cornerRadius={0} cornerSmoothing={0.3} />
            </Frame>
          </ZStack>
        </GlassContainer>
      </LiquidCanvas>
    </div>
  );
}
