import { useEffect, useState, type ReactNode } from "react";
import { MessageSquareText } from "lucide-react";
import { NarrativeWorkDrawer } from "./NarrativeWorkDrawer";
import type { SensemakingResponse } from "./sensemaking-types";

export interface NarrativeWorkspaceLink {
  label: string;
  href: string;
  source?: string;
}

export interface NarrativeAgentWorkEvent {
  id: string;
  agent: string;
  summary: string;
  status?: string;
  timestamp?: string;
}

export interface NarrativeTranscriptEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp?: string;
}

export interface NarrativeWorkspaceSession {
  id?: string;
  title?: string;
  status?: string;
  color?: string;
  generatedAt?: string;
  catalystIds?: string[];
  report?: string;
  synthesis?: string;
  webLinks?: NarrativeWorkspaceLink[];
  workEvents?: NarrativeAgentWorkEvent[];
  transcript?: NarrativeTranscriptEntry[];
}

interface NarrativeSessionWorkspaceProps {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  onRename: (title: string) => void;
  children: ReactNode;
}

export function NarrativeSessionWorkspace({
  session,
  response,
  selectedNodeId,
  onSelectNode,
  onRename,
  children,
}: NarrativeSessionWorkspaceProps) {
  const title = session?.title ?? "Narrative workspace";
  const [draftTitle, setDraftTitle] = useState(title);
  const transcript = session?.transcript ?? [];

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  function commitTitle() {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === title) return;
    onRename(nextTitle);
  }

  return (
    <section className="flex h-full min-h-0 overflow-hidden bg-[var(--fintheon-bg)]">
      <main className="relative min-w-0 flex-1 overflow-hidden">
        <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-280px)] items-center gap-2 rounded-md border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-bg)]/90 px-2 py-1">
          <span
            className="h-2 w-2 shrink-0 rounded-full border border-[var(--fintheon-accent)]/45"
            style={{ backgroundColor: session?.color ?? "rgba(199,159,74,0.44)" }}
          />
          <input
            value={draftTitle}
            onBlur={commitTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            className="min-w-0 bg-transparent text-xs font-medium text-[var(--fintheon-text)] outline-none"
            aria-label="Narrative title"
          />
          {session?.status ? (
            <span className="shrink-0 border-l border-[var(--fintheon-accent)]/12 pl-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
              {session.status}
            </span>
          ) : null}
        </div>

        <div className="h-full min-h-0">{children}</div>

        {transcript.length > 0 ? (
          <aside className="pointer-events-auto absolute bottom-3 right-3 top-14 z-20 flex w-[248px] flex-col overflow-hidden rounded-md border border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-bg)]/92">
            <div className="flex h-9 items-center gap-2 border-b border-[var(--fintheon-accent)]/10 px-3 text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-accent)]/70">
              <MessageSquareText size={13} />
              Transcript
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {transcript.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-md border border-[var(--fintheon-accent)]/10 p-2"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-[var(--fintheon-muted)]">
                    <span className="uppercase tracking-[0.12em]">{entry.speaker}</span>
                    <span>{entry.timestamp ? formatShortTime(entry.timestamp) : ""}</span>
                  </div>
                  <p className="line-clamp-3 text-[11px] leading-4 text-[var(--fintheon-text)]/85">
                    {entry.text}
                  </p>
                </article>
              ))}
            </div>
          </aside>
        ) : null}
      </main>

      <NarrativeWorkDrawer
        session={session}
        response={response}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
      />
    </section>
  );
}

function formatShortTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
