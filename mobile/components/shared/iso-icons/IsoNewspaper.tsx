// [claude-code 2026-04-20] Sample isometric Newspaper icon — folded spread with headline + subhead
import { IsoIcon, type IsoIconProps } from "./IsoIcon";

export function IsoNewspaper(props: Omit<IsoIconProps, "children">) {
  return (
    <IsoIcon aria-label="News" {...props}>
      {/* Bottom sheet (behind, peeks out bottom-right) */}
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
      {/* Center fold (vertical spine across the spread) */}
      <path d="M 15 18.5 L 29 25.5" strokeOpacity={0.55} />
      {/* Headline line (left page) */}
      <path d="M 13 20 L 19 23" strokeWidth={1.6} />
      {/* Subhead line (left page) */}
      <path d="M 13 22 L 17 24" strokeWidth={1.2} strokeOpacity={0.75} />
      {/* Headline line (right page) */}
      <path d="M 22 23.5 L 28 26.5" strokeWidth={1.6} />
      {/* Subhead line (right page) */}
      <path d="M 22 25.5 L 26 27.5" strokeWidth={1.2} strokeOpacity={0.75} />
    </IsoIcon>
  );
}
