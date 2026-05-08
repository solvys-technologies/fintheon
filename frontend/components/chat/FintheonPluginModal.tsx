import { useEffect, useRef } from "react";
import { X, Check, AlertTriangle } from "lucide-react";
import type { SkillDef } from "../../lib/skills";

interface FintheonPluginModalProps {
  open: boolean;
  onClose: () => void;
  skills: readonly SkillDef[];
  activeSkill: string | null;
  onSelectSkill: (id: string | null) => void;
  disabledSkills?: Record<string, { reason: string }>;
}

export function FintheonPluginModal({
  open,
  onClose,
  skills,
  activeSkill,
  onSelectSkill,
  disabledSkills,
}: FintheonPluginModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Plugins & Skills"
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
          width: 400,
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="var(--fintheon-accent)"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <rect x="2" y="2" width="10" height="10" rx="2" />
              <path d="M5 7h4M7 5v4" />
            </svg>
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
              Plugins
            </span>
            <span style={{ fontSize: 10, color: "rgba(240,234,214,0.3)" }}>
              {skills.length} available
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

        {/* Skills list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "4px" }}>
          {skills.map((skill) => {
            const Icon = skill.icon;
            const active = activeSkill === skill.id;
            const disabled = disabledSkills?.[skill.id];
            const isDisabled = !!disabled;

            return (
              <button
                key={skill.id}
                onClick={() => {
                  if (isDisabled) return;
                  onSelectSkill(active ? null : skill.id);
                  if (!active) onClose();
                }}
                disabled={isDisabled}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  background: active
                    ? `color-mix(in srgb, ${skill.color} 8%, transparent)`
                    : "transparent",
                  border: "none",
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  textAlign: "left",
                  opacity: isDisabled ? 0.4 : 1,
                  transition: "background 0.1s",
                }}
              >
                <Icon
                  size={14}
                  style={{
                    color: active ? skill.color : "rgba(240,234,214,0.35)",
                    marginTop: 2,
                  }}
                  className="shrink-0"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: active
                          ? "var(--fintheon-text)"
                          : "rgba(240,234,214,0.8)",
                      }}
                    >
                      {skill.label}
                    </span>
                    {active && (
                      <Check
                        size={11}
                        strokeWidth={2.5}
                        style={{ color: skill.color }}
                      />
                    )}
                    {isDisabled && disabled && (
                      <AlertTriangle
                        size={10}
                        className="text-yellow-500/60 shrink-0"
                      />
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 10,
                      color: active
                        ? "rgba(240,234,214,0.45)"
                        : "rgba(240,234,214,0.3)",
                      margin: "2px 0 0",
                      lineHeight: 1.4,
                    }}
                  >
                    {disabled ? disabled.reason : skill.description}
                  </p>
                  {skill.mcpServers && skill.mcpServers.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        gap: 4,
                        marginTop: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      {skill.mcpServers.map((server) => (
                        <span
                          key={server}
                          style={{
                            fontSize: 8,
                            padding: "1px 5px",
                            background:
                              "color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
                            color:
                              "color-mix(in srgb, var(--fintheon-accent) 50%, transparent)",
                          }}
                        >
                          {server}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "8px 16px",
            borderTop:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 10%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 9, color: "rgba(240,234,214,0.25)" }}>
            {activeSkill
              ? `${skills.find((s) => s.id === activeSkill)?.label ?? "Plugin"} active`
              : "No plugin active"}
          </span>
          {activeSkill && (
            <button
              onClick={() => {
                onSelectSkill(null);
                onClose();
              }}
              style={{
                fontSize: 9,
                color: "rgba(240,234,214,0.4)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "underline",
                fontFamily: "var(--font-body)",
              }}
            >
              Deactivate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
