// [claude-code 2026-04-20] Iso sidebar icons — LogOut, Landmark, GripVertical, Chevrons pairs, BookOpenCheck, BellOff, Wrench
import { IsoIcon, type IsoIconProps } from "./IsoIcon";

type P = Omit<IsoIconProps, "children">;

export function IsoLogOut(props: P) {
  return (
    <IsoIcon aria-label="Log out" {...props}>
      {/* Door frame */}
      <path d="M 22 10 L 10 10 L 10 38 L 22 38" strokeWidth={1.8} />
      {/* Arrow line */}
      <path d="M 20 24 L 40 24" strokeWidth={2} />
      {/* Arrowhead */}
      <path d="M 32 16 L 40 24 L 32 32" strokeWidth={1.8} />
    </IsoIcon>
  );
}

export function IsoLandmark(props: P) {
  return (
    <IsoIcon aria-label="Bank" {...props}>
      {/* Pediment */}
      <path d="M 6 18 L 24 10 L 42 18" strokeWidth={1.8} />
      {/* Columns */}
      <path d="M 11 20 L 11 34" />
      <path d="M 18 20 L 18 34" />
      <path d="M 30 20 L 30 34" />
      <path d="M 37 20 L 37 34" />
      {/* Base */}
      <path d="M 6 36 L 42 36" strokeWidth={1.8} />
      {/* Shading on pediment */}
      <path
        d="M 6 18 L 24 10 L 42 18 Z"
        fill="currentColor"
        fillOpacity={0.08}
        stroke="none"
      />
    </IsoIcon>
  );
}

export function IsoGripVertical(props: P) {
  return (
    <IsoIcon aria-label="Drag handle" {...props}>
      <circle cx="19" cy="13" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="29" cy="13" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="24" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="29" cy="24" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="19" cy="35" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="29" cy="35" r="1.8" fill="currentColor" stroke="none" />
    </IsoIcon>
  );
}

export function IsoChevronsLeft(props: P) {
  return (
    <IsoIcon aria-label="Collapse" {...props}>
      <path d="M 22 14 L 12 24 L 22 34" strokeWidth={2.2} />
      <path d="M 34 14 L 24 24 L 34 34" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoChevronsRight(props: P) {
  return (
    <IsoIcon aria-label="Expand" {...props}>
      <path d="M 14 14 L 24 24 L 14 34" strokeWidth={2.2} />
      <path d="M 26 14 L 36 24 L 26 34" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoBookOpenCheck(props: P) {
  return (
    <IsoIcon aria-label="Performance" {...props}>
      {/* Book spine + left page */}
      <path
        d="M 24 14 L 10 14 L 10 38 L 24 38"
        fill="currentColor"
        fillOpacity={0.08}
      />
      {/* Right page */}
      <path
        d="M 24 14 L 38 14 L 38 38 L 24 38 Z"
        fill="currentColor"
        fillOpacity={0.12}
      />
      {/* Spine */}
      <path d="M 24 14 L 24 38" strokeWidth={1.8} />
      {/* Check on right page */}
      <path d="M 28 27 L 32 31 L 36 23" strokeWidth={1.8} />
      {/* Left page lines */}
      <path d="M 14 21 L 20 21" strokeWidth={1.2} strokeOpacity={0.6} />
      <path d="M 14 25 L 20 25" strokeWidth={1.2} strokeOpacity={0.5} />
      <path d="M 14 29 L 20 29" strokeWidth={1.2} strokeOpacity={0.4} />
    </IsoIcon>
  );
}

export function IsoBellOff(props: P) {
  return (
    <IsoIcon aria-label="Notifications off" {...props}>
      {/* Bell dome (silhouette) */}
      <path
        d="M 14 30 Q 14 14 24 14 Q 34 14 34 30 Z"
        fill="currentColor"
        fillOpacity={0.08}
      />
      <ellipse
        cx="24"
        cy="30"
        rx="12"
        ry="2.5"
        fill="currentColor"
        fillOpacity={0.04}
      />
      {/* Slash through bell */}
      <path d="M 10 10 L 38 38" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoWrench(props: P) {
  return (
    <IsoIcon aria-label="Tools" {...props}>
      {/* Wrench body — head on upper-left, handle to lower-right */}
      <path
        d="M 16 8 A 6 6 0 1 0 10 14 L 14 14 L 14 18 L 18 18 L 32 32 A 4 4 0 1 0 36 36 L 22 22 L 22 18 L 18 18"
        strokeWidth={1.6}
        fill="currentColor"
        fillOpacity={0.08}
      />
    </IsoIcon>
  );
}
