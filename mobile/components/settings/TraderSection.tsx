// [claude-code 2026-04-19] S26-P1 T6: strip TraderSection to identity only per TP —
//   "the CAO name does not need to be there... risk limits don't need to be there;
//   scrap that completely." Left with Display Name (read-only) + Trader Tag (the
//   toolbar wordmark, read-only). Other toggles (Hermes / Alert Sounds / Bulletin
//   Reminder / Haptics) moved to NotificationsSection.
import { useSettings } from "../../contexts/SettingsContext";

export function TraderSection() {
  const { settings } = useSettings();
  const name = settings.traderName;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <FieldLabel value="DISPLAY NAME">
        <ReadOnlyPlate value={name || "Set on desktop"} hasValue={!!name} />
        <Caption>[READ-ONLY — SET VIA DESKTOP]</Caption>
      </FieldLabel>

      <FieldLabel value="TRADER TAG">
        <TraderTag value={name || "—"} hasValue={!!name} />
        <Caption>[APPEARS NEXT TO THE FINTHEON WORDMARK]</Caption>
      </FieldLabel>
    </div>
  );
}

function FieldLabel({
  value,
  children,
}: {
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          color: "var(--text-secondary)",
          marginBottom: 8,
          letterSpacing: "0.1em",
        }}
      >
        {value}
      </div>
      {children}
    </div>
  );
}

function ReadOnlyPlate({
  value,
  hasValue,
}: {
  value: string;
  hasValue: boolean;
}) {
  return (
    <div
      style={{
        width: "100%",
        padding: "12px 14px",
        background: "color-mix(in srgb, var(--accent) 2%, transparent)",
        border: "1px solid color-mix(in srgb, var(--accent) 12%, transparent)",
        borderRadius: 10,
        color: hasValue ? "var(--text-primary)" : "var(--text-disabled)",
        fontFamily: "var(--font-body)",
        fontSize: 14,
        minHeight: 44,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        opacity: 0.85,
      }}
    >
      {value}
    </div>
  );
}

/** Read-only preview of the trader tag chip that appears in the toolbar
 *  next to the FINTHEON wordmark. Mirrors MobileToolbar styling. */
function TraderTag({ value, hasValue }: { value: string; hasValue: boolean }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: 16,
          color: "var(--accent)",
          letterSpacing: "0.04em",
          textTransform: "uppercase" as const,
        }}
      >
        Fintheon
      </span>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontSize: 10,
          letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          color: hasValue ? "var(--text-secondary)" : "var(--text-disabled)",
          borderLeft: "1px solid var(--border-visible)",
          paddingLeft: 8,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Caption({ children }: { children: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: "var(--font-data)",
        fontSize: 10,
        letterSpacing: "0.08em",
        color: "var(--text-disabled)",
        marginTop: 6,
      }}
    >
      {children}
    </span>
  );
}
