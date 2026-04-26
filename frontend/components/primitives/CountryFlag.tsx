// [claude-code 2026-04-25] S40-P6: CountryFlag — emoji-free SVG flag primitive
// for the Time-To-Print widget. v1 supports only US (per Refinement Engine
// country toggle scope). Adding new countries is a one-line case.

import type { JSX } from "react";

interface CountryFlagProps {
  country: string;
  size?: number;
  className?: string;
}

export function CountryFlag({
  country,
  size = 16,
  className = "",
}: CountryFlagProps): JSX.Element {
  const iso = country.toUpperCase();
  switch (iso) {
    case "US":
      return <UsFlag size={size} className={className} />;
    case "EU":
      return <EuFlag size={size} className={className} />;
    case "UK":
    case "GB":
      return <UkFlag size={size} className={className} />;
    case "JP":
      return <JpFlag size={size} className={className} />;
    default:
      return (
        <span
          className={`inline-flex items-center justify-center rounded-sm border border-[var(--fintheon-text)]/20 ${className}`}
          style={{ width: size * 1.5, height: size }}
        >
          <span className="text-[10px] font-mono text-[var(--fintheon-text)]/70">
            {iso.slice(0, 2)}
          </span>
        </span>
      );
  }
}

function UsFlag({ size, className }: { size: number; className: string }) {
  // Simplified flat SVG — accurate aspect, omits stars for legibility at small sizes.
  return (
    <svg
      role="img"
      aria-label="United States"
      viewBox="0 0 60 32"
      width={size * 1.875}
      height={size}
      className={`inline-block ${className}`}
    >
      <rect width="60" height="32" fill="#bf0a30" />
      <rect y="2.46" width="60" height="2.46" fill="#ffffff" />
      <rect y="7.38" width="60" height="2.46" fill="#ffffff" />
      <rect y="12.31" width="60" height="2.46" fill="#ffffff" />
      <rect y="17.23" width="60" height="2.46" fill="#ffffff" />
      <rect y="22.15" width="60" height="2.46" fill="#ffffff" />
      <rect y="27.08" width="60" height="2.46" fill="#ffffff" />
      <rect width="24" height="17.23" fill="#002868" />
    </svg>
  );
}

function EuFlag({ size, className }: { size: number; className: string }) {
  return (
    <svg
      viewBox="0 0 60 32"
      width={size * 1.875}
      height={size}
      className={`inline-block ${className}`}
    >
      <rect width="60" height="32" fill="#003399" />
      <circle
        cx="30"
        cy="16"
        r="6"
        fill="none"
        stroke="#FFCC00"
        strokeWidth="1"
      />
    </svg>
  );
}

function UkFlag({ size, className }: { size: number; className: string }) {
  return (
    <svg
      viewBox="0 0 60 32"
      width={size * 1.875}
      height={size}
      className={`inline-block ${className}`}
    >
      <rect width="60" height="32" fill="#012169" />
      <path d="M0,0 L60,32 M60,0 L0,32" stroke="#ffffff" strokeWidth="3" />
      <path d="M30,0 V32 M0,16 H60" stroke="#ffffff" strokeWidth="6" />
      <path d="M30,0 V32 M0,16 H60" stroke="#C8102E" strokeWidth="3" />
    </svg>
  );
}

function JpFlag({ size, className }: { size: number; className: string }) {
  return (
    <svg
      viewBox="0 0 60 32"
      width={size * 1.875}
      height={size}
      className={`inline-block ${className}`}
    >
      <rect width="60" height="32" fill="#ffffff" />
      <circle cx="30" cy="16" r="9" fill="#bc002d" />
    </svg>
  );
}
