// [claude-code 2026-03-22] Track 4: combined Tools dropdown merging Skills + Connectors
import { useState, useRef, useEffect } from "react";
import { Settings2, Check, AlertTriangle } from "lucide-react";
import type { SkillDef } from "../../lib/skills";
import type { McpServerConfig, McpServerId } from "../../types/mcp";

interface ToolsDropdownProps {
  // Skills
  skills: readonly SkillDef[];
  activeSkill: string | null;
  onSelectSkill: (id: string | null) => void;
  disabledSkills?: Record<string, { reason: string }>;
  // Connectors
  servers: McpServerConfig[];
  activeConnectorIds: McpServerId[];
  onToggleConnector: (id: McpServerId, enabled: boolean) => void;
}

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex h-3.5 w-6 flex-shrink-0 items-center rounded-full transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-[var(--fintheon-accent)]" : "bg-white/10"}`}
    >
      <span
        className={`absolute h-2.5 w-2.5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-3" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

function StatusDot({ server }: { server: McpServerConfig }) {
  if (!server.installed)
    return <span className="w-1.5 h-1.5 rounded-full bg-red-500/80 shrink-0" />;
  if (server.requiresApiKey && !server.hasApiKey)
    return (
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/80 shrink-0" />
    );
  return (
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shrink-0" />
  );
}

export function ToolsDropdown({
  skills,
  activeSkill,
  onSelectSkill,
  disabledSkills,
  servers,
  activeConnectorIds,
  onToggleConnector,
}: ToolsDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeCount = activeConnectorIds.length;

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={[
          "relative flex items-center justify-center rounded-lg transition-colors",
          open
            ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
            : "text-zinc-500 hover:text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10",
        ].join(" ")}
        style={{ width: "32px", height: "32px" }}
        title="Tools"
      >
        <Settings2 size={14} />
        {(activeSkill || activeCount > 0) && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--fintheon-accent)]" />
        )}
      </button>

      {/* Popup */}
      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 w-[260px] rounded-xl border border-[var(--fintheon-accent)]/20 overflow-hidden shadow-xl z-50"
          style={{ backgroundColor: "#0a0805" }}
        >
          {/* Skills section */}
          <div className="px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--fintheon-accent)]/50">
              Skills
            </span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "180px" }}>
            {skills.map((skill) => {
              const Icon = skill.icon;
              const active = activeSkill === skill.id;
              const disabled = disabledSkills?.[skill.id];

              return (
                <button
                  key={skill.id}
                  onClick={() => {
                    if (disabled) return;
                    onSelectSkill(active ? null : skill.id);
                  }}
                  className={[
                    "w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left",
                    disabled
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-white/[0.03]",
                  ].join(" ")}
                  style={
                    active && !disabled
                      ? { backgroundColor: `${skill.color}15` }
                      : undefined
                  }
                >
                  <Icon
                    size={13}
                    style={{ color: active ? skill.color : "#6B7280" }}
                    className="shrink-0"
                  />
                  <span
                    className={`text-[11px] font-medium flex-1 truncate ${active ? "text-white" : "text-zinc-400"}`}
                  >
                    {skill.label}
                  </span>
                  {active && !disabled && (
                    <Check
                      size={12}
                      style={{ color: skill.color }}
                      className="shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-[var(--fintheon-accent)]/10" />

          {/* Connectors section */}
          <div className="px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--fintheon-accent)]/50">
              Connectors
            </span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "180px" }}>
            {servers.map((server) => {
              const isActive = activeConnectorIds.includes(server.id);
              const canToggle = server.installed;

              return (
                <div
                  key={server.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/[0.025] transition-colors"
                >
                  <StatusDot server={server} />
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-zinc-300 truncate block">
                      {server.name}
                    </span>
                  </div>
                  {server.requiresApiKey && !server.hasApiKey && (
                    <AlertTriangle
                      size={10}
                      className="text-yellow-500/60 shrink-0"
                    />
                  )}
                  <Toggle
                    checked={isActive && canToggle}
                    onChange={(v) => onToggleConnector(server.id, v)}
                    disabled={!canToggle}
                  />
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="px-3 py-1.5 border-t border-[var(--fintheon-accent)]/10">
            <span className="text-[9px] text-zinc-600">
              {activeCount} connector{activeCount !== 1 ? "s" : ""} active
              {activeSkill
                ? ` · ${skills.find((s) => s.id === activeSkill)?.label ?? "Skill"} on`
                : ""}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
