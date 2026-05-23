// [codex 2026-05-23] dot/matrix loader wrapper. Source SVGs are vendored from
// dot-matrix-animations, tinted to the active theme, and clipped to circles.
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

export type DotMatrixLoaderVariant =
  | "diagonal-scan"
  | "pyramid"
  | "twin-orbit"
  | "cipher"
  | "loading"
  | "thinking"
  | "stream"
  | "beacon"
  | "orbit"
  | "verify";

interface DotMatrixLoaderProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: DotMatrixLoaderVariant;
  size?: number | string;
  color?: string;
  label?: string;
  speed?: number;
  success?: boolean;
}

const VARIANT_ICON: Record<DotMatrixLoaderVariant, string> = {
  "diagonal-scan": "icon-08",
  pyramid: "icon-13",
  "twin-orbit": "icon-17",
  cipher: "icon-25",
  loading: "icon-07",
  thinking: "icon-19",
  stream: "icon-20",
  beacon: "icon-11",
  orbit: "icon-16",
  verify: "icon-58",
};

const SVG_CACHE = new Map<string, string>();

function assetPath(icon: string): string {
  const base = import.meta.env.BASE_URL || "./";
  return `${base}${base.endsWith("/") ? "" : "/"}dot-matrix/${icon}.svg`;
}

function resolveSize(size: number | string): string {
  return typeof size === "number" ? `${size}px` : size;
}

function tintSvg(source: string, speed: number): string {
  return source
    .replace(/<svg\b([^>]*)>/, '<svg$1 focusable="false">')
    .replace(/fill="#(?:fff|ffffff)"/gi, 'fill="currentColor"')
    .replace(/fill:\s*#(?:fff|ffffff)/gi, "fill:currentColor")
    .replace(/(\d+(?:\.\d+)?)ms/g, (_, value: string) => {
      const scaled = Math.round(Number(value) * speed);
      return `${scaled}ms`;
    });
}

function useDotMatrixSvg(iconUrl: string): string {
  const [rawSvg, setRawSvg] = useState(() => SVG_CACHE.get(iconUrl) ?? "");

  useEffect(() => {
    let active = true;
    const cached = SVG_CACHE.get(iconUrl);

    if (cached) {
      setRawSvg(cached);
      return () => {
        active = false;
      };
    }

    setRawSvg("");
    fetch(iconUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`loader_svg_${response.status}`);
        return response.text();
      })
      .then((svg) => {
        SVG_CACHE.set(iconUrl, svg);
        if (active) setRawSvg(svg);
      })
      .catch(() => {
        if (active) setRawSvg("");
      });

    return () => {
      active = false;
    };
  }, [iconUrl]);

  return rawSvg;
}

function FallbackDots() {
  return (
    <svg viewBox="0 0 24 24" className="dm-loader__fallback">
      <circle cx="7" cy="7" r="2.2" />
      <circle cx="17" cy="7" r="2.2" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="7" cy="17" r="2.2" />
      <circle cx="17" cy="17" r="2.2" />
    </svg>
  );
}

export function DotMatrixLoader({
  variant = "loading",
  size = 18,
  color = "var(--fintheon-primary, var(--fintheon-accent))",
  label,
  speed = 1.25,
  success = false,
  className,
  style,
  ...props
}: DotMatrixLoaderProps) {
  const resolvedSize = resolveSize(size);
  const iconUrl = assetPath(VARIANT_ICON[variant]);
  const rawSvg = useDotMatrixSvg(iconUrl);
  const svgMarkup = useMemo(
    () => (rawSvg ? tintSvg(rawSvg, speed) : ""),
    [rawSvg, speed],
  );
  const mergedStyle: CSSProperties = {
    "--dm-loader-color": color,
    "--dm-loader-speed": speed,
    "--dm-loader-duration": `${1300 * speed}ms`,
    width: resolvedSize,
    height: resolvedSize,
    ...style,
  } as CSSProperties;

  return (
    <span
      className={`dm-loader${success ? " dm-loader--success" : ""}${className ? ` ${className}` : ""}`}
      role="status"
      aria-label={label ?? (success ? "Saved" : "Loading")}
      style={mergedStyle}
      {...props}
    >
      <span className="dm-loader__disc" aria-hidden="true">
        {success ? (
          <svg viewBox="0 0 24 24" className="dm-loader__check">
            <path d="M5 12.5l4.1 4.1L19 6.7" />
          </svg>
        ) : svgMarkup ? (
          <span
            className="dm-loader__svg"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : (
          <span className="dm-loader__svg">
            <FallbackDots />
          </span>
        )}
      </span>
      {label ? <span className="dm-loader__label">{label}</span> : null}
    </span>
  );
}

export function DotMatrixSuccess({
  size = 18,
  color = "rgb(52 211 153)",
  label,
  className,
}: Pick<DotMatrixLoaderProps, "size" | "color" | "label" | "className">) {
  return (
    <DotMatrixLoader
      success
      size={size}
      color={color}
      label={label}
      className={className}
    />
  );
}
