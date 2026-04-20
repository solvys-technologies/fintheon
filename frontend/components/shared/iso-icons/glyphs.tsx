// [claude-code 2026-04-20] Flat glyph icons — Check, X, Plus, Minus, Chevrons, Arrows. Matches iso stroke weight; no 3/4 perspective.
import { IsoIcon, type IsoIconProps } from "./IsoIcon";

type P = Omit<IsoIconProps, "children">;

export function IsoCheck(props: P) {
  return (
    <IsoIcon aria-label="Check" {...props}>
      <path d="M 10 25 L 20 35 L 38 15" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoX(props: P) {
  return (
    <IsoIcon aria-label="Close" {...props}>
      <path d="M 13 13 L 35 35" strokeWidth={2.2} />
      <path d="M 35 13 L 13 35" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoPlus(props: P) {
  return (
    <IsoIcon aria-label="Add" {...props}>
      <path d="M 24 10 L 24 38" strokeWidth={2.2} />
      <path d="M 10 24 L 38 24" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoMinus(props: P) {
  return (
    <IsoIcon aria-label="Remove" {...props}>
      <path d="M 10 24 L 38 24" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoChevronUp(props: P) {
  return (
    <IsoIcon aria-label="Chevron up" {...props}>
      <path d="M 10 30 L 24 16 L 38 30" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoChevronDown(props: P) {
  return (
    <IsoIcon aria-label="Chevron down" {...props}>
      <path d="M 10 18 L 24 32 L 38 18" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoChevronRight(props: P) {
  return (
    <IsoIcon aria-label="Chevron right" {...props}>
      <path d="M 18 10 L 32 24 L 18 38" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoArrowUp(props: P) {
  return (
    <IsoIcon aria-label="Arrow up" {...props}>
      <path d="M 24 38 L 24 10" strokeWidth={2.2} />
      <path d="M 13 21 L 24 10 L 35 21" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoArrowRight(props: P) {
  return (
    <IsoIcon aria-label="Arrow right" {...props}>
      <path d="M 10 24 L 38 24" strokeWidth={2.2} />
      <path d="M 27 13 L 38 24 L 27 35" strokeWidth={2.2} />
    </IsoIcon>
  );
}

export function IsoArrowUpRight(props: P) {
  return (
    <IsoIcon aria-label="Arrow up-right" {...props}>
      <path d="M 12 36 L 36 12" strokeWidth={2.2} />
      <path d="M 18 12 L 36 12 L 36 30" strokeWidth={2.2} />
    </IsoIcon>
  );
}
