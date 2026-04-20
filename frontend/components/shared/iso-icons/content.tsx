// [claude-code 2026-04-20] Iso content icons — Search, Paperclip, StickyNote, Clock, CalendarDays, Trash2, RefreshCw, ExternalLink, MessageCircle
import { IsoIcon, type IsoIconProps } from "./IsoIcon";

type P = Omit<IsoIconProps, "children">;

export function IsoSearch(props: P) {
  return (
    <IsoIcon aria-label="Search" {...props}>
      {/* Lens */}
      <circle cx="20" cy="20" r="9" fill="currentColor" fillOpacity={0.1} />
      {/* Lens inner highlight */}
      <circle
        cx="17"
        cy="17"
        r="2"
        fill="currentColor"
        fillOpacity={0.25}
        stroke="none"
      />
      {/* Handle */}
      <path d="M 27 27 L 38 38" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoPaperclip(props: P) {
  return (
    <IsoIcon aria-label="Attach" {...props}>
      {/* Outer clip */}
      <path
        d="M 30 14 L 30 32 Q 30 38 24 38 Q 18 38 18 32 L 18 18 Q 18 13 22 13 Q 26 13 26 18 L 26 30"
        strokeWidth={2}
      />
    </IsoIcon>
  );
}

export function IsoStickyNote(props: P) {
  return (
    <IsoIcon aria-label="Note" {...props}>
      {/* Note body with folded corner — iso parallelogram */}
      <path
        d="M 10 14 L 30 14 L 38 22 L 38 36 L 14 38 L 10 34 Z"
        fill="currentColor"
        fillOpacity={0.14}
      />
      {/* Folded-corner triangle */}
      <path
        d="M 30 14 L 30 22 L 38 22 Z"
        fill="currentColor"
        fillOpacity={0.06}
      />
      {/* Text lines */}
      <path d="M 16 22 L 26 22" strokeWidth={1.4} strokeOpacity={0.7} />
      <path d="M 16 26 L 30 26" strokeWidth={1.4} strokeOpacity={0.55} />
      <path d="M 16 30 L 24 30" strokeWidth={1.4} strokeOpacity={0.4} />
    </IsoIcon>
  );
}

export function IsoClock(props: P) {
  return (
    <IsoIcon aria-label="Time" {...props}>
      {/* Watch face */}
      <circle cx="24" cy="26" r="12" fill="currentColor" fillOpacity={0.08} />
      {/* Stem */}
      <path d="M 22 12 L 26 12" strokeWidth={2} />
      <path d="M 23 10 L 25 10" strokeWidth={1.4} />
      {/* Hands */}
      <path d="M 24 26 L 24 19" strokeWidth={1.6} />
      <path d="M 24 26 L 30 28" strokeWidth={1.6} />
      {/* Center pin */}
      <circle cx="24" cy="26" r="1.1" fill="currentColor" stroke="none" />
    </IsoIcon>
  );
}

export function IsoCalendarDays(props: P) {
  return (
    <IsoIcon aria-label="Calendar" {...props}>
      {/* Body */}
      <path
        d="M 10 14 L 38 14 L 38 40 L 10 40 Z"
        fill="currentColor"
        fillOpacity={0.1}
      />
      {/* Top header strip */}
      <path
        d="M 10 14 L 38 14 L 38 20 L 10 20 Z"
        fill="currentColor"
        fillOpacity={0.16}
      />
      {/* Binding rings */}
      <path d="M 17 10 L 17 16" strokeWidth={2} />
      <path d="M 31 10 L 31 16" strokeWidth={2} />
      {/* Date grid dots */}
      <circle cx="17" cy="27" r="1" fill="currentColor" stroke="none" />
      <circle cx="24" cy="27" r="1" fill="currentColor" stroke="none" />
      <circle cx="31" cy="27" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="34" r="1" fill="currentColor" stroke="none" />
      <circle
        cx="24"
        cy="34"
        r="1"
        fill="currentColor"
        stroke="none"
        opacity={0.5}
      />
      <circle
        cx="31"
        cy="34"
        r="1"
        fill="currentColor"
        stroke="none"
        opacity={0.5}
      />
    </IsoIcon>
  );
}

export function IsoTrash2(props: P) {
  return (
    <IsoIcon aria-label="Delete" {...props}>
      {/* Lid */}
      <path d="M 8 14 L 40 14" strokeWidth={2} />
      {/* Handle on lid */}
      <path d="M 20 14 L 20 10 L 28 10 L 28 14" strokeWidth={1.6} />
      {/* Body */}
      <path
        d="M 12 16 L 36 16 L 34 40 L 14 40 Z"
        fill="currentColor"
        fillOpacity={0.1}
      />
      {/* Inner slots */}
      <path d="M 20 20 L 20 36" strokeWidth={1.4} strokeOpacity={0.55} />
      <path d="M 28 20 L 28 36" strokeWidth={1.4} strokeOpacity={0.55} />
    </IsoIcon>
  );
}

export function IsoRefreshCw(props: P) {
  return (
    <IsoIcon aria-label="Refresh" {...props}>
      {/* Main arc (3/4 circle) */}
      <path d="M 36 24 A 12 12 0 1 0 24 36" strokeWidth={2} />
      {/* Arrowhead at end */}
      <path d="M 19 31 L 24 36 L 19 41" strokeWidth={1.8} />
      {/* Small accent arc (opposite) */}
      <path d="M 12 24 A 12 12 0 0 1 18 13.5" strokeOpacity={0.4} />
    </IsoIcon>
  );
}

export function IsoExternalLink(props: P) {
  return (
    <IsoIcon aria-label="Open external" {...props}>
      {/* Box (open top-right) */}
      <path d="M 22 14 L 10 14 L 10 38 L 34 38 L 34 26" strokeWidth={1.8} />
      {/* Arrow line */}
      <path d="M 22 26 L 40 8" strokeWidth={2} />
      {/* Arrowhead */}
      <path d="M 28 8 L 40 8 L 40 20" strokeWidth={1.8} />
    </IsoIcon>
  );
}

export function IsoMessageCircle(props: P) {
  return (
    <IsoIcon aria-label="Message" {...props}>
      {/* Bubble with tail */}
      <path
        d="M 24 10 A 14 14 0 1 1 16 36 L 10 40 L 12 33 A 14 14 0 0 1 24 10 Z"
        fill="currentColor"
        fillOpacity={0.12}
      />
      {/* Chat dots */}
      <circle cx="18" cy="24" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="24" cy="24" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="30" cy="24" r="1.2" fill="currentColor" stroke="none" />
    </IsoIcon>
  );
}
