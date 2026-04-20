// [claude-code 2026-04-20] Sample isometric Settings icon — drawer cabinet in 3/4 view
import { IsoIcon, type IsoIconProps } from "./IsoIcon";

export function IsoSettings(props: Omit<IsoIconProps, "children">) {
  return (
    <IsoIcon aria-label="Settings" {...props}>
      {/* Top face (rhombus) — brightest tone */}
      <path
        d="M 24 18 L 32.66 23 L 24 28 L 15.34 23 Z"
        fill="currentColor"
        fillOpacity={0.18}
      />
      {/* Left face (front-left, recessed) — darkest tone */}
      <path
        d="M 15.34 23 L 24 28 L 24 48 L 15.34 43 Z"
        fill="currentColor"
        fillOpacity={0.06}
      />
      {/* Right face (drawers) — mid tone */}
      <path
        d="M 32.66 23 L 32.66 43 L 24 48 L 24 28 Z"
        fill="currentColor"
        fillOpacity={0.02}
      />
      {/* Drawer divider on right face */}
      <path d="M 32.66 33 L 24 38" />
      {/* Drawer knobs (filled dots) */}
      <circle cx="28.33" cy="30.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="28.33" cy="40.5" r="0.9" fill="currentColor" stroke="none" />
    </IsoIcon>
  );
}
