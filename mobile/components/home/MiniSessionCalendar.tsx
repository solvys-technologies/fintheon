// [claude-code 2026-04-15] T4: Native economic calendar — no TradingView embed
import { SurfaceCard } from "../shared/SurfaceCard";
import { useEconCalendar } from "../../hooks/useEconCalendar";

const MAX_EVENTS = 8;

export function MiniSessionCalendar() {
  const { events, isLoading } = useEconCalendar();

  if (isLoading) {
    return (
      <SurfaceCard>
        <Label>[LOADING CALENDAR...]</Label>
      </SurfaceCard>
    );
  }

  if (events.length === 0) {
    return (
      <SurfaceCard>
        <Label>ECONOMIC CALENDAR</Label>
        <div
          style={{
            fontFamily: "var(--font-data)",
            fontSize: 12,
            color: "var(--text-disabled)",
            marginTop: 12,
            letterSpacing: "0.06em",
          }}
        >
          [NO EVENTS TODAY]
        </div>
      </SurfaceCard>
    );
  }

  const visible = events.slice(0, MAX_EVENTS);
  const remaining = events.length - MAX_EVENTS;

  return (
    <SurfaceCard noPadding>
      <div style={{ padding: "16px 16px 8px" }}>
        <Label>ECONOMIC CALENDAR</Label>
      </div>

      {visible.map((ev, i) => {
        const isHigh = ev.importance === 3;

        return (
          <div key={ev.id ?? i}>
            {i > 0 && (
              <div
                style={{
                  height: 1,
                  background: "var(--border)",
                  marginLeft: 16,
                  marginRight: 16,
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                height: 44,
                padding: "0 16px",
                gap: 8,
              }}
            >
              {/* Time */}
              <span
                style={{
                  fontFamily: "var(--font-data)",
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  width: 60,
                  flexShrink: 0,
                }}
              >
                {ev.time ?? "—"}
              </span>

              {/* Event name */}
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  fontWeight: isHigh ? 500 : 400,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ev.name}
              </span>

              {/* Importance dots */}
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                {[1, 2, 3].map((level) => (
                  <div
                    key={level}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor:
                        level <= ev.importance
                          ? isHigh
                            ? "var(--accent)"
                            : "var(--text-secondary)"
                          : "var(--border)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {remaining > 0 && (
        <div
          style={{
            padding: "8px 16px 16px",
            fontFamily: "var(--font-data)",
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          [+{remaining} MORE TODAY]
        </div>
      )}

      {remaining <= 0 && <div style={{ height: 8 }} />}
    </SurfaceCard>
  );
}

function Label({ children }: { children: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--text-secondary)",
      }}
    >
      {children}
    </span>
  );
}
