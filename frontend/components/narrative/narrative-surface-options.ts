import {
  BriefcaseBusiness,
  Check,
  Map,
  RadioTower,
  Stadium,
  type LucideIcon,
} from "lucide-react";

export type NarrativeSurfaceMode =
  | "workspace"
  | "forecasts"
  | "coliseum"
  | "resolved"
  | "map";

export const NARRATIVE_SURFACE_OPTIONS: {
  id: NarrativeSurfaceMode;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    id: "workspace",
    label: "Workspace",
    description: "Build and refine the active NarrativeFlow session.",
    icon: BriefcaseBusiness,
  },
  {
    id: "forecasts",
    label: "Forecasts",
    description: "Review desk forecasts and publishable thesis calls.",
    icon: RadioTower,
  },
  {
    id: "coliseum",
    label: "Coliseum",
    description: "Closed-beta forecast arena and desk proof layer.",
    icon: Stadium,
  },
  {
    id: "resolved",
    label: "Resolved",
    description: "Track forecast outcomes after monitor history accrues.",
    icon: Check,
  },
  {
    id: "map",
    label: "DeskMap",
    description: "View All Narratives",
    icon: Map,
  },
];

export function isNarrativeSurfaceMode(
  value: unknown,
): value is NarrativeSurfaceMode {
  return NARRATIVE_SURFACE_OPTIONS.some((option) => option.id === value);
}
