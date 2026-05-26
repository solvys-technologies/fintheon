import { ImagePlus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from "react";
import type { DeskMapDesk } from "../../lib/desk-map-api";
import type { CanvasTool } from "./NarrativeFloatingToolbar";
import type { NarrativeSessionSummary } from "./NarrativeSessionHistory";
import {
  buildDeskMapLinks,
  buildGeneratedImage,
  buildImagePrompt,
  clamp,
  deskMapPositions,
  formatDeskMapAge,
  hexToRgba,
  loadCoverFocus,
  saveCoverFocus,
  type CoverFocus,
  type DeskMapPoint,
} from "./narrative-desk-map-utils";

interface NarrativeDeskMapCanvasProps {
  sessions: NarrativeSessionSummary[];
  activeSessionId: string | null;
  desk: DeskMapDesk | null;
  canvasTool: CanvasTool;
  scale: number;
  heatmapActive: boolean;
  filterLabel: string | null;
  resetKey: number;
  error: string | null;
  onScaleChange: (scale: number) => void;
  onOpenSession?: (id: string) => void;
  onImageChange: (input: {
    mapImageUrl: string | null;
    mapImagePrompt: string | null;
  }) => void | Promise<void>;
}

const uploadLimit = 8 * 1024 * 1024;
type CanvasPresence = "enter" | "present" | "exit";
type AnimatedSession = {
  index: number;
  presence: CanvasPresence;
  revision: string;
  session: NarrativeSessionSummary;
};

export function NarrativeDeskMapCanvas({
  sessions,
  activeSessionId,
  desk,
  canvasTool,
  scale,
  heatmapActive,
  filterLabel,
  resetKey,
  error,
  onScaleChange,
  onOpenSession,
  onImageChange,
}: NarrativeDeskMapCanvasProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [controlsOpen, setControlsOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [coverFocus, setCoverFocus] = useState(() => loadCoverFocus(desk?.id));
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
  } | null>(null);
  const coverDragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    focus: CoverFocus;
  } | null>(null);
  const canPan = canvasTool === "hand" || canvasTool === "select";
  const links = useMemo(() => buildDeskMapLinks(sessions), [sessions]);
  const animatedSessions = useAnimatedSessions(sessions);
  const catalystTotal = sessions.reduce(
    (total, session) => total + session.catalystCount,
    0,
  );

  useEffect(() => setOffset({ x: 0, y: 0 }), [resetKey]);
  useEffect(() => setCoverFocus(loadCoverFocus(desk?.id)), [desk?.id]);
  useEffect(() => saveCoverFocus(desk?.id, coverFocus), [coverFocus, desk?.id]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!canPan) return;
    if ((event.target as Element | null)?.closest("button,input")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      ox: offset.x,
      oy: offset.y,
    };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    setOffset({
      x: drag.ox + event.clientX - drag.startX,
      y: drag.oy + event.clientY - drag.startY,
    });
  }

  function handleCoverPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = coverDragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    setCoverFocus({
      x: clamp(drag.focus.x + (event.clientX - drag.startX) / 6, 0, 100),
      y: clamp(drag.focus.y + (event.clientY - drag.startY) / 3, 0, 100),
    });
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    onScaleChange(clamp(scale * (event.deltaY > 0 ? 0.9 : 1.1), 0.35, 2));
  }

  async function apply(input: {
    mapImageUrl: string | null;
    mapImagePrompt: string | null;
  }) {
    setLocalError(null);
    try {
      await onImageChange(input);
      setControlsOpen(true);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "DeskMap image failed.",
      );
    }
  }

  function handleUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Choose an image, meme, or GIF.");
      return;
    }
    if (file.size > uploadLimit) {
      setLocalError("Use an image under 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      apply({
        mapImageUrl: String(reader.result ?? ""),
        mapImagePrompt: file.name,
      });
    reader.onerror = () => setLocalError("Image upload failed.");
    reader.readAsDataURL(file);
  }

  return (
    <div
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => {
        if (dragRef.current?.id === event.pointerId) dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
      onWheel={handleWheel}
      className={`narrative-deskmap-canvas narrative-old-map relative h-full overflow-hidden ${canPan ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
    >
      <DeskCover
        desk={desk}
        focus={coverFocus}
        controlsOpen={controlsOpen}
        error={localError ?? error}
        inputRef={inputRef}
        onOpenControls={() => setControlsOpen(true)}
        onUpload={handleUpload}
        onGenerate={() =>
          apply({
            mapImageUrl: buildGeneratedImage(desk, sessions),
            mapImagePrompt: buildImagePrompt(desk, sessions),
          })
        }
        onRemove={() => apply({ mapImageUrl: null, mapImagePrompt: null })}
        onDragStart={(event) => {
          if (!desk?.mapImageUrl) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          coverDragRef.current = {
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            focus: coverFocus,
          };
        }}
        onDragMove={handleCoverPointerMove}
        onDragEnd={() => {
          coverDragRef.current = null;
        }}
      />

      <div
        className="narrative-deskmap-stage absolute inset-0 z-10 origin-center"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
        }}
      >
        {sessions.length === 0 && animatedSessions.length === 0 ? (
          <EmptyDeskMap desk={desk} />
        ) : null}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
          preserveAspectRatio="none"
        >
          {links.map((link) => (
            <line
              key={link.id}
              x1={`${link.from.x}%`}
              y1={`${link.from.y}%`}
              x2={`${link.to.x}%`}
              y2={`${link.to.y}%`}
              stroke={link.color}
              strokeDasharray="4 8"
              strokeWidth="1.2"
            />
          ))}
        </svg>
        {animatedSessions.map(({ session, index, presence }) => (
          <NarrativeBubble
            key={session.id}
            session={session}
            position={deskMapPositions[index % deskMapPositions.length]}
            active={session.id === activeSessionId}
            selected={selectedIds.has(session.id)}
            heatmapActive={heatmapActive}
            presence={presence}
            onSelect={(event) => {
              if (
                canvasTool === "multi-select" ||
                event.shiftKey ||
                event.metaKey
              ) {
                setSelectedIds((current) => toggleSet(current, session.id));
                return;
              }
              onOpenSession?.(session.id);
            }}
          />
        ))}
      </div>
      <div className="absolute left-3 top-[68px] z-30 pointer-events-none">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--fintheon-accent)]/70">
          DeskMap
        </p>
        <p className="mt-1 text-xs text-[var(--fintheon-muted)]/70">
          {desk?.name ?? "Priced In Capital"}
        </p>
      </div>
      {filterLabel ? (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded-[4px] bg-[color-mix(in_srgb,var(--fintheon-surface)_72%,transparent)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/72 backdrop-blur">
          {filterLabel}
        </div>
      ) : null}
      <div className="absolute bottom-3 left-3 z-30 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/55">
        <span className="text-[var(--fintheon-accent)]">{sessions.length}</span>
        <span className="ml-1">active narratives</span>
        <span className="mx-2 text-[var(--fintheon-accent)]/35">/</span>
        <span className="text-[var(--fintheon-accent)]">{catalystTotal}</span>
        <span className="ml-1">catalysts tracked</span>
      </div>
    </div>
  );
}

function useAnimatedSessions(
  sessions: NarrativeSessionSummary[],
): AnimatedSession[] {
  const [animated, setAnimated] = useState<AnimatedSession[]>(() =>
    sessions.map((session, index) => ({
      index,
      presence: "present",
      revision: sessionRevision(session),
      session,
    })),
  );

  useEffect(() => {
    setAnimated((current) => {
      const currentById = new Map(
        current.map((item) => [item.session.id, item]),
      );
      const nextIds = new Set(sessions.map((session) => session.id));
      const next: AnimatedSession[] = sessions.map((session, index) => {
        const revision = sessionRevision(session);
        const existing = currentById.get(session.id);
        const presence: CanvasPresence =
          !existing || existing.revision !== revision ? "enter" : "present";
        return {
          index,
          presence,
          revision,
          session,
        };
      });
      current.forEach((item) => {
        if (!nextIds.has(item.session.id) && item.presence !== "exit") {
          next.push({ ...item, presence: "exit" });
        }
      });
      return next;
    });

    const timer = window.setTimeout(() => {
      setAnimated((current) =>
        current
          .filter((item) => item.presence !== "exit")
          .map((item) =>
            item.presence === "enter" ? { ...item, presence: "present" } : item,
          ),
      );
    }, 360);

    return () => window.clearTimeout(timer);
  }, [sessions]);

  return animated;
}

function sessionRevision(session: NarrativeSessionSummary): string {
  return [
    session.title,
    session.status,
    session.color,
    session.catalystCount,
    session.updatedAt,
  ].join("|");
}

function DeskCover(props: {
  desk: DeskMapDesk | null;
  focus: CoverFocus;
  controlsOpen: boolean;
  error: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  onOpenControls: () => void;
  onUpload: (file: File | undefined) => void;
  onGenerate: () => void;
  onRemove: () => void;
  onDragStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
}) {
  return (
    <div className="narrative-deskmap-cover pointer-events-none absolute inset-x-0 top-0 h-[38%] max-h-[310px] overflow-hidden select-none">
      <div className="narrative-deskmap-cover__media pointer-events-none absolute inset-0 z-0 select-none">
        {props.desk?.mapImageUrl ? (
          <img
            src={props.desk.mapImageUrl}
            alt=""
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            className="h-full w-full select-none object-cover opacity-60 saturate-[0.86]"
            style={{ objectPosition: `${props.focus.x}% ${props.focus.y}%` }}
          />
        ) : (
          <div
            className="h-full w-full opacity-55"
            style={{
              background: `radial-gradient(circle at 18% 15%, ${hexToRgba(props.desk?.color ?? "#c79f4a", 0.22)}, transparent 34%), linear-gradient(135deg, rgba(199,159,74,0.12), transparent 58%)`,
            }}
          />
        )}
      </div>
      <div className="narrative-deskmap-cover__blend pointer-events-none absolute inset-0 z-0" />
      {props.controlsOpen || !props.desk?.mapImageUrl ? (
        <div className="pointer-events-auto absolute right-3 top-[68px] z-30 flex items-center gap-1.5">
          <input
            ref={props.inputRef}
            type="file"
            accept="image/*,.gif"
            className="hidden"
            onChange={(event) => props.onUpload(event.target.files?.[0])}
          />
          <CoverButton
            title="Change cover"
            onClick={() => props.inputRef.current?.click()}
          >
            <ImagePlus size={14} />
          </CoverButton>
          <CoverButton
            title={
              props.desk?.mapImageUrl ? "Regenerate cover" : "Generate cover"
            }
            onClick={props.onGenerate}
          >
            {props.desk?.mapImageUrl ? (
              <RefreshCw size={14} />
            ) : (
              <Sparkles size={14} />
            )}
          </CoverButton>
          {props.desk?.mapImageUrl ? (
            <CoverButton title="Remove cover" onClick={props.onRemove}>
              <Trash2 size={14} />
            </CoverButton>
          ) : null}
        </div>
      ) : null}
      {props.error ? (
        <div className="absolute right-3 top-12 rounded bg-[var(--fintheon-overlay-surface)] px-2 py-1 text-[10px] text-red-300">
          {props.error}
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
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="narrative-cover-button grid h-8 w-8 place-items-center rounded-[4px] border-0 bg-transparent text-[var(--fintheon-accent)] outline-none ring-0 transition hover:-translate-y-px hover:text-[var(--fintheon-text)] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0"
    >
      {children}
    </button>
  );
}

function NarrativeBubble({
  session,
  position,
  active,
  selected,
  heatmapActive,
  presence,
  onSelect,
}: {
  session: NarrativeSessionSummary;
  position: DeskMapPoint;
  active: boolean;
  selected: boolean;
  heatmapActive: boolean;
  presence: CanvasPresence;
  onSelect: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const size = clamp(190 + session.catalystCount * 3, 190, 310);
  const opacity = heatmapActive
    ? clamp(0.12 + session.catalystCount / 70, 0.18, 0.42)
    : 0.18;
  return (
    <button
      type="button"
      onClick={onSelect}
      data-presence={presence}
      className="narrative-deskmap-card narrative-fade-item group absolute -translate-x-1/2 -translate-y-1/2 text-left"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        width: size,
        height: size,
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full border backdrop-blur-md transition duration-200 group-hover:scale-[1.025]"
        style={{
          borderColor: hexToRgba(session.color, active ? 0.62 : 0.35),
          background: hexToRgba(session.color, Math.min(0.28, opacity * 0.7)),
          boxShadow:
            active || selected
              ? `0 0 20px ${hexToRgba(session.color, 0.13)}`
              : "none",
          filter: "saturate(0.35)",
        }}
      />
      <span
        className="absolute left-1/2 top-1/2 block w-[76%] -translate-x-1/2 -translate-y-1/2 border-0 bg-transparent p-3 transition group-hover:-translate-y-[51%]"
        style={{ filter: "saturate(0.35)" }}
      >
        <span className="block line-clamp-3 text-[13px] font-semibold leading-4 text-[var(--fintheon-text)]">
          {session.title}
        </span>
        <span className="mt-2 flex items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)]">
          <span>{session.catalystCount} catalysts</span>
          <span>{formatDeskMapAge(session.updatedAt)}</span>
        </span>
      </span>
    </button>
  );
}

function EmptyDeskMap({ desk }: { desk: DeskMapDesk | null }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
          Fresh DeskMap
        </p>
        <p className="mt-2 max-w-sm text-xs leading-5 text-[var(--fintheon-muted)]">
          Active narratives for {desk?.name ?? "the desk"} will appear here.
        </p>
      </div>
    </div>
  );
}

function toggleSet(current: Set<string>, id: string): Set<string> {
  const next = new Set(current);
  next.has(id) ? next.delete(id) : next.add(id);
  return next;
}
