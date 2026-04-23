// [claude-code 2026-04-18] S24-T4: Preset selector for scoring sensitivities
import { useState } from "react";
import { Save, ChevronDown } from "lucide-react";
import type { SensitivityValues } from "./GroupSensitivityDial";

export interface ScoringPreset {
  id: string;
  name: string;
  sensitivities: SensitivityValues;
  builtin: boolean;
  createdAt?: string;
}

/** Built-in presets surfaced when the backend returns nothing. */
export const BUILTIN_PRESETS: ScoringPreset[] = [
  {
    id: "builtin:neutral",
    name: "Neutral (Default)",
    sensitivities: {
      macro: 0,
      geopolitical: 0,
      corporate: 0,
      technical: 0,
      speaker: 0,
    },
    builtin: true,
  },
  {
    id: "builtin:conservative",
    name: "Conservative",
    sensitivities: {
      macro: -0.3,
      geopolitical: -0.5,
      corporate: -0.2,
      technical: -0.2,
      speaker: -0.5,
    },
    builtin: true,
  },
  {
    id: "builtin:aggressive",
    name: "Aggressive",
    sensitivities: {
      macro: 0.3,
      geopolitical: 0.2,
      corporate: 0.4,
      technical: 0.3,
      speaker: 0.1,
    },
    builtin: true,
  },
  {
    id: "builtin:geo-focused",
    name: "Geo-focused",
    sensitivities: {
      macro: 0,
      geopolitical: 0.6,
      corporate: -0.2,
      technical: -0.1,
      speaker: 0.3,
    },
    builtin: true,
  },
];

export function PresetSelector({
  presets,
  selectedId,
  onSelect,
  onSaveCurrent,
  disabled,
}: {
  presets: ScoringPreset[];
  selectedId: string | null;
  onSelect: (preset: ScoringPreset) => void;
  onSaveCurrent: (name: string) => Promise<void> | void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const selected = presets.find((p) => p.id === selectedId) ?? presets[0];

  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) return;
    await onSaveCurrent(name);
    setSaveName("");
    setSaveOpen(false);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--fintheon-muted)",
          }}
        >
          Preset
        </span>
        <button
          onClick={() => setSaveOpen((v) => !v)}
          disabled={disabled}
          aria-label="Save current settings as preset"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 8px",
            fontSize: 10,
            fontFamily: "var(--font-data)",
            letterSpacing: "0.04em",
            color: "var(--fintheon-accent)",
            background: "transparent",
            border:
              "1px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
            borderRadius: 3,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <Save size={10} />
          Save as…
        </button>
      </div>
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={disabled}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 10px",
            fontSize: 12,
            fontFamily: "var(--font-data)",
            color: "var(--fintheon-text)",
            background: "transparent",
            border: "1px solid var(--fintheon-glass-border)",
            borderRadius: 4,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <span>{selected?.name ?? "(none)"}</span>
          <ChevronDown
            size={12}
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 140ms ease",
              opacity: 0.6,
            }}
          />
        </button>
        {open && (
          <div
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--fintheon-bg)",
              border: "1px solid var(--fintheon-glass-border)",
              borderRadius: 4,
              zIndex: 20,
              maxHeight: 240,
              overflowY: "auto",
            }}
          >
            {presets.map((p) => (
              <button
                key={p.id}
                role="option"
                aria-selected={p.id === selectedId}
                onClick={() => {
                  onSelect(p);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  fontSize: 12,
                  fontFamily: "var(--font-data)",
                  color:
                    p.id === selectedId
                      ? "var(--fintheon-accent)"
                      : "var(--fintheon-text)",
                  background:
                    p.id === selectedId
                      ? "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)"
                      : "transparent",
                  border: "none",
                  borderBottom: "1px solid var(--fintheon-glass-border)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span>{p.name}</span>
                {p.builtin && (
                  <span
                    style={{
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      color: "var(--fintheon-muted)",
                    }}
                  >
                    BUILT-IN
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {saveOpen && (
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            padding: "6px 0",
          }}
        >
          <input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
              if (e.key === "Escape") setSaveOpen(false);
            }}
            placeholder="Preset name"
            autoFocus
            style={{
              flex: 1,
              padding: "6px 8px",
              fontSize: 12,
              fontFamily: "var(--font-data)",
              color: "var(--fintheon-text)",
              background: "transparent",
              border: "1px solid var(--fintheon-glass-border)",
              borderRadius: 3,
              outline: "none",
            }}
          />
          <button
            onClick={handleSave}
            disabled={!saveName.trim()}
            style={{
              padding: "6px 10px",
              fontSize: 10,
              fontFamily: "var(--font-data)",
              letterSpacing: "0.04em",
              color: "var(--fintheon-bg)",
              background: "var(--fintheon-accent)",
              border: "none",
              borderRadius: 3,
              cursor: saveName.trim() ? "pointer" : "not-allowed",
              opacity: saveName.trim() ? 1 : 0.5,
            }}
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
