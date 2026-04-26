// [claude-code 2026-04-25] S42-T3: composable message primitive. Mirrors the
//   `<AssistantMessagePrimitive>` / `<MessagePrimitive.Content>` shape from
//   @assistant-ui/react (which requires a runtime context this app does not
//   yet provide) so the bubble structure can be slotted today and swapped to
//   the official runtime when it lands. Slots: Root, Content, Footer,
//   Activity, Actions.

import { forwardRef, type CSSProperties, type ReactNode } from "react";

type Role = "user" | "assistant" | "system";

interface RootProps {
  role: Role;
  cancelled?: boolean;
  /** When `false`, the Root does not apply its default flex-column layout —
   *  the caller is fully in control of layout (used by ConsiliumMessage which
   *  needs a horizontal row with the AgentBadge on the side). */
  layout?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const Root = forwardRef<HTMLDivElement, RootProps>(function MessageRoot(
  { role, cancelled, layout = true, className, style, children },
  ref,
) {
  const layoutClasses = layout
    ? `flex flex-col ${role === "user" ? "items-end" : "items-start"}`
    : "";
  return (
    <div
      ref={ref}
      data-role={role}
      data-cancelled={cancelled ? "true" : undefined}
      className={["group/msg", layoutClasses, className ?? ""]
        .filter(Boolean)
        .join(" ")}
      style={style}
    >
      {children}
    </div>
  );
});

interface ContentProps {
  role: Role;
  cancelled?: boolean;
  className?: string;
  children: ReactNode;
}

const Content = forwardRef<HTMLDivElement, ContentProps>(function MessageContent(
  { role, cancelled, className, children },
  ref,
) {
  const isUser = role === "user";
  return (
    <div
      ref={ref}
      data-content-role={role}
      className={[
        "max-w-[82%] rounded-2xl border p-4 backdrop-blur-md transition-colors",
        isUser
          ? "fintheon-user-bubble"
          : cancelled
            ? "bg-white/[0.03] border-white/5 opacity-50"
            : "bg-[#0f0f0b]/92 border-white/10 shadow-[0_12px_28px_rgba(0,0,0,0.35)]",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
});

function Actions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "mt-1 flex items-center gap-2 px-2 opacity-0 transition-opacity duration-200 group-hover/msg:opacity-100",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Footer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={[
        "mt-1 px-2 text-[10px] font-mono text-[#f0ead6]/40",
        className ?? "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Activity({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={["mt-2 w-full", className ?? ""].join(" ")}>{children}</div>
  );
}

export const MessagePrimitive = { Root, Content, Footer, Activity, Actions };
export const AssistantMessagePrimitive = Root;
