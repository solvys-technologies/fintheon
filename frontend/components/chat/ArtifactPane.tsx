import { useCallback, useState } from "react";
import { Columns3, FileCode2, PanelRightClose, ScanEye } from "lucide-react";
import type { Citation } from "./CitationChip";

export interface ArtifactPaneProps {
  artifactType?: "citation" | "browser" | "tradingview" | "report" | "narrative";
  variant?: "pane" | "modal" | "sheet";
  tradingViewConfig?: { symbol: string; timeframe?: string };
  browserSessionId?: string;
  browserStatus?: "starting" | "active" | "closed";
  reportHtml?: string;
  citationSource?: { title: string; url?: string; content?: string };
  narrativeCanvasId?: string;
  isBrowserUserControlling?: boolean;
  onBrowserTakeControl?: () => void;
  onBrowserResumeAgent?: () => void;
  onPinCitation?: (citation: Citation) => void;
  onClose: () => void;
  width?: number;
  onWidthChange?: (width: number) => void;
}

export function ArtifactPane({
  artifactType,
  citationSource,
  reportHtml,
  onClose,
  width = 390,
  onWidthChange,
}: ArtifactPaneProps) {
  const [tab, setTab] = useState<"preview" | "diff" | "artifacts">("preview");
  const tabs = [
    { id: "preview" as const, Icon: ScanEye, label: "Preview" },
    { id: "diff" as const, Icon: FileCode2, label: "Diff" },
    { id: "artifacts" as const, Icon: Columns3, label: "Artifacts" },
  ];
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const startX = event.clientX;
      const startWidth = width;
      const onMove = (moveEvent: PointerEvent) => {
        const next = Math.min(720, Math.max(300, startWidth - (moveEvent.clientX - startX)));
        onWidthChange?.(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [onWidthChange, width],
  );

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-l border-[var(--fintheon-accent)]/15 bg-[#070604]"
      style={{
        width,
      }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize"
        onPointerDown={handlePointerDown}
        title="Resize workbench"
      />
      <div className="flex items-center justify-between border-b border-[var(--fintheon-accent)]/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <Columns3 size={13} className="text-[var(--fintheon-accent)]" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fintheon-accent)]">
            Workbench
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--fintheon-text)]/30 transition-colors hover:text-[var(--fintheon-text)]/70"
          title="Close workbench"
        >
          <PanelRightClose size={14} />
        </button>
      </div>
      <div className="flex border-b border-[var(--fintheon-accent)]/10">
        {tabs.map(({ id, Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] transition-colors ${
              tab === id
                ? "text-[var(--fintheon-accent)]"
                : "text-[var(--fintheon-text)]/35 hover:text-[var(--fintheon-text)]/65"
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "preview" && (
          <div className="space-y-3">
            <div className="rounded-md border border-[var(--fintheon-accent)]/10 bg-[#0a0905] p-3">
              <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-text)]/30">
                Active Preview
              </p>
              <p className="mt-2 text-[12px] leading-5 text-[var(--fintheon-text)]/65">
                {artifactType
                  ? `Rendering ${artifactType} artifact.`
                  : "No live preview yet. Generated UI, browser screenshots, reports, and file previews will land here instead of being dumped into the chat thread."}
              </p>
            </div>
            {citationSource && (
              <div className="rounded-md border border-[var(--fintheon-accent)]/10 bg-[#0a0905] p-3">
                <p className="text-[12px] font-semibold text-[var(--fintheon-text)]/80">
                  {citationSource.title}
                </p>
                {citationSource.url && (
                  <a
                    href={citationSource.url}
                    className="mt-1 block truncate text-[10px] text-[var(--fintheon-accent)]/70"
                  >
                    {citationSource.url}
                  </a>
                )}
                {citationSource.content && (
                  <p className="mt-2 text-[11px] leading-5 text-[var(--fintheon-text)]/55">
                    {citationSource.content}
                  </p>
                )}
              </div>
            )}
            {reportHtml && (
              <div
                className="rounded-md border border-[var(--fintheon-accent)]/10 bg-[#0a0905] p-3 text-[12px] text-[var(--fintheon-text)]/70"
                dangerouslySetInnerHTML={{ __html: reportHtml }}
              />
            )}
          </div>
        )}
        {tab === "diff" && (
          <div className="rounded-md border border-[var(--fintheon-accent)]/10 bg-[#0a0905] p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-text)]/30">
              Diff
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--fintheon-text)]/55">
              File diffs and proposed patches should render here as inspectable
              artifacts before approval.
            </p>
          </div>
        )}
        {tab === "artifacts" && (
          <div className="rounded-md border border-[var(--fintheon-accent)]/10 bg-[#0a0905] p-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-text)]/30">
              Artifacts
            </p>
            <p className="mt-2 text-[12px] leading-5 text-[var(--fintheon-text)]/55">
              Reports, citations, generated files, and tool outputs belong in
              this drawer, not as raw implementation text in the chat canvas.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
