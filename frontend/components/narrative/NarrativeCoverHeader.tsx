import { useMemo, useRef, useState, type ReactNode } from "react";
import { ImagePlus, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import type { NarrativeWorkspaceSession } from "./NarrativeSessionWorkspace";
import type { SensemakingResponse } from "./sensemaking-types";

interface NarrativeCoverHeaderProps {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  onCoverChange?: (cover: {
    coverImageUrl: string | null;
    coverImagePrompt: string | null;
  }) => void | Promise<void>;
  editControlsOpen?: boolean;
  onEditControlsOpenChange?: (open: boolean) => void;
}

export const maxNarrativeCoverUploadBytes = 8 * 1024 * 1024;

export function NarrativeCoverHeader({
  session,
  response,
  onCoverChange,
  editControlsOpen = false,
  onEditControlsOpenChange,
}: NarrativeCoverHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const coverUrl = session?.coverImageUrl ?? null;
  const coverPrompt = useMemo(() => buildNarrativeCoverPrompt(session, response), [session, response]);

  async function applyCover(coverImageUrl: string | null, coverImagePrompt: string | null) {
    setError(null);
    try {
      await onCoverChange?.({ coverImageUrl, coverImagePrompt });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cover update failed.");
    }
  }

  function handleUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image, meme, or GIF.");
      return;
    }
    if (file.size > maxNarrativeCoverUploadBytes) {
      setError("Use an image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => applyCover(String(reader.result ?? ""), file.name);
    reader.onerror = () => setError("Image upload failed.");
    reader.readAsDataURL(file);
  }

  function generateCover() {
    const seed = `${session?.id ?? "narrative"}:${Date.now()}`;
    applyCover(buildGeneratedNarrativeCover(coverPrompt, session?.color ?? "#c79f4a", seed), coverPrompt);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-48 overflow-hidden">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          className="h-full w-full object-cover opacity-90"
          draggable={false}
        />
      ) : (
        <div
          className="h-full w-full opacity-95"
          style={{
            background: `radial-gradient(circle at 18% 20%, ${hexToRgba(session?.color, 0.28)}, transparent 30%), linear-gradient(135deg, rgba(199,159,74,0.22), rgba(13,18,22,0.82) 48%, rgba(3,7,10,0.96))`,
          }}
        />
      )}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.04) 42%, var(--fintheon-bg) 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-24"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0) 0%, var(--fintheon-bg) 78%)",
        }}
      />
      {editControlsOpen ? (
        <div
          id="narrative-cover-edit-controls"
          className="pointer-events-auto absolute left-3 top-12 flex max-w-[min(560px,calc(100%-24px))] flex-wrap items-center gap-1.5 rounded-md border border-[var(--fintheon-accent)]/18 bg-[var(--fintheon-bg)]/92 p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.36)]"
        >
          <span className="px-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/72">
            Edit narrative
          </span>
          <CoverButton title="Change cover" onClick={() => inputRef.current?.click()}>
            <ImagePlus size={14} />
            <span>Change Cover</span>
          </CoverButton>
          <CoverButton
            title={coverUrl ? "Regenerate cover" : "Generate cover"}
            onClick={generateCover}
          >
            {coverUrl ? <RefreshCw size={14} /> : <Sparkles size={14} />}
            <span>{coverUrl ? "Regenerate" : "Generate"}</span>
          </CoverButton>
          {coverUrl ? (
            <CoverButton title="Remove cover" onClick={() => applyCover(null, null)}>
              <Trash2 size={14} />
              <span>Remove</span>
            </CoverButton>
          ) : null}
          <button
            type="button"
            title="Close edit controls"
            aria-label="Close edit controls"
            onClick={() => onEditControlsOpenChange?.(false)}
            className="ml-0 grid h-7 w-7 place-items-center rounded-[4px] text-[var(--fintheon-muted)] transition hover:bg-[var(--fintheon-accent)]/8 hover:text-[var(--fintheon-accent)] sm:ml-1"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}
      <div className="hidden">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.gif"
          className="hidden"
          onChange={(event) => handleUpload(event.target.files?.[0])}
        />
      </div>
      {error ? (
        <div className="pointer-events-none absolute right-3 top-12 rounded bg-[var(--fintheon-overlay-surface,var(--fintheon-bg))] px-2 py-1 text-[10px] text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function CoverButton({
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
      className="inline-flex h-7 items-center gap-1.5 rounded-[4px] border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)]/75 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:border-[var(--fintheon-accent)]/35 hover:bg-[var(--fintheon-accent)]/10"
    >
      {children}
    </button>
  );
}

export function buildNarrativeCoverPrompt(
  session: NarrativeWorkspaceSession | null,
  response: SensemakingResponse | null,
): string {
  const title = session?.title ?? "Narrative session";
  const summary = response?.synthesisSummary || session?.synthesis || session?.report || "";
  const catalysts = response?.anchorCatalysts
    ?.slice(0, 3)
    .map((item) => item.headline)
    .join(" / ");
  return [title, summary, catalysts].filter(Boolean).join(" | ").slice(0, 900);
}

export function buildGeneratedNarrativeCover(prompt: string, color: string, seed: string): string {
  const hash = Array.from(seed + prompt).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const accent = hexToRgba(color, 0.72);
  const title = escapeXml(prompt.split("|")[0]?.trim() || "Narrative");
  const hue = hash % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 420"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 58% 22%)"/><stop offset=".48" stop-color="#10161a"/><stop offset="1" stop-color="#030608"/></linearGradient><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".78" numOctaves="4" stitchTiles="stitch"/></filter></defs><rect width="1400" height="420" fill="url(#g)"/><rect width="1400" height="420" opacity=".16" filter="url(#n)"/><circle cx="${180 + (hash % 220)}" cy="${105 + (hash % 90)}" r="170" fill="${accent}"/><circle cx="${980 + (hash % 240)}" cy="${120 + (hash % 120)}" r="210" fill="rgba(255,255,255,.08)"/><path d="M0 310 C280 230 470 390 760 300 S1110 230 1400 315 V420 H0Z" fill="rgba(0,0,0,.34)"/><text x="64" y="112" fill="rgba(255,255,255,.88)" font-family="Inter, system-ui, sans-serif" font-size="40" font-weight="650">${title}</text><text x="66" y="158" fill="rgba(199,159,74,.82)" font-family="Inter, system-ui, sans-serif" font-size="18" letter-spacing="4">CAO GENERATED NARRATIVE COVER</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function hexToRgba(value: string | undefined, alpha: number): string {
  const hex = value?.replace("#", "");
  if (!hex || hex.length !== 6) return `rgba(199,159,74,${alpha})`;
  const parsed = Number.parseInt(hex, 16);
  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
