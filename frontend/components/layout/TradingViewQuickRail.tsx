// [codex 2026-05-25] Shared TradingView quick rail for Consilium split surfaces.
import { SanctumChart } from "../narrative/SanctumChart";

interface TradingViewQuickRailProps {
  open: boolean;
  selectedSymbol: string;
}

export function TradingViewQuickRail({
  open,
  selectedSymbol,
}: TradingViewQuickRailProps) {
  return (
    <aside
      aria-hidden={!open}
      className={`min-w-0 shrink-0 overflow-hidden border-l border-[color-mix(in_srgb,var(--fintheon-accent)_15%,transparent)] bg-[var(--fintheon-bg)] transition-[flex-basis,transform,opacity,border-color] duration-300 ease-out ${
        open ? "" : "pointer-events-none border-transparent"
      }`}
      style={{
        flex: `0 0 ${open ? "50%" : "0%"}`,
        opacity: open ? 1 : 0,
        transform: open ? "translateX(0)" : "translateX(100%)",
      }}
    >
      <div className="h-full min-h-0 w-full">
        <SanctumChart selectedSymbol={selectedSymbol} />
      </div>
    </aside>
  );
}
