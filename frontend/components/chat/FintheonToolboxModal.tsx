// [codex 2026-05-23] Unified skills + connectors popup for the composer toolbox.
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Plug, Search, X } from "lucide-react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onMouseDown = (event: MouseEvent) => {
      if (!dialogRef.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, onClose]);

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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Skills and connectors"
      className="fixed inset-0 z-[80] flex items-end justify-center p-4 pointer-events-none"
    >
      <div
        ref={dialogRef}
        className="pointer-events-auto flex max-h-[66vh] w-[560px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-lg border border-[var(--fintheon-accent)]/15 bg-[#0a0905]"
      >
        <div className="flex items-center justify-between border-b border-[var(--fintheon-accent)]/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <Plug size={13} className="text-[var(--fintheon-accent)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fintheon-accent)]">
              Skills + Connectors
            </span>
            <span className="text-[9px] text-[var(--fintheon-text)]/30">
              {activeIds.length}/{servers.length} active
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[var(--fintheon-text)]/30 transition-colors hover:text-[var(--fintheon-text)]/70"
          >
            <X size={13} />
          </button>
        </div>

        <div className="border-b border-[var(--fintheon-accent)]/10 p-2">
          <div className="flex items-center gap-2 border border-[var(--fintheon-accent)]/10 bg-[#050402] px-2 py-1.5">
            <Search size={11} className="text-[var(--fintheon-text)]/30" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search skills or connectors..."
              className="flex-1 bg-transparent text-[11px] text-[var(--fintheon-text)] outline-none placeholder:text-[var(--fintheon-text)]/25"
            />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-2">
          <section className="border-b border-[var(--fintheon-accent)]/10 md:border-b-0 md:border-r md:border-[var(--fintheon-accent)]/10">
            <div className="sticky top-0 bg-[#0a0905] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--fintheon-text)]/30">
              Skills
            </div>
            {filteredSkills.map((skill) => {
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
                  className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--fintheon-accent)]/6 ${
                    disabled ? "cursor-not-allowed opacity-40" : ""
                  }`}
                >
                  <Icon
                    size={13}
                    className="mt-0.5 shrink-0"
                    style={{
                      color: isActive
                        ? skill.color
                        : "rgba(240,234,214,0.35)",
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-[var(--fintheon-text)]/80">
                        {skill.label}
                      </span>
                      {isActive && <Check size={10} style={{ color: skill.color }} />}
                      {disabled && (
                        <AlertTriangle size={10} className="text-yellow-500/60" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-[var(--fintheon-text)]/35">
                      {disabled?.reason ?? skill.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </section>

          <section>
            <div className="sticky top-0 bg-[#0a0905] px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--fintheon-text)]/30">
              Connectors
            </div>
            {filteredServers.map((server) => {
              const isActive = activeIds.includes(server.id);
              const canToggle = server.installed;
              return (
                <button
                  key={server.id}
                  type="button"
                  disabled={!canToggle}
                  onClick={() => onToggleConnector(server.id, !isActive)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[var(--fintheon-accent)]/6 ${
                    canToggle ? "" : "cursor-not-allowed opacity-40"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      isActive ? "bg-emerald-500" : "bg-[var(--fintheon-text)]/20"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium text-[var(--fintheon-text)]/80">
                      {server.name}
                    </span>
                    <span className="block truncate text-[10px] text-[var(--fintheon-text)]/30">
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
          </section>
        </div>
      </div>
    </div>
  );
}
