// [codex 2026-05-23] Local Craftwork-style isometric citation icons. Paid
// Craftwork exports were not vendored; these keep the required symbol set local.
import type { CSSProperties } from "react";
import { EXACT_ICON_BODIES, type ExactIconKey } from "./iconifyBodies";

export type ChatCitationKind =
  | "skill"
  | "internal-tool"
  | "external-tool"
  | "approval"
  | "file"
  | "mcp"
  | "browser"
  | "shell"
  | "market"
  | "web";

interface ChatCitationIconProps {
  kind?: ChatCitationKind;
  size?: number;
  className?: string;
  title?: string;
  style?: CSSProperties;
}

const KIND_META: Record<
  ChatCitationKind,
  { label: string; accent: string; iconKey: ExactIconKey }
> = {
  skill: {
    label: "@ mention",
    accent: "#c79f4a",
    iconKey: "at-preview",
  },
  "internal-tool": {
    label: "Internal tool",
    accent: "#60a5fa",
    iconKey: "terminal-preview",
  },
  "external-tool": {
    label: "External tool",
    accent: "#34d399",
    iconKey: "internet-preview",
  },
  approval: {
    label: "Approval",
    accent: "#f59e0b",
    iconKey: "check-circled-preview",
  },
  file: {
    label: "File",
    accent: "#a78bfa",
    iconKey: "database-script",
  },
  mcp: {
    label: "MCP",
    accent: "#f0ead6",
    iconKey: "database-script",
  },
  browser: {
    label: "Browser",
    accent: "#38bdf8",
    iconKey: "internet-preview",
  },
  shell: {
    label: "Shell",
    accent: "#34d399",
    iconKey: "terminal-preview",
  },
  market: {
    label: "Market",
    accent: "#ef4444",
    iconKey: "graph-up-preview",
  },
  web: {
    label: "Web",
    accent: "#22d3ee",
    iconKey: "internet-preview",
  },
};

export function ChatCitationIcon({
  kind = "internal-tool",
  size = 30,
  className,
  title,
  style,
}: ChatCitationIconProps) {
  const meta = KIND_META[kind];
  const glyph = EXACT_ICON_BODIES[meta.iconKey];
  return (
    <span
      className={`chat-citation-icon${className ? ` ${className}` : ""}`}
      style={
        {
          "--citation-accent": meta.accent,
          width: size,
          height: size,
          ...style,
        } as CSSProperties
      }
      title={title ?? meta.label}
      aria-label={title ?? meta.label}
      role="img"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path
          className="chat-citation-icon__side"
          d="M8 17 24 8l16 9v15L24 41 8 32Z"
        />
        <path
          className="chat-citation-icon__top"
          d="M8 17 24 8l16 9-16 9Z"
        />
        <path
          className="chat-citation-icon__front"
          d="M8 17 24 26v15L8 32Z"
        />
        <path
          className="chat-citation-icon__right"
          d="M40 17 24 26v15l16-9Z"
        />
        <path className="chat-citation-icon__edge" d="M8 17 24 26l16-9" />
        <path className="chat-citation-icon__edge" d="M24 26v15" />
        <rect
          className="chat-citation-icon__plate"
          x="14"
          y="16"
          width="20"
          height="13"
          rx="3"
        />
        <svg
          x="16"
          y="16.5"
          width="16"
          height="12"
          viewBox={`0 0 ${glyph.width} ${glyph.height}`}
          className="chat-citation-icon__glyph"
          dangerouslySetInnerHTML={{ __html: glyph.body }}
        />
        <path className="chat-citation-icon__shimmer" d="M11 15 25 8" />
      </svg>
    </span>
  );
}

export function citationKindForTool(toolName: string): ChatCitationKind {
  const name = toolName.toLowerCase();
  if (name.includes("skill") || name.includes("mention")) return "skill";
  if (name.includes("web") || name.includes("fetch") || name.includes("url"))
    return "web";
  if (name.includes("browser")) return "browser";
  if (name.includes("bash") || name.includes("shell") || name.includes("command"))
    return "shell";
  if (name.includes("file") || name.includes("read") || name.includes("write"))
    return "file";
  if (name.includes("mcp") || name.includes("connector")) return "mcp";
  if (name.includes("market") || name.includes("scanner")) return "market";
  return name.includes("external") ? "external-tool" : "internal-tool";
}
