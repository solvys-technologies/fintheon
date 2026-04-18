// [claude-code 2026-04-19] S25: single mount point for the full-viewport DetailSheet. Reads
//   NotificationModalContext, dispatches on `kind`, and handles "Ask CAO" dispatch success by
//   closing the sheet + routing to the Chat tab.
import { useCallback } from "react";
import { DetailSheet } from "../shared/DetailSheet";
import { useNotificationModal } from "../../contexts/NotificationModalContext";
import { ToolApprovalDetail } from "./ToolApprovalDetail";
import { RiskFlowDetail } from "./RiskFlowDetail";
import { CatalystDetail } from "./CatalystDetail";
import { BriefDetail } from "./BriefDetail";

interface Props {
  /** Called when the user successfully fires Ask CAO — App.tsx routes to Chat tab. */
  onDispatched?: (conversationId: string) => void;
}

export function DetailSheetRoot({ onDispatched }: Props) {
  const { current, close } = useNotificationModal();

  const handleDispatched = useCallback(
    (conversationId: string) => {
      close();
      onDispatched?.(conversationId);
    },
    [close, onDispatched],
  );

  if (!current) {
    return <DetailSheet isOpen={false} onClose={close} children={null} />;
  }

  const ariaLabel =
    current.kind === "toolApproval"
      ? "Tool approval"
      : current.kind === "riskflowItem"
        ? "Headline detail"
        : current.kind === "catalyst"
          ? "Catalyst detail"
          : "Daily brief";

  return (
    <DetailSheet isOpen={true} onClose={close} ariaLabel={ariaLabel}>
      {current.kind === "toolApproval" && (
        <ToolApprovalDetail approvalId={current.approvalId} onClose={close} />
      )}
      {current.kind === "riskflowItem" && (
        <RiskFlowDetail
          itemId={current.itemId}
          onClose={close}
          onDispatched={handleDispatched}
        />
      )}
      {current.kind === "catalyst" && (
        <CatalystDetail
          catalystId={current.catalystId}
          onClose={close}
          onDispatched={handleDispatched}
        />
      )}
      {current.kind === "dailyBrief" && (
        <BriefDetail
          briefId={current.briefId}
          onClose={close}
          onDispatched={handleDispatched}
        />
      )}
    </DetailSheet>
  );
}
