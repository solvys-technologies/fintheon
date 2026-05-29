import type { WorkDrawerTab } from "./NarrativeWorkDrawer";

export interface NarrativeRailPreview {
  tab: Exclude<WorkDrawerTab, "canvas">;
  title: string;
  markdown: string;
  append?: boolean;
  updatedAt: number;
}
