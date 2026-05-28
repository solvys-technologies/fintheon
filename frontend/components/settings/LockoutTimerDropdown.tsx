import { useState } from "react";
import type { BriefingAnchor, LockoutState } from "../../hooks/useLockout";

const LOCKOUT_TIMER_OPTIONS = [
  { value: "mdb", label: "Morning Daily Brief", anchor: "mdb" },
  { value: "adb", label: "Afternoon Daily Brief", anchor: "adb" },
  { value: "pmdb", label: "PM Daily Brief", anchor: "pmdb" },
  { value: "am-ny", label: "AM NY session (8:55AM)", hour: 8, minute: 55 },
  {
    value: "am-pm-ny",
    label: "AM-PM NY session (10:20AM)",
    hour: 10,
    minute: 20,
  },
  { value: "desk-plan", label: "Next Desk Plan" },
  { value: "ny-close", label: "NY Market Close", hour: 16, minute: 0 },
] as const;

type LockoutTimerOption = (typeof LOCKOUT_TIMER_OPTIONS)[number]["value"];

interface LockoutTimerDropdownProps {
  lockUntil: (isoTimestamp: string) => Promise<boolean>;
  lockUntilBriefing: (anchor: BriefingAnchor) => Promise<LockoutState>;
  lockUntilDeskSession: () => Promise<LockoutState>;
}

function nextSystemLockoutIso(hour: number, minute: number): string {
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= Date.now()) {
    target.setDate(target.getDate() + 1);
  }
  return target.toISOString();
}

export function LockoutTimerDropdown({
  lockUntil,
  lockUntilBriefing,
  lockUntilDeskSession,
}: LockoutTimerDropdownProps) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (nextValue: LockoutTimerOption | "") => {
    setValue(nextValue);
    setError(null);
    if (!nextValue) return;

    const option = LOCKOUT_TIMER_OPTIONS.find(
      (item) => item.value === nextValue,
    );
    if (!option) return;

    setBusy(true);
    try {
      const ok =
        option.value === "desk-plan"
          ? (await lockUntilDeskSession()).locked
          : "anchor" in option
            ? (await lockUntilBriefing(option.anchor as BriefingAnchor)).locked
            : "hour" in option
              ? await lockUntil(
                  nextSystemLockoutIso(option.hour, option.minute),
                )
              : false;
      if (!ok) setError("Could not set lock timer.");
    } finally {
      setBusy(false);
      setValue("");
    }
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-400 shrink-0">Lock timer</label>
        <select
          value={value}
          disabled={busy}
          onChange={(event) =>
            handleChange(event.target.value as LockoutTimerOption | "")
          }
          className="min-w-[220px] bg-[var(--fintheon-surface)] border border-zinc-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[var(--fintheon-accent)]/30 disabled:opacity-50"
        >
          <option value="">{busy ? "Setting..." : "Choose lock timer"}</option>
          {LOCKOUT_TIMER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </>
  );
}
