// [claude-code 2026-04-20] Iso nav icons — Home, Newspaper, Chat, Settings, Menu, Bell
import { IsoIcon, type IsoIconProps } from "./IsoIcon";

type P = Omit<IsoIconProps, "children">;

export function IsoHome(props: P) {
  return (
    <IsoIcon aria-label="Home" {...props}>
      {/* Roof front slope */}
      <path
        d="M 12 24 L 24 12 L 36 24 Z"
        fill="currentColor"
        fillOpacity={0.18}
      />
      {/* Roof right slope */}
      <path
        d="M 36 24 L 24 12 L 28 8 L 40 20 Z"
        fill="currentColor"
        fillOpacity={0.08}
      />
      {/* Front wall */}
      <path
        d="M 12 24 L 36 24 L 36 40 L 12 40 Z"
        fill="currentColor"
        fillOpacity={0.04}
      />
      {/* Right side wall */}
      <path
        d="M 36 24 L 40 20 L 40 36 L 36 40 Z"
        fill="currentColor"
        fillOpacity={0.1}
      />
      {/* Door */}
      <path d="M 20 31 L 26 31 L 26 40 L 20 40 Z" />
      {/* Door knob */}
      <circle cx="24.5" cy="36" r="0.6" fill="currentColor" stroke="none" />
    </IsoIcon>
  );
}

export function IsoNewspaper(props: P) {
  return (
    <IsoIcon aria-label="News" {...props}>
      {/* Bottom sheet (peeks behind) */}
      <path
        d="M 26 19 L 40 26 L 26 33 L 12 26 Z"
        fill="currentColor"
        fillOpacity={0.08}
      />
      {/* Top sheet (primary spread) */}
      <path
        d="M 22 15 L 36 22 L 22 29 L 8 22 Z"
        fill="currentColor"
        fillOpacity={0.16}
      />
      {/* Center fold */}
      <path d="M 15 18.5 L 29 25.5" strokeOpacity={0.55} />
      {/* Headline + subhead left page */}
      <path d="M 13 20 L 19 23" strokeWidth={1.6} />
      <path d="M 13 22 L 17 24" strokeWidth={1.2} strokeOpacity={0.75} />
      {/* Headline + subhead right page */}
      <path d="M 22 23.5 L 28 26.5" strokeWidth={1.6} />
      <path d="M 22 25.5 L 26 27.5" strokeWidth={1.2} strokeOpacity={0.75} />
    </IsoIcon>
  );
}

export function IsoMessageSquare(props: P) {
  return (
    <IsoIcon aria-label="Chat" {...props}>
      {/* Chat bubble body — iso parallelogram */}
      <path
        d="M 10 14 L 34 14 L 38 18 L 38 30 L 32 30 L 28 36 L 26 30 L 14 30 L 10 26 Z"
        fill="currentColor"
        fillOpacity={0.14}
      />
      {/* Right depth fold line */}
      <path d="M 34 14 L 38 18 L 38 30" fill="none" strokeOpacity={0.6} />
      {/* Text line inside bubble */}
      <path d="M 16 20 L 28 20" strokeWidth={1.4} strokeOpacity={0.8} />
      <path d="M 16 24 L 24 24" strokeWidth={1.4} strokeOpacity={0.6} />
    </IsoIcon>
  );
}

export function IsoSettings(props: P) {
  return (
    <IsoIcon aria-label="Settings" {...props}>
      {/* Top face */}
      <path
        d="M 24 18 L 32.66 23 L 24 28 L 15.34 23 Z"
        fill="currentColor"
        fillOpacity={0.18}
      />
      {/* Left face */}
      <path
        d="M 15.34 23 L 24 28 L 24 48 L 15.34 43 Z"
        fill="currentColor"
        fillOpacity={0.06}
      />
      {/* Right face (drawer front) */}
      <path
        d="M 32.66 23 L 32.66 43 L 24 48 L 24 28 Z"
        fill="currentColor"
        fillOpacity={0.02}
      />
      {/* Drawer divider */}
      <path d="M 32.66 33 L 24 38" />
      {/* Knobs */}
      <circle cx="28.33" cy="30.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="28.33" cy="40.5" r="0.9" fill="currentColor" stroke="none" />
    </IsoIcon>
  );
}

export function IsoMenu(props: P) {
  return (
    <IsoIcon aria-label="Menu" {...props}>
      {/* Top bar — iso parallelogram */}
      <path
        d="M 10 14 L 32 14 L 38 18 L 16 18 Z"
        fill="currentColor"
        fillOpacity={0.14}
      />
      {/* Middle bar */}
      <path
        d="M 10 23 L 32 23 L 38 27 L 16 27 Z"
        fill="currentColor"
        fillOpacity={0.14}
      />
      {/* Bottom bar */}
      <path
        d="M 10 32 L 32 32 L 38 36 L 16 36 Z"
        fill="currentColor"
        fillOpacity={0.14}
      />
    </IsoIcon>
  );
}

export function IsoBell(props: P) {
  return (
    <IsoIcon aria-label="Notifications" {...props}>
      {/* Bell dome */}
      <path
        d="M 14 30 Q 14 14 24 14 Q 34 14 34 30 Z"
        fill="currentColor"
        fillOpacity={0.14}
      />
      {/* Base rim */}
      <ellipse
        cx="24"
        cy="30"
        rx="12"
        ry="2.5"
        fill="currentColor"
        fillOpacity={0.06}
      />
      {/* Top nub */}
      <circle cx="24" cy="12" r="1.4" fill="currentColor" stroke="none" />
      {/* Clapper */}
      <circle cx="24" cy="34" r="1.8" fill="currentColor" fillOpacity={0.2} />
      {/* Light rays */}
      <path d="M 10 22 L 7 21" strokeWidth={1.4} strokeOpacity={0.6} />
      <path d="M 38 22 L 41 21" strokeWidth={1.4} strokeOpacity={0.6} />
    </IsoIcon>
  );
}
