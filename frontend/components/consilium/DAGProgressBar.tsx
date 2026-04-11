// [claude-code 2026-04-10] S8-T4: DAG execution wave progress bar
import type { HermesAgentId } from "../../../backend-hono/src/services/agent-bus/types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DAGProgressBarProps {
  currentWave: number;
  totalWaves: number;
  tasks: Array<{ id: string; agentId: HermesAgentId | string; status: string }>;
  dagStatus: "idle" | "dispatching" | "running" | "complete" | "error";
}

// ── Constants ─────────────────────────────────────────────────────────────────

const WAVE_LABELS: Record<number, string> = {
  0: "Analysis",
  1: "Deliberation",
  2: "Synthesis",
};

const AGENT_INITIALS: Record<string, string> = {
  oracle: "O",
  feucht: "F",
  consul: "C",
  herald: "He",
  harper: "H",
};

// ── Task dot ─────────────────────────────────────────────────────────────────

function TaskDot({ agentId, status }: { agentId: string; status: string }) {
  const isRunning = status === "running";
  const isComplete = status === "complete";
  const isError = status === "failed" || status === "error";

  let colorClass = "bg-[#f0ead6]/15"; // pending
  if (isRunning) colorClass = "bg-[#c79f4a]";
  else if (isComplete) colorClass = "bg-[#c79f4a]/50";
  else if (isError) colorClass = "bg-red-500/60";

  return (
    <span
      title={`${agentId}: ${status}`}
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[8px] font-bold text-[#050402] ${colorClass} ${isRunning ? "animate-pulse" : ""}`}
    >
      {AGENT_INITIALS[agentId] ?? agentId[0]?.toUpperCase()}
    </span>
  );
}

// ── Wave segment ──────────────────────────────────────────────────────────────

function WaveSegment({
  waveIndex,
  isActive,
  isPast,
  label,
  tasks,
}: {
  waveIndex: number;
  isActive: boolean;
  isPast: boolean;
  label: string;
  tasks: DAGProgressBarProps["tasks"];
}) {
  const waveTasks = tasks.filter((_, i) => {
    // Distribute tasks across waves by index — backend provides correct wave membership
    return true;
  });

  // Build background fill
  let fillClass = "bg-[#f0ead6]/5"; // future wave
  if (isPast) fillClass = "bg-[#c79f4a]/12";
  if (isActive) fillClass = "bg-[#c79f4a]/18";

  let labelColor = "text-[#f0ead6]/20";
  if (isActive) labelColor = "text-[#c79f4a]";
  else if (isPast) labelColor = "text-[#f0ead6]/40";

  return (
    <div
      className={`flex flex-1 flex-col gap-1 rounded px-2 py-1.5 transition-colors ${fillClass}`}
      style={{
        outline: isActive
          ? "1px solid rgba(199,159,74,0.25)"
          : "1px solid transparent",
        outlineOffset: "-1px",
      }}
    >
      <div className="flex items-center gap-1">
        {/* Wave index dot */}
        <span
          className={`h-1 w-1 shrink-0 rounded-full ${
            isActive
              ? "bg-[#c79f4a] animate-pulse"
              : isPast
                ? "bg-[#c79f4a]/40"
                : "bg-[#f0ead6]/15"
          }`}
        />
        <span
          className={`text-[9px] font-medium tracking-wider uppercase ${labelColor}`}
        >
          {label}
        </span>
        {isPast && !isActive && (
          <svg
            className="ml-auto text-[#c79f4a]/40"
            width="8"
            height="8"
            viewBox="0 0 10 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2,5 4,7.5 8,3" />
          </svg>
        )}
      </div>

      {/* Agent dots for tasks in this wave */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-0.5">
          {tasks.map((t) => (
            <TaskDot key={t.id} agentId={t.agentId} status={t.status} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DAGProgressBar({
  currentWave,
  totalWaves,
  tasks,
  dagStatus,
}: DAGProgressBarProps) {
  const waveCount = Math.max(totalWaves, 3);
  const isComplete = dagStatus === "complete";
  const isError = dagStatus === "error";

  // For display purposes, split tasks by wave index in the tasks array
  // Backend should group them; we approximate by dividing evenly
  const tasksPerWave = Math.ceil(tasks.length / Math.max(waveCount, 1));

  return (
    <div className="flex flex-col gap-1 px-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] font-mono uppercase tracking-widest text-[#c79f4a]/50">
          DAG Execution
        </span>
        <span
          className={`text-[9px] font-mono uppercase tracking-wider ${
            isComplete
              ? "text-[#c79f4a]/60"
              : isError
                ? "text-red-400/60"
                : "text-[#f0ead6]/25"
          }`}
        >
          {isComplete
            ? "Complete"
            : isError
              ? "Error"
              : dagStatus === "dispatching"
                ? "Dispatching..."
                : `Wave ${currentWave + 1}/${waveCount}`}
        </span>
      </div>

      <div className="flex gap-1">
        {Array.from({ length: waveCount }, (_, i) => {
          const isPast = isComplete || i < currentWave;
          const isActive = !isComplete && !isError && i === currentWave;
          const label = WAVE_LABELS[i] ?? `Wave ${i + 1}`;
          // Assign tasks to waves by slice
          const waveTasks = tasks.slice(
            i * tasksPerWave,
            (i + 1) * tasksPerWave,
          );

          return (
            <WaveSegment
              key={i}
              waveIndex={i}
              isActive={isActive}
              isPast={isPast}
              label={label}
              tasks={waveTasks}
            />
          );
        })}
      </div>
    </div>
  );
}
