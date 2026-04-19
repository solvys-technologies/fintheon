// [claude-code 2026-04-19] S28: Monitor tab is now the operational home of RoutinesConsole.
//   Stripped the stubbed /api/scoring/monitoring/* + /api/scoring/shadow-stats placeholders that
//   never went live past T4-8. Real controls live on real routines now (news worker audits land
//   alongside the existing 8 via the registry).
// [claude-code 2026-04-18] S24-T4: Monitoring loop status + shadow-stats + graduation controls
import { RoutinesConsole } from "../refinement/RoutinesConsole";

export function MonitoringLoopCard() {
  return (
    <div className="h-full overflow-y-auto p-3">
      <RoutinesConsole />
    </div>
  );
}
