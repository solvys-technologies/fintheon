// [claude-code 2026-04-25] S42-T3 mobile: composable message primitive shim
//   mirroring @assistant-ui/react MessagePrimitive (Root/Content/Footer/
//   Activity/Actions). Mobile uses inline styles to match the existing
//   mobile token system; the slots take care of layout without forcing
//   tailwind.

import { forwardRef, type CSSProperties, type ReactNode } from "react";

type Role = "user" | "assistant" | "system";

interface RootProps {
  role: Role;
  cancelled?: boolean;
  layout?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

const Root = forwardRef<HTMLDivElement, RootProps>(function MessageRoot(
  { role, cancelled, layout = true, style, children },
  ref,
) {
  const baseStyle: CSSProperties = layout
    ? {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        padding: "4px 16px",
        ...(role === "user" ? { flexDirection: "row-reverse" } : {}),
      }
    : {};
  return (
    <div
      ref={ref}
      data-role={role}
      data-cancelled={cancelled ? "true" : undefined}
      style={{ ...baseStyle, ...style }}
    >
      {children}
    </div>
  );
});

interface ContentProps {
  role: Role;
  cancelled?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

function Content({ role, cancelled, style, children }: ContentProps) {
  const isUser = role === "user";
  return (
    <div
      data-content-role={role}
      style={{
        background: isUser ? "var(--surface-raised)" : "var(--surface)",
        border: isUser ? "none" : "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 16px",
        opacity: cancelled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Footer({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        marginTop: 4,
        fontFamily: "var(--font-data)",
        fontSize: 9,
        color: "var(--text-disabled)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Activity({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div style={{ width: "100%", marginTop: 6, ...style }}>{children}</div>
  );
}

function Actions({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        marginTop: 4,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export const MessagePrimitive = { Root, Content, Footer, Activity, Actions };
export const AssistantMessagePrimitive = Root;
