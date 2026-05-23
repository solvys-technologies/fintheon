import { NarrativeWorkDrawer } from "./NarrativeWorkDrawer";
import type { SensemakingResponse } from "./sensemaking-types";

interface NarrativeSensemakingDetailProps {
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
}

export function NarrativeSensemakingDetail({
  response,
  selectedNodeId,
}: NarrativeSensemakingDetailProps) {
  return (
    <NarrativeWorkDrawer
      session={null}
      response={response}
      selectedNodeId={selectedNodeId}
    />
  );
}
