import { useEffect, useState, type ReactNode } from "react";
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
  themeCount?: number;
  onSelectNode: (id: string) => void;
  onRename: (title: string) => void;
  onQuickAction?: (action: string, catalystId: string | null) => void;
  children: ReactNode;
}

export function NarrativeSessionWorkspace({
  session,
  response,
  selectedNodeId,
  themeCount = 0,
  onSelectNode,
  onRename,
  onQuickAction,
  children,
}: NarrativeSessionWorkspaceProps) {
  const title = session?.title ?? "Narrative workspace";
  const [draftTitle, setDraftTitle] = useState(title);

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
        <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-280px)] items-center gap-2 px-2 py-1">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
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
            <span className="shrink-0 pl-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
              {session.status}
            </span>
          ) : null}
        </div>

        <div className="h-full min-h-0">{children}</div>

      </main>

      <NarrativeWorkDrawer
        session={session}
        response={response}
        selectedNodeId={selectedNodeId}
        themeCount={themeCount}
        onSelectNode={onSelectNode}
        onQuickAction={onQuickAction}
      />
    </section>
  );
}
