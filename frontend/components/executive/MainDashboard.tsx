import { DeskDashboardPrototype } from "../desk/DeskDashboardPrototype";

export function MainDashboard({
  onNavigateTab,
  deskSecondPageMode = "all",
}: {
  onNavigateTab?: (tab: string) => void;
  deskSecondPageMode?: "all" | "feed-only";
}) {
  return (
    <DeskDashboardPrototype
      onNavigateTab={onNavigateTab}
      deskSecondPageMode={deskSecondPageMode}
    />
  );
}
