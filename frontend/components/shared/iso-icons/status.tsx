// [claude-code 2026-04-20] Iso status icons — Zap, Crosshair, Sun, Moon, CheckCircle2, XCircle
import { IsoIcon, type IsoIconProps } from "./IsoIcon";

type P = Omit<IsoIconProps, "children">;

export function IsoZap(props: P) {
  return (
    <IsoIcon aria-label="Urgent" {...props}>
      {/* Battery top ellipse */}
      <ellipse
        cx="24"
        cy="12"
        rx="8"
        ry="2.5"
        fill="currentColor"
        fillOpacity={0.18}
      />
      {/* Battery body */}
      <path
        d="M 16 12 L 32 12 L 32 36 Q 32 38.5 24 38.5 Q 16 38.5 16 36 Z"
        fill="currentColor"
        fillOpacity={0.06}
      />
      {/* Top rim */}
      <ellipse cx="24" cy="12" rx="8" ry="2.5" fill="none" />
      {/* Lightning bolt */}
      <path
        d="M 24 16 L 20 26 L 23 26 L 22 34 L 28 22 L 25 22 L 26 16 Z"
        fill="currentColor"
        fillOpacity={0.85}
        strokeWidth={1.2}
      />
    </IsoIcon>
  );
}

export function IsoCrosshair(props: P) {
  return (
    <IsoIcon aria-label="Target" {...props}>
      {/* Outer ring */}
      <circle cx="24" cy="24" r="14" fill="currentColor" fillOpacity={0.04} />
      {/* Middle ring */}
      <circle cx="24" cy="24" r="8" />
      {/* Inner dot */}
      <circle cx="24" cy="24" r="1.8" fill="currentColor" stroke="none" />
      {/* Crosshair ticks */}
      <path d="M 24 6 L 24 10" />
      <path d="M 24 38 L 24 42" />
      <path d="M 6 24 L 10 24" />
      <path d="M 38 24 L 42 24" />
    </IsoIcon>
  );
}

export function IsoSun(props: P) {
  return (
    <IsoIcon aria-label="Light theme" {...props}>
      {/* Sun center */}
      <circle cx="24" cy="24" r="7" fill="currentColor" fillOpacity={0.18} />
      {/* 8 rays */}
      <path d="M 24 8 L 24 12" />
      <path d="M 24 36 L 24 40" />
      <path d="M 8 24 L 12 24" />
      <path d="M 36 24 L 40 24" />
      <path d="M 12.7 12.7 L 15.5 15.5" />
      <path d="M 32.5 32.5 L 35.3 35.3" />
      <path d="M 35.3 12.7 L 32.5 15.5" />
      <path d="M 15.5 32.5 L 12.7 35.3" />
    </IsoIcon>
  );
}

export function IsoMoon(props: P) {
  return (
    <IsoIcon aria-label="Dark theme" {...props}>
      {/* Crescent */}
      <path
        d="M 32 10 A 14 14 0 1 0 32 38 A 11 11 0 1 1 32 10 Z"
        fill="currentColor"
        fillOpacity={0.18}
      />
      {/* Small star accents */}
      <circle cx="14" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle
        cx="10"
        cy="22"
        r="0.7"
        fill="currentColor"
        stroke="none"
        opacity={0.6}
      />
    </IsoIcon>
  );
}

export function IsoCheckCircle2(props: P) {
  return (
    <IsoIcon aria-label="Confirmed" {...props}>
      <circle cx="24" cy="24" r="14" fill="currentColor" fillOpacity={0.1} />
      <path d="M 16 25 L 22 31 L 32 19" strokeWidth={2} />
    </IsoIcon>
  );
}

export function IsoXCircle(props: P) {
  return (
    <IsoIcon aria-label="Rejected" {...props}>
      <circle cx="24" cy="24" r="14" fill="currentColor" fillOpacity={0.08} />
      <path d="M 18 18 L 30 30" strokeWidth={2} />
      <path d="M 30 18 L 18 30" strokeWidth={2} />
    </IsoIcon>
  );
}

export function IsoShieldCheck(props: P) {
  return (
    <IsoIcon aria-label="Verified" {...props}>
      {/* Shield body */}
      <path
        d="M 24 8 L 38 14 L 38 24 Q 38 36 24 42 Q 10 36 10 24 L 10 14 Z"
        fill="currentColor"
        fillOpacity={0.14}
      />
      {/* Inner check */}
      <path d="M 16 24 L 22 30 L 32 18" strokeWidth={2} />
    </IsoIcon>
  );
}
