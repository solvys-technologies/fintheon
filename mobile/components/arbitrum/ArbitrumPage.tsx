import { ArbitrumChamber } from "./ArbitrumChamber";
import { TimelineView } from "../home/TimelineView";

export function ArbitrumPage() {
  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        overscrollBehavior: "contain",
        padding: "8px 12px calc(48px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <ArbitrumChamber />
      <div className="fade-divider" style={{ margin: "18px 4px 16px" }} />
      <TimelineView />
    </div>
  );
}
