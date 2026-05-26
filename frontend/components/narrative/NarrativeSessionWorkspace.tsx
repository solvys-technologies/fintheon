import { useEffect, useRef, useState, type ReactNode } from "react";
import { Edit3, ImagePlus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import {
  NarrativeCoverHeader,
  buildGeneratedNarrativeCover,
  buildNarrativeCoverPrompt,
  maxNarrativeCoverUploadBytes,
} from "./NarrativeCoverHeader";
import { NarrativeWorkDrawer, type WorkDrawerTab } from "./NarrativeWorkDrawer";
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
  coverImageUrl?: string | null;
  coverImagePrompt?: string | null;
  coverImageUpdatedAt?: string | null;
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
  isResearchRailOpen?: boolean;
  onSelectNode: (id: string) => void;
  onRename: (title: string, color?: string) => void;
  onCoverChange?: (cover: {
    coverImageUrl: string | null;
    coverImagePrompt: string | null;
  }) => void | Promise<void>;
  onQuickAction?: (action: string, catalystId: string | null) => void;
  workDrawerTab?: WorkDrawerTab;
  railCanvas?: ReactNode;
  children: ReactNode;
}

const narrativeSwatches = [
  "#c79f4a",
  "#34D399",
  "#FBBF24",
  "#A78BFA",
  "#14B8A6",
  "#F97316",
];

