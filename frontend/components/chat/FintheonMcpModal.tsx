import { useEffect, useRef, useState } from "react";
import { X, Plug, AlertTriangle, Search } from "lucide-react";
import type { McpServerConfig, McpServerId } from "../../types/mcp";

function StatusDot({ server }: { server: McpServerConfig }) {
  if (!server.installed)
    return <span className="w-2 h-2 rounded-full bg-red-500/80 shrink-0" />;
  if (server.requiresApiKey && !server.hasApiKey)
    return <span className="w-2 h-2 rounded-full bg-yellow-500/80 shrink-0" />;
  return <span className="w-2 h-2 rounded-full bg-emerald-500/80 shrink-0" />;
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
      className={`relative inline-flex h-4 w-7 flex-shrink-0 items-center rounded-full transition-colors ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-[var(--fintheon-accent)]" : "bg-white/10"}`}
    >
      <span
        className={`absolute h-3 w-3 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-3.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  data: "Data",
  search: "Search",
  browser: "Browser",
  productivity: "Productivity",
  social: "Social",
  trading: "Trading",
  internal: "Internal",
};

interface FintheonMcpModalProps {
  open: boolean;
  onClose: () => void;
  servers: McpServerConfig[];
  activeIds: McpServerId[];
  onToggle: (id: McpServerId, enabled: boolean) => void;
}

export function FintheonMcpModal({
  open,
  onClose,
  servers,
  activeIds,
  onToggle,
}: FintheonMcpModalProps) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node))
        onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  const filtered = search.trim()
    ? servers.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase()) ||
          s.category.toLowerCase().includes(search.toLowerCase()),
      )
    : servers;

  const grouped = filtered.reduce(
    (acc, s) => {
      const cat = s.category in CATEGORY_LABELS ? s.category : "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    },
    {} as Record<string, McpServerConfig[]>,
  );

  const activeCount = activeIds.length;
  const totalCount = servers.length;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="MCP Connectors"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(5, 4, 2, 0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
      }}
    >
      <div
        ref={dialogRef}
        style={{
          width: 420,
          maxWidth: "calc(100vw - 40px)",
          maxHeight: "calc(100vh - 80px)",
          background: "rgba(10, 8, 5, 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border:
            "1px solid color-mix(in srgb, var(--fintheon-accent) 20%, transparent)",
          boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 16px",
            borderBottom:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Plug size={14} strokeWidth={2.2} color="var(--fintheon-accent)" />
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--fintheon-accent)",
              }}
            >
              MCP Connectors
            </span>
            <span style={{ fontSize: 10, color: "rgba(240,234,214,0.3)" }}>
              {activeCount}/{totalCount} active
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--fintheon-muted)",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div
          style={{
            padding: "8px 12px",
            borderBottom:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 8%, transparent)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: "rgba(255,255,255,0.03)",
              border:
                "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
            }}
          >
            <Search size={12} color="rgba(240,234,214,0.25)" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search connectors..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--fintheon-text)",
                fontSize: 11,
                fontFamily: "var(--font-body)",
              }}
            />
          </div>
        </div>

        {/* Connector list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px" }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat}>
              <div
                style={{
                  padding: "6px 12px 4px",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(240,234,214,0.25)",
                }}
              >
                {CATEGORY_LABELS[cat] ?? cat}
              </div>
              {items.map((server) => {
                const isActive = activeIds.includes(server.id);
                const canToggle = server.installed;

                return (
                  <div
                    key={server.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      transition: "background 0.1s",
                    }}
                  >
                    <StatusDot server={server} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: "var(--fintheon-text)",
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {server.name}
                      </span>
                      {server.description && (
                        <span
                          style={{
                            fontSize: 9,
                            color: "rgba(240,234,214,0.3)",
                            display: "block",
                            marginTop: 1,
                          }}
                        >
                          {server.description}
                        </span>
                      )}
                    </div>
                    {server.requiresApiKey && !server.hasApiKey && (
                      <AlertTriangle
                        size={12}
                        className="text-yellow-500/60 shrink-0"
                      />
                    )}
                    <Toggle
                      checked={isActive && canToggle}
                      onChange={(v) => onToggle(server.id, v)}
                      disabled={!canToggle}
                    />
                  </div>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "rgba(240,234,214,0.25)",
                fontSize: 11,
              }}
            >
              No connectors found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
