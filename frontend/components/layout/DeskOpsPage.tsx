import type { ReactNode } from "react";
import { Bot, Database, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useGateway } from "../../contexts/GatewayContext";
import { useSystemStatus } from "../../hooks/useSystemStatus";
import { HarperOpsPanel } from "../harper-ops/HarperOpsPanel";
import { TeamPanel } from "../team/TeamPanel";
import { StatusIndicator } from "../ui/StatusIndicator";

export function DeskOpsPage() {
  const { overall, services, isChecking, refreshNow } = useSystemStatus();
  const { status: gatewayStatus } = useGateway();
  const gatewayLevel =
    gatewayStatus === "connected"
      ? "ok"
      : gatewayStatus === "connecting"
        ? "degraded"
        : "error";

  return (
    <div className="h-full overflow-y-auto bg-[var(--fintheon-bg)] px-3 py-4 text-[var(--fintheon-text)]">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--fintheon-accent)]" />
            <h1 className="text-[12px] font-semibold uppercase tracking-[0.24em] text-[var(--fintheon-accent)]">
              Desk Ops
            </h1>
          </div>
          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/60">
            Team, Harper, and service status
          </p>
        </div>
        <button
          type="button"
          onClick={refreshNow}
          className="grid h-9 w-9 place-items-center rounded-full border border-[var(--fintheon-accent)]/18 text-[var(--fintheon-accent)]/75 transition-colors hover:border-[var(--fintheon-accent)]/34 hover:text-[var(--fintheon-accent)]"
          aria-label="Refresh desk ops status"
          title="Refresh status"
        >
          <RefreshCw
            className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`}
          />
        </button>
      </header>

      <section className="mb-4 rounded-[8px] border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-surface)]/82 p-3">
        <div className="mb-3 flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-[var(--fintheon-accent)]" />
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
            Systems
          </h2>
          <span className="ml-auto">
            <StatusIndicator
              label="fintheon"
              status={gatewayStatus !== "connected" ? "error" : overall}
              detail={
                gatewayStatus !== "connected"
                  ? "Backend offline"
                  : overall === "ok"
                    ? "All systems nominal"
                    : overall === "degraded"
                      ? "Some services degraded"
                      : "Services unavailable"
              }
            />
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatusPill
            label="Gateway"
            status={gatewayLevel}
            detail={
              gatewayStatus === "connected"
                ? "Backend reachable"
                : gatewayStatus === "connecting"
                  ? "Connecting"
                  : "Disconnected"
            }
          />
          {services.slice(0, 7).map((svc) => (
            <StatusPill
              key={svc.key}
              label={svc.name}
              status={svc.status}
              detail={svc.detail}
            />
          ))}
        </div>
      </section>

      <section className="mb-4 min-h-[260px] rounded-[8px] border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-surface)]/72">
        <SectionHeader icon={<Users className="h-3.5 w-3.5" />} label="Team" />
        <div className="h-[300px] min-h-0">
          <TeamPanel />
        </div>
      </section>

      <section className="min-h-[340px] rounded-[8px] border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-surface)]/72">
        <SectionHeader
          icon={<Bot className="h-3.5 w-3.5" />}
          label="Harper Ops"
        />
        <div className="h-[360px] min-h-0">
          <HarperOpsPanel />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex h-10 items-center gap-2 border-b border-[var(--fintheon-accent)]/10 px-3 text-[var(--fintheon-accent)]">
      {icon}
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.18em]">
        {label}
      </h2>
    </div>
  );
}

function StatusPill({
  label,
  status,
  detail,
}: {
  label: string;
  status: "ok" | "degraded" | "error" | "unknown";
  detail?: string;
}) {
  return (
    <div className="min-w-0 rounded-[6px] border border-[var(--fintheon-accent)]/10 bg-black/12 px-2 py-2">
      <StatusIndicator label={label} status={status} detail={detail} />
      {detail ? (
        <p className="mt-1 truncate text-[9px] text-[var(--fintheon-muted)]/55">
          {detail}
        </p>
      ) : null}
    </div>
  );
}
