// [claude-code 2026-04-23] S30-T1 heatmaps + KPI flip — top-row heatmap pair.

import { TradeActivityHeatmap } from "./TradeActivityHeatmap";
import { FuturesDailyHeatmap } from "./FuturesDailyHeatmap";
import {
  DEFAULT_FUSE_PALETTE,
  type FusePalette,
} from "../../../lib/fuse-palette";

interface PerformanceHeatmapsRowProps {
  palette?: FusePalette;
  defaultContract?: string;
}

export function PerformanceHeatmapsRow({
  palette = DEFAULT_FUSE_PALETTE,
  defaultContract,
}: PerformanceHeatmapsRowProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <TradeActivityHeatmap palette={palette} />
      <FuturesDailyHeatmap
        palette={palette}
        defaultContract={defaultContract}
      />
    </div>
  );
}
