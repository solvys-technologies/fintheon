// [codex 2026-05-23] Canonical inline drawer for chat input skills + connectors.
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Plug, Search, Sparkles, X } from "lucide-react";
import type { SkillDef } from "../../lib/skills";
import type { McpServerConfig, McpServerId } from "../../types/mcp";

interface FintheonToolboxModalProps {
  open: boolean;
  onClose: () => void;
  skills: readonly SkillDef[];
  activeSkill: string | null;
  onSelectSkill: (id: string | null) => void;
  disabledSkills?: Record<string, { reason: string }>;
  servers: McpServerConfig[];
  activeIds: McpServerId[];
  onToggleConnector: (id: McpServerId, enabled: boolean) => void;
}

type ToolboxTab = "skills" | "connectors";

function ConnectorToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
        checked ? "bg-[var(--fintheon-accent)]" : "bg-[#f0ead6]/10"
      } ${disabled ? "cursor-not-allowed opacity-35" : "cursor-pointer"}`}
    >
      <span
        className={`absolute h-3 w-3 rounded-full bg-[#050402] transition-transform ${
          checked ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

export function FintheonToolboxModal({
  open,
  onClose,
  skills,
  activeSkill,
  onSelectSkill,
  disabledSkills,
  servers,
  activeIds,
  onToggleConnector,
}: FintheonToolboxModalProps) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ToolboxTab>("skills");
  const [visibleTab, setVisibleTab] = useState<ToolboxTab>("skills");
  const [tabAnimating, setTabAnimating] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  function switchTab(nextTab: ToolboxTab) {
    if (nextTab === tab) return;
    setTabAnimating(true);
    setTimeout(() => {
      setVisibleTab(nextTab);
      setTab(nextTab);
      requestAnimationFrame(() => setTabAnimating(false));
    }, 150);
  }

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (skill) =>
        skill.label.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        skill.keywords.some((keyword) => keyword.includes(q)),
    );
  }, [query, skills]);

  const filteredServers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter(
      (server) =>
        server.name.toLowerCase().includes(q) ||
        server.description.toLowerCase().includes(q) ||
        server.category.toLowerCase().includes(q),
    );
  }, [query, servers]);

  return (
    <div
      role="region"
      aria-label="Skills and connectors drawer"
      aria-hidden={!open}
      className={`fintheon-chat-input-drawer transition-all duration-300 ${
        open ? "pointer-events-auto" : "pointer-events-none"
      }`}
      style={{
        maxHeight: open ? "280px" : "0px",
        opacity: open ? 1 : 0,
        boxShadow: open ? undefined : "none",
      }}
    >
      <div className="flex max-h-[280px] min-h-0 flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Plug size={13} className="text-[#f0ead6]/48" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f0ead6]/62">
              Skills + Connectors
            </span>
            <span className="rounded-full bg-white/[0.055] px-1.5 py-0.5 text-[9px] text-[#f0ead6]/38">
              {activeIds.length}/{servers.length} active
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#f0ead6]/34 transition-colors hover:bg-white/[0.055] hover:text-[#f0ead6]/70"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex">
          <button
            type="button"
            onClick={() => switchTab("skills")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors ${
              tab === "skills"
                ? "border-b-2 border-[var(--fintheon-accent)] text-[var(--fintheon-accent)]"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Sparkles size={12} />
            Skills
          </button>
          <button
            type="button"
            onClick={() => switchTab("connectors")}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors ${
              tab === "connectors"
                ? "border-b-2 border-[var(--fintheon-accent)] text-[var(--fintheon-accent)]"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Plug size={12} />
            Connectors
          </button>
        </div>

        <div
          className="min-h-0 flex-1 px-4 py-3"
          style={{
            opacity: tabAnimating ? 0 : 1,
            transform: tabAnimating ? "translateY(4px)" : "translateY(0)",
            transition: "opacity 150ms ease, transform 150ms ease",
          }}
        >
          <div className="flex items-center gap-2 rounded-md bg-black/18 px-2 py-1.5">
            <Search size={11} className="text-[#f0ead6]/30" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills or connectors..."
              className="flex-1 bg-transparent text-[11px] text-[#f0ead6]/75 outline-none placeholder:text-[#f0ead6]/28"
            />
          </div>

          <div className="mt-2 max-h-[164px] overflow-y-auto">
            {visibleTab === "skills" &&
              filteredSkills.map((skill) => {
                const Icon = skill.icon;
                const isActive = activeSkill === skill.id;
                const disabled = disabledSkills?.[skill.id];
                return (
                  <button
                    key={skill.id}
                    type="button"
                    disabled={!!disabled}
                    onClick={() => {
                      if (disabled) return;
                      onSelectSkill(isActive ? null : skill.id);
                      if (!isActive) onClose();
                    }}
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.045] ${
                      disabled ? "cursor-not-allowed opacity-40" : ""
                    }`}
                  >
                    <Icon
                      size={13}
                      className="mt-0.5 shrink-0"
                      style={{
                        color: isActive
                          ? skill.color
                          : "rgba(240,234,214,0.38)",
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-[#f0ead6]/78">
                          {skill.label}
                        </span>
                        {isActive && <Check size={10} style={{ color: skill.color }} />}
                        {disabled && (
                          <AlertTriangle size={10} className="text-yellow-500/60" />
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-[#f0ead6]/36">
                        {disabled?.reason ?? skill.description}
                      </span>
                    </span>
                  </button>
                );
              })}

            {visibleTab === "connectors" &&
              filteredServers.map((server) => {
                const isActive = activeIds.includes(server.id);
                const canToggle = server.installed;
                return (
                  <button
                    key={server.id}
                    type="button"
                    disabled={!canToggle}
                    onClick={() => onToggleConnector(server.id, !isActive)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/[0.045] ${
                      canToggle ? "" : "cursor-not-allowed opacity-40"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        isActive ? "bg-emerald-500" : "bg-[#f0ead6]/20"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] font-medium text-[#f0ead6]/78">
                        {server.name}
                      </span>
                      <span className="block truncate text-[10px] text-[#f0ead6]/34">
                        {server.description}
                      </span>
                    </span>
                    <ConnectorToggle
                      checked={isActive}
                      disabled={!canToggle}
                      onChange={(checked) => onToggleConnector(server.id, checked)}
                    />
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
