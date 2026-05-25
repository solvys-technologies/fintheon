import { Trash2 } from "lucide-react";
import type { DayPlan } from "../../types/day-plan";

export function DeletePlanButton({
  plan,
  deletingId,
  onDelete,
}: {
  plan: DayPlan;
  deletingId: string | null;
  onDelete: (plan: DayPlan) => void;
}) {
  const isSynthetic = plan.id.startsWith("plan-") || plan.id.startsWith("mem-");
  return (
    <button
      type="button"
      disabled={isSynthetic || deletingId === plan.id}
      onClick={(event) => {
        event.stopPropagation();
        onDelete(plan);
      }}
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] border border-transparent text-[var(--fintheon-muted)]/45 transition-[transform,border-color,color,opacity] duration-200 hover:-translate-y-px hover:border-[var(--fintheon-bearish)]/20 hover:text-[var(--fintheon-bearish)] active:translate-y-0 disabled:cursor-default disabled:opacity-25"
      title={isSynthetic ? "Generated preview cannot be deleted" : "Delete desk plan"}
      aria-label="Delete desk plan"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}
