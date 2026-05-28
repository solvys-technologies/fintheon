// [Codex 2026-05-27] Wires forecasting-model FileRoom saves through backend RBAC.
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { BookOpen, Loader2, RefreshCcw } from "lucide-react";
import { useBackend } from "../../lib/backend";
import type {
  FileRoomIndex,
  FileRoomItem,
  FileRoomItemDetail,
} from "../../lib/services/file-room";
import { FileRoomDetailPane } from "./FileRoomDetailPane";
import { FileRoomSectionList } from "./FileRoomSectionList";

const DEFAULT_DESK_ID = "priced-in-capital";

export function FileRoomPanel() {
  const backend = useBackend();
  const [fileRoom, setFileRoom] = useState<FileRoomIndex | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<FileRoomItemDetail | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await backend.fileRoom.list(DEFAULT_DESK_ID);
      const items = next.sections.flatMap((section) => section.items);
      setFileRoom(next);
      setExpandedIds((current) =>
        current.size
          ? current
          : new Set(next.sections.map((section) => section.id)),
      );
      setSelectedId((current) =>
        current && items.some((item) => item.id === current)
          ? current
          : (items[0]?.id ?? null),
      );
    } catch (err) {
      setFileRoom(null);
      setError(err instanceof Error ? err.message : "File Room unavailable");
    } finally {
      setIsLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    let isCancelled = false;
    setIsDetailLoading(true);
    backend.fileRoom
      .getItem(selectedId, DEFAULT_DESK_ID)
      .then((item) => {
        if (!isCancelled) setSelectedDetail(item);
      })
      .catch(() => {
        if (!isCancelled) setSelectedDetail(null);
      })
      .finally(() => {
        if (!isCancelled) setIsDetailLoading(false);
      });
    return () => {
      isCancelled = true;
    };
  }, [backend, selectedId]);

  const selectedItem = useMemo(
    () =>
      fileRoom?.sections
        .flatMap((section) => section.items)
        .find((item) => item.id === selectedId) ?? null,
    [fileRoom, selectedId],
  );

  const totalCount =
    fileRoom?.sections.reduce(
      (sum, section) => sum + section.items.length,
      0,
    ) ?? 0;

  return (
    <div className="grid h-full grid-cols-[minmax(360px,430px)_1fr] bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]">
      <aside className="min-w-0 border-r border-[color-mix(in_srgb,var(--fintheon-accent)_10%,transparent)] bg-[color-mix(in_srgb,var(--fintheon-surface)_92%,var(--fintheon-bg))]">
        <FileRoomHeader
          deskName={fileRoom?.desk.name ?? "Priced In Capital"}
          totalCount={totalCount}
          isLoading={isLoading}
          onRefresh={() => void load()}
        />
        <div className="h-[calc(100%-72px)] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center gap-2 px-5 py-6 font-mono text-[10px] uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--fintheon-text)_36%,transparent)]">
              <Loader2 size={13} className="animate-spin" />
              Loading
            </div>
          ) : null}
          {!isLoading && error ? (
            <div className="mx-4 mt-4 rounded border border-[color-mix(in_srgb,var(--fintheon-accent)_14%,transparent)] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--fintheon-text)_42%,transparent)]">
              [ERROR] {error}
            </div>
          ) : null}
          {!isLoading && fileRoom ? (
            <FileRoomSectionList
              sections={fileRoom.sections}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={(id) => toggleExpanded(id, setExpandedIds)}
              onSelect={(item: FileRoomItem) => setSelectedId(item.id)}
            />
          ) : null}
        </div>
      </aside>
      <main className="min-w-0 overflow-y-auto bg-[var(--fintheon-bg)]">
        <FileRoomDetailPane
          item={selectedItem}
          detail={selectedDetail}
          isLoading={isDetailLoading}
          onSave={async (item, content) => {
            const saved = await backend.fileRoom.saveItem({
              id: item.id,
              sectionId: "forecasting-models",
              title: item.title,
              content,
            });
            setSelectedDetail(saved);
            await load();
          }}
        />
      </main>
    </div>
  );
}

function FileRoomHeader({
  deskName,
  totalCount,
  isLoading,
  onRefresh,
}: {
  deskName: string;
  totalCount: number;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="flex h-[72px] items-center gap-3 border-b border-[color-mix(in_srgb,var(--fintheon-accent)_10%,transparent)] px-5">
      <BookOpen
        size={16}
        className="text-[color-mix(in_srgb,var(--fintheon-accent)_70%,transparent)]"
      />
      <div className="min-w-0 flex-1">
        <h2 className="text-[13px] font-semibold tracking-normal text-[color-mix(in_srgb,var(--fintheon-text)_90%,transparent)]">
          File Room
        </h2>
        <p className="mt-1 truncate font-mono text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_36%,transparent)]">
          {deskName} · {totalCount} documents
        </p>
      </div>
      <button
        type="button"
        disabled={isLoading}
        onClick={onRefresh}
        className="rounded border border-[color-mix(in_srgb,var(--fintheon-accent)_12%,transparent)] p-1.5 text-[color-mix(in_srgb,var(--fintheon-text)_42%,transparent)] transition-colors hover:border-[color-mix(in_srgb,var(--fintheon-accent)_24%,transparent)] hover:text-[var(--fintheon-accent)] disabled:opacity-35"
        aria-label="Refresh File Room"
        title="Refresh File Room"
      >
        <RefreshCcw size={13} />
      </button>
    </header>
  );
}

function toggleExpanded(
  id: string,
  setExpandedIds: Dispatch<SetStateAction<Set<string>>>,
) {
  setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
}
