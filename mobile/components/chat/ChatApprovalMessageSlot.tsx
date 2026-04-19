// [claude-code 2026-04-19] S25: STUB — placeholder chat-message renderer for InlineApprovalCard.
//   Behind VITE_CHAT_APPROVAL_DEMO=1 flag so TP can visually confirm placement inside the chat
//   stream before Harper's backend starts emitting real `tool_approval_preview` /
//   `generative_task_preview` message types. Wiring the real flow = updating Harper's SSE
//   stream to emit a new message kind and mapping it here; the card primitive is ready.
import {
  InlineApprovalCard,
  type ApprovalAction,
  type InlineApprovalCardProps,
} from "../approvals/InlineApprovalCard";

interface Props {
  /**
   * Wire this prop from a future Harper chat message of kind `tool_approval_preview` /
   * `generative_task_preview`. Until then the demo flag renders a canned card.
   */
  cardProps?: Omit<InlineApprovalCardProps, "actions"> & {
    actions?: ApprovalAction[];
  };
}

const demoFlag = import.meta.env.VITE_CHAT_APPROVAL_DEMO === "1";

const demoActions: ApprovalAction[] = [
  {
    id: "skip",
    label: "Skip",
    intent: "secondary",
    onClick: () => {
      /* demo */
    },
  },
  {
    id: "run",
    label: "Run",
    intent: "primary",
    onClick: () => {
      /* demo */
    },
  },
];

const demoCard: InlineApprovalCardProps = {
  variant: "generativeTask",
  title: "Draft morning brief",
  subtitle: "Harper · generative task preview",
  description:
    "Compile MDB from overnight RiskFlow + econ calendar + Herald sentiment. ~90s compute.",
  payload: { type: "brief", scope: "MDB", estCost: "$0.12" },
  severity: "medium",
  status: "pending",
  actions: demoActions,
};

export function ChatApprovalMessageSlot({ cardProps }: Props) {
  // Real wiring path — caller passes a fully-formed card
  if (cardProps) {
    return (
      <div style={{ padding: "4px 16px" }}>
        <InlineApprovalCard
          {...cardProps}
          actions={cardProps.actions ?? []}
          compact
        />
      </div>
    );
  }

  // Demo path — only render when the dev flag is on
  if (!demoFlag) return null;

  return (
    <div style={{ padding: "4px 16px" }}>
      <InlineApprovalCard {...demoCard} compact />
    </div>
  );
}
