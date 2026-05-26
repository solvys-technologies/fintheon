import { DeskDashboardPrototype } from "../desk/DeskDashboardPrototype";

export function MainDashboard({
  onNavigateTab,
}: {
  onNavigateTab?: (tab: string) => void;
}) {
  return <DeskDashboardPrototype onNavigateTab={onNavigateTab} />;
}
