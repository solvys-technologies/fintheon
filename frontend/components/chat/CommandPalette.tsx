// [claude-code 2026-04-25] S42-T2: cmdk command palette — Cmd+K from any chat surface.
// Groups: Agents (slash personas), Surfaces (Sanctum/Arbitrum/Strategium jumps), Recent
// (last 10 user messages). Solvys-flat surfaces, no glass, no gradients.
import { useEffect, useMemo, useRef } from "react";
import { Command } from "cmdk";
import {
  ArrowRight,
  Eye,
  Newspaper,
  ScrollText,
  Sparkles,
  Layers,
} from "lucide-react";

interface RecentMessage {
  id: string;
  text: string;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  recent: RecentMessage[];
  onPickPersona: (personaId: "oracle" | "feucht" | "consul" | "herald") => void;
  onPickSurface: (surfaceId: "sanctum" | "arbitrum" | "strategium") => void;
  onPickRecent: (text: string) => void;
}

const AGENT_ITEMS: Array<{
  id: "oracle" | "feucht" | "consul" | "herald";
  label: string;
  hint: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "oracle",
    label: "Oracle",
    hint: "/oracle — prediction markets, macro reads",
    icon: Sparkles,
  },
  {
    id: "feucht",
    label: "Feucht",
    hint: "/feucht — futures, IV, risk",
    icon: Eye,
  },
  {
    id: "consul",
    label: "Consul",
    hint: "/consul — mega-cap fundamentals",
    icon: ScrollText,
  },
  {
    id: "herald",
    label: "Herald",
    hint: "/herald — news + sentiment",
    icon: Newspaper,
  },
];

const SURFACE_ITEMS: Array<{
  id: "sanctum" | "arbitrum" | "strategium";
  label: string;
  hint: string;
  icon: typeof Layers;
}> = [
  {
    id: "sanctum",
    label: "Sanctum",
    hint: "Open the narrative timeline",
    icon: Layers,
  },
  {
    id: "arbitrum",
    label: "Arbitrum",
    hint: "Latest 5-seat verdict",
    icon: ScrollText,
  },
  {
    id: "strategium",
    label: "Strategium",
    hint: "Mission control + RiskFlow feed",
    icon: ArrowRight,
  },
];

export function CommandPalette({
  open,
  onClose,
  recent,
  onPickPersona,
  onPickSurface,
  onPickRecent,
}: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  if (!open) return null;

  return (
    <div
      data-open="true"
      className="fixed inset-0 z-[10000] flex items-start justify-center pt-[18vh] t-modal"
      onClick={onClose}
      style={{
        background: "rgba(5, 4, 2, 0.72)",
      }}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-[var(--fintheon-accent)]/30 bg-[#050402]"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: "60vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Command label="Fintheon" loop>
          <div className="border-b border-[var(--fintheon-accent)]/15">
            <Command.Input
              ref={inputRef}
              placeholder="Search agents, surfaces, or recent messages..."
              className="w-full bg-transparent px-4 py-3 text-[13px] text-[#f0ead6] placeholder:text-zinc-600 focus:outline-none"
            />
          </div>

          <Command.List
            className="overflow-y-auto p-2"
            style={{ maxHeight: "calc(60vh - 56px)" }}
          >
            <Command.Empty className="px-3 py-6 text-center text-[12px] text-zinc-500">
              No matches.
            </Command.Empty>

            <Command.Group
              heading="Agents"
              className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-[var(--fintheon-accent)]/60"
            >
              {AGENT_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.id}
                    value={`agent ${item.id} ${item.label} ${item.hint}`}
                    onSelect={() => {
                      onPickPersona(item.id);
                      onClose();
                    }}
                    className="flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] text-[#f0ead6]/80 cursor-pointer aria-selected:bg-[var(--fintheon-accent)]/10 aria-selected:text-[#f0ead6]"
                  >
                    <Icon
                      size={14}
                      className="shrink-0 text-[var(--fintheon-accent)]/70"
                    />
                    <span className="font-medium">{item.label}</span>
                    <span className="text-[11px] text-zinc-500 truncate">
                      {item.hint}
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            <Command.Group
              heading="Surfaces"
              className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-[var(--fintheon-accent)]/60"
            >
              {SURFACE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Command.Item
                    key={item.id}
                    value={`surface ${item.id} ${item.label} ${item.hint}`}
                    onSelect={() => {
                      onPickSurface(item.id);
                      onClose();
                    }}
                    className="flex items-center gap-3 rounded-md px-2.5 py-2 text-[13px] text-[#f0ead6]/80 cursor-pointer aria-selected:bg-[var(--fintheon-accent)]/10 aria-selected:text-[#f0ead6]"
                  >
                    <Icon
                      size={14}
                      className="shrink-0 text-[var(--fintheon-accent)]/70"
                    />
                    <span className="font-medium">{item.label}</span>
                    <span className="text-[11px] text-zinc-500 truncate">
                      {item.hint}
                    </span>
                  </Command.Item>
                );
              })}
            </Command.Group>

            {recent.length > 0 && (
              <Command.Group
                heading="Recent"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-[var(--fintheon-accent)]/60"
              >
                {recent.map((msg) => (
                  <Command.Item
                    key={msg.id}
                    value={`recent ${msg.text}`}
                    onSelect={() => {
                      onPickRecent(msg.text);
                      onClose();
                    }}
                    className="flex items-center gap-3 rounded-md px-2.5 py-2 text-[12px] text-[#f0ead6]/70 cursor-pointer aria-selected:bg-[var(--fintheon-accent)]/10 aria-selected:text-[#f0ead6]"
                  >
                    <ArrowRight
                      size={12}
                      className="shrink-0 text-[var(--fintheon-accent)]/50"
                    />
                    <span className="truncate">{msg.text}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>

          <div className="border-t border-[var(--fintheon-accent)]/10 px-3 py-2 text-[10px] text-zinc-600 flex items-center justify-between">
            <span className="tracking-[0.18em] uppercase">Fintheon</span>
            <span>
              <kbd className="rounded border border-[var(--fintheon-accent)]/20 px-1.5 py-0.5 mr-1.5 text-[9px] tracking-wider">
                ESC
              </kbd>
              to close
            </span>
          </div>
        </Command>
      </div>
    </div>
  );
}

export function pickRecentUserMessages(
  messages: Array<{ id?: string; role: string; content?: any; parts?: any }>,
  count = 10,
): RecentMessage[] {
  const out: RecentMessage[] = [];
  for (let i = messages.length - 1; i >= 0 && out.length < count; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const parts = (m.content ?? m.parts) as any;
    let text = "";
    if (Array.isArray(parts)) {
      text = parts
        .filter((p: any) => p?.type === "text" && typeof p.text === "string")
        .map((p: any) => p.text)
        .join(" ");
    } else if (typeof parts === "string") {
      text = parts;
    }
    text = text.trim();
    if (!text) continue;
    out.push({
      id: m.id ?? `recent-${i}`,
      text: text.length > 120 ? `${text.slice(0, 117)}…` : text,
    });
  }
  return out;
}

export function useRecentUserMessages(messages: any[], count = 10) {
  return useMemo(() => pickRecentUserMessages(messages, count), [messages, count]);
}