export function NarrativeSessionWorkspace({
  session,
  response,
  selectedNodeId,
  themeCount = 0,
  isResearchRailOpen = true,
  onSelectNode,
  onRename,
  onCoverChange,
  onQuickAction,
  workDrawerTab,
  railCanvas,
  children,
}: NarrativeSessionWorkspaceProps) {
  const title = session?.title ?? "Narrative workspace";
  const [draftTitle, setDraftTitle] = useState(title);
  const [editControlsOpen, setEditControlsOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [coverError, setCoverError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  useEffect(() => {
    setEditControlsOpen(false);
    setColorPickerOpen(false);
  }, [session?.id]);

  function commitTitle() {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || nextTitle === title) return;
    onRename(nextTitle);
  }

  function commitColor(color: string) {
    setColorPickerOpen(false);
    onRename(draftTitle.trim() || title, color);
  }

  async function applyCover(
    coverImageUrl: string | null,
    coverImagePrompt: string | null,
  ) {
    setCoverError(null);
    try {
      await onCoverChange?.({ coverImageUrl, coverImagePrompt });
    } catch (err) {
      setCoverError(
        err instanceof Error ? err.message : "Cover update failed.",
      );
    }
  }

  function handleCoverUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setCoverError("Choose an image, meme, or GIF.");
      return;
    }
    if (file.size > maxNarrativeCoverUploadBytes) {
      setCoverError("Use an image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => applyCover(String(reader.result ?? ""), file.name);
    reader.onerror = () => setCoverError("Image upload failed.");
    reader.readAsDataURL(file);
  }

  function generateCover() {
    const coverPrompt = buildNarrativeCoverPrompt(session, response);
    const seed = `${session?.id ?? "narrative"}:${Date.now()}`;
    applyCover(
      buildGeneratedNarrativeCover(
        coverPrompt,
        session?.color ?? "#c79f4a",
        seed,
      ),
      coverPrompt,
    );
  }

  const titleWidthClass = railCanvas
    ? "max-w-[calc(100%-24px)]"
    : "max-w-[calc(100%-280px)]";
  const narrativeChrome = (
    <>
      <NarrativeCoverHeader
        session={session}
        response={response}
        onCoverChange={onCoverChange}
      />
      <div
        className={`group absolute left-3 top-3 z-20 flex ${titleWidthClass} cursor-pointer items-center gap-2 rounded-md border px-2 py-1 transition hover:border-[var(--fintheon-accent)]/28 hover:bg-[var(--fintheon-accent)]/6 ${
          editControlsOpen
            ? "border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)]/8"
            : "border-transparent"
        }`}
        role="button"
        tabIndex={0}
        aria-expanded={editControlsOpen}
        aria-controls="narrative-cover-edit-controls"
        onClick={() => setEditControlsOpen(true)}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setEditControlsOpen(true);
          }
        }}
      >
        <button
          type="button"
          className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--fintheon-accent)]/70"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setColorPickerOpen((value) => !value);
          }}
          aria-expanded={colorPickerOpen}
          aria-controls="narrative-color-swatch-menu"
          aria-label="Change narrative color"
          title="Change narrative color"
        >
          <span
            className="h-3 w-3 rounded-full shadow-[0_0_12px_rgba(199,159,74,0.36)]"
            style={{
              backgroundColor: session?.color ?? "rgba(199,159,74,0.44)",
            }}
            aria-hidden="true"
          />
        </button>
        {colorPickerOpen ? (
          <div
            id="narrative-color-swatch-menu"
            className="narrative-fade-item absolute left-2 top-full z-40 mt-1 flex items-center gap-1.5 bg-[var(--fintheon-bg)]/95 px-1.5 py-1 shadow-[0_12px_30px_rgba(0,0,0,0.34)] backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            {narrativeSwatches.map((swatch) => {
              const isSelected =
                swatch.toLowerCase() === (session?.color ?? "").toLowerCase();
              return (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => commitColor(swatch)}
                  className={`h-[18px] w-[18px] rounded-sm transition hover:-translate-y-px ${
                    isSelected
                      ? "ring-1 ring-[var(--fintheon-text)]/70"
                      : "opacity-80 hover:opacity-100"
                  }`}
                  style={{ backgroundColor: swatch }}
                  title={swatch}
                  aria-label={`Set narrative color ${swatch}`}
                />
              );
            })}
          </div>
        ) : null}
        <input
          value={draftTitle}
          onBlur={commitTitle}
          onFocus={() => setEditControlsOpen(true)}
          onChange={(event) => setDraftTitle(event.target.value)}
          className="w-[210px] min-w-[96px] max-w-[32vw] bg-transparent text-xs font-medium text-[var(--fintheon-text)] outline-none"
          aria-label="Narrative title"
        />
        {session?.status ? (
          <span className="shrink-0 pl-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
            {session.status}
          </span>
        ) : null}
        <Edit3
          size={12}
          className="shrink-0 text-[var(--fintheon-accent)]/58 opacity-0 transition group-hover:opacity-100"
          aria-hidden="true"
        />
        {editControlsOpen ? (
          <div
            id="narrative-cover-edit-controls"
            className="narrative-cover-inline-controls flex shrink-0 items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <InlineCoverButton
              title="Change cover"
              onClick={() => coverInputRef.current?.click()}
            >
              <ImagePlus size={13} />
            </InlineCoverButton>
            <InlineCoverButton
              title={
                session?.coverImageUrl ? "Regenerate cover" : "Generate cover"
              }
              onClick={generateCover}
            >
              {session?.coverImageUrl ? (
                <RefreshCw size={13} />
              ) : (
                <Sparkles size={13} />
              )}
            </InlineCoverButton>
            {session?.coverImageUrl ? (
              <InlineCoverButton
                title="Remove cover"
                onClick={() => applyCover(null, null)}
              >
                <Trash2 size={13} />
              </InlineCoverButton>
            ) : null}
            <InlineCoverButton
              title="Close edit controls"
              onClick={() => setEditControlsOpen(false)}
            >
              <X size={13} />
            </InlineCoverButton>
          </div>
        ) : null}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*,.gif"
          className="hidden"
          onChange={(event) => handleCoverUpload(event.target.files?.[0])}
        />
        {coverError ? (
          <span className="shrink-0 pl-1 text-[10px] text-red-300">
            {coverError}
          </span>
        ) : null}
      </div>
    </>
  );
  const canvasSlot = railCanvas ? (
    <div className="relative h-full min-h-0 overflow-hidden">
      {narrativeChrome}
      <div className="h-full min-h-0">{railCanvas}</div>
    </div>
  ) : undefined;

  return (
    <section className="narrative-analysis-panel flex h-full min-h-0 overflow-hidden bg-[var(--fintheon-bg)]">
      <main className="relative min-w-0 flex-1 overflow-hidden">
        {railCanvas ? null : narrativeChrome}
        <div className="h-full min-h-0">{children}</div>
      </main>

      <NarrativeWorkDrawer
        isOpen={isResearchRailOpen}
        session={session}
        response={response}
        selectedNodeId={selectedNodeId}
        themeCount={themeCount}
        onSelectNode={onSelectNode}
        onQuickAction={onQuickAction}
        preferredTab={workDrawerTab}
        canvasSlot={canvasSlot}
      />
    </section>
  );
}

function InlineCoverButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="narrative-cover-inline-button grid h-6 w-6 place-items-center rounded-[4px] text-[var(--fintheon-muted)] transition hover:text-[var(--fintheon-accent)] focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
