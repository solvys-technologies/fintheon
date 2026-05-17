import { useEffect, useMemo, useState } from "react";
import type { ZoomLevel } from "../../lib/narrative-types";
import type { Theme } from "../../hooks/useThemes";
import { useNarrativeOrchestra } from "../../hooks/useNarrativeOrchestra";
import { NarrativeAgentRail } from "./NarrativeAgentRail";
import { NarrativeAmbientCanvas } from "./NarrativeAmbientCanvas";
import { NarrativeEvidenceConstellation } from "./NarrativeEvidenceConstellation";
import { NarrativeRoutingGate } from "./NarrativeRoutingGate";
import { NarrativeStorySpine } from "./NarrativeStorySpine";

interface NarrativeCanvasProps {
  zoomLevel?: ZoomLevel;
  visibleLaneIds?: Set<string>;
  themes: Theme[];
  isLoading?: boolean;
}

export function NarrativeCanvas({
  zoomLevel,
  visibleLaneIds,
  themes,
  isLoading = false,
}: NarrativeCanvasProps) {
  const {
    projection,
    hypotheses,
    isLoading: isProjectionLoading,
    isRefreshing,
    error,
    refresh,
  } = useNarrativeOrchestra();
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedHypothesisId && hypotheses.some((item) => item.id === selectedHypothesisId)) return;
    setSelectedHypothesisId(hypotheses[0]?.id ?? null);
  }, [hypotheses, selectedHypothesisId]);

  const selectedHypothesis = useMemo(
    () => hypotheses.find((item) => item.id === selectedHypothesisId) ?? null,
    [hypotheses, selectedHypothesisId],
  );

  const handleLaneSelect = (laneId: string) => {
    const matching = hypotheses.find((item) => item.themeIds.includes(laneId));
    if (matching) setSelectedHypothesisId(matching.id);
  };

  return (
    <div className="relative h-full min-h-0 flex-1 overflow-hidden bg-[var(--fintheon-bg)]">
      <NarrativeAmbientCanvas
        zoomLevel={zoomLevel}
        visibleLaneIds={visibleLaneIds}
        onLaneSelect={handleLaneSelect}
      />

      <div className="absolute inset-0 bg-[var(--fintheon-bg)]/62" />

      <div className="relative z-10 grid h-full min-h-0 gap-3 p-3 lg:grid-cols-[300px_minmax(0,1fr)_280px] lg:grid-rows-[minmax(0,1fr)_auto]">
        <NarrativeStorySpine
          hypotheses={hypotheses}
          selectedId={selectedHypothesisId}
          isLoading={isLoading || isProjectionLoading}
          error={error}
          source={projection.source}
          fallbackReason={projection.fallbackReason}
          themeCount={themes.length}
          onSelect={setSelectedHypothesisId}
          onRefresh={refresh}
        />

        <div className="min-h-0">
          <NarrativeEvidenceConstellation hypothesis={selectedHypothesis} />
        </div>

        <NarrativeAgentRail hypothesis={selectedHypothesis} />

        <div className="lg:col-start-2 lg:col-end-4">
          <NarrativeRoutingGate
            hypothesis={selectedHypothesis}
            generatedAt={projection.generatedAt}
            isRefreshing={isRefreshing}
            onRefresh={refresh}
          />
        </div>
      </div>
    </div>
  );
}
