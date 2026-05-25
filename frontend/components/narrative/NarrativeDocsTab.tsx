import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ChevronRight,
  ExternalLink,
  FileDown,
  FileText,
  Layers,
  Link2,
  Network,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import type {
  NarrativeWorkspaceLink,
  NarrativeWorkspaceSession,
} from "./NarrativeSessionWorkspace";
import type {
  SensemakingCatalyst,
  SensemakingNarrativeGroup,
  SensemakingResponse,
} from "./sensemaking-types";
import { safeNarrativeText } from "../../lib/market-impact-format";

interface NarrativeDocsTabProps {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
}

interface WorkspacePdf {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  url: string;
}

interface MemoFile {
  id: string;
  kind: "fileroom" | "agent" | "pdf";
  title: string;
  source: string;
  timeLabel: string;
  href?: string;
  pdfId?: string;
}

type FolderId = "brief" | "links" | "narratives";

const maxLocalPdfBytes = 8 * 1024 * 1024;

export function NarrativeDocsTab({ session, response }: NarrativeDocsTabProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [openFolders, setOpenFolders] = useState<Record<FolderId, boolean>>({
    brief: true,
    links: true,
    narratives: true,
  });
  const [previewLink, setPreviewLink] = useState<NarrativeWorkspaceLink | null>(null);
  const [uploadedPdfs, setUploadedPdfs] = useState<WorkspacePdf[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const storageKey = `narrativeflow:workspace-pdfs:${session?.id ?? "draft"}`;
  const report = session?.report ?? response?.forecast?.rationale ?? response?.synthesisSummary;
  const synthesis = session?.synthesis ?? response?.synthesisSummary;
  const links = session?.webLinks ?? [];
  const catalysts = response
    ? [...response.anchorCatalysts, ...response.relatedCatalysts]
    : [];
  const memoFiles = useMemo(
    () => buildMemoFiles({ session, response, uploadedPdfs }),
    [response, session, uploadedPdfs],
  );

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      setUploadedPdfs(stored ? JSON.parse(stored) : []);
    } catch {
      setUploadedPdfs([]);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(uploadedPdfs));
    } catch {
      if (uploadedPdfs.length > 0) setUploadError("PDF added, but browser storage is full.");
    }
  }, [storageKey, uploadedPdfs]);

  function toggleFolder(id: FolderId) {
    setOpenFolders((current) => ({ ...current, [id]: !current[id] }));
  }

  async function handlePdfUpload(event: ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const files = Array.from(event.target.files ?? []);
    const pdfs = files.filter((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
    const oversized = pdfs.find((file) => file.size > maxLocalPdfBytes);
    if (oversized) {
      setUploadError(`${oversized.name} is larger than 8 MB.`);
      event.target.value = "";
      return;
    }
    const nextFiles = await Promise.all(
      pdfs.map(async (file) => ({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        url: await readFileAsDataUrl(file),
      })),
    );
    setUploadedPdfs((current) => [...nextFiles, ...current]);
    event.target.value = "";
  }

  function removePdf(id: string) {
    setUploadedPdfs((current) => current.filter((file) => file.id !== id));
  }

  if (previewLink) {
    return (
      <LinkPreview
        link={previewLink}
        title={titleWebLink(previewLink)}
        onClose={() => setPreviewLink(null)}
      />
    );
  }

  return (
    <div className="narrative-file-manager space-y-0">
      <section className="narrative-file-vault relative overflow-hidden p-3">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--fintheon-accent)]/72">
              Memos
            </p>
            <h3 className="mt-1 truncate text-sm font-semibold text-[var(--fintheon-text)]">
              {session?.title ?? "Narrative Workspace"}
            </h3>
            <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--fintheon-muted)]">
              FileRoom, user uploads, and agent-generated notes for this narrative.
            </p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:-translate-y-px hover:text-[var(--fintheon-text)]"
          >
            <Upload size={13} />
            PDF
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={handlePdfUpload}
          />
        </div>

        <div className="relative z-10 mt-3 space-y-1.5">
          {memoFiles.map((memo) => (
            <MemoRow key={memo.id} memo={memo} onRemove={memo.pdfId ? removePdf : undefined} />
          ))}
          {uploadError ? (
            <p className="px-2 py-1 text-[10px] text-red-300/85">{uploadError}</p>
          ) : null}
        </div>
      </section>

      <FolderSection
        id="brief"
        label="Quick Brief"
        count={report || synthesis ? 1 : 0}
        open={openFolders.brief}
        onToggle={toggleFolder}
      >
        <div className="space-y-3 px-2 pb-3 pt-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
              Priced In Capital desk synthesis
            </p>
            <button
              type="button"
              onClick={() => printQuickShare({ session, response, links })}
              className="inline-flex h-7 items-center gap-1.5 px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:text-[var(--fintheon-text)]"
            >
              <FileDown size={12} />
              PDF
            </button>
          </div>
          <p className="text-xs leading-5 text-[var(--fintheon-text)]/88">
            {report ?? "No quick brief is attached to this narrative session yet."}
          </p>
          <p className="text-[11px] leading-4 text-[var(--fintheon-muted)]">
            {synthesis ?? "The desk is building a plain-language summary for this narrative."}
          </p>
        </div>
      </FolderSection>

      <FolderSection id="links" label="Web Links" count={links.length} open={openFolders.links} onToggle={toggleFolder}>
        <div className="space-y-1.5 px-2 pb-3 pt-1">
          {links.length > 0 ? (
            links.map((link) => (
              <DocLink
                key={link.href}
                link={link}
                title={titleWebLink(link)}
                onPreview={() => setPreviewLink(link)}
              />
            ))
          ) : (
            <EmptyFolder label="Relevant web and report links will appear here." />
          )}
        </div>
      </FolderSection>

      <FolderSection
        id="narratives"
        label="Related Narratives"
        count={response?.narrativeGroups.length ?? 0}
        open={openFolders.narratives}
        onToggle={toggleFolder}
      >
        <div className="space-y-1.5 px-2 pb-3 pt-1">
          {response?.narrativeGroups.length ? (
            response.narrativeGroups.map((group) => (
              <NarrativeFolderRow key={group.id} group={group} catalysts={catalysts} />
            ))
          ) : (
            <EmptyFolder label="Related narrative folders will appear after synthesis." />
          )}
        </div>
      </FolderSection>
    </div>
  );
}

function MemoRow({
  memo,
  onRemove,
}: {
  memo: MemoFile;
  onRemove?: (id: string) => void;
}) {
  const Icon = memo.kind === "pdf" ? Paperclip : memo.kind === "agent" ? Network : FileText;
  const content = (
    <>
      <Icon size={14} className="mt-0.5 shrink-0 text-[var(--fintheon-accent)]/76" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold text-[var(--fintheon-text)]">
          {memo.title}
        </span>
        <span className="mt-0.5 block truncate text-[10px] uppercase tracking-[0.11em] text-[var(--fintheon-muted)]">
          {memo.source} / {memo.timeLabel}
        </span>
      </span>
    </>
  );
  return (
    <div className="narrative-file-row flex items-center gap-2 px-2 py-2">
      {memo.href ? (
        <a href={memo.href} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-start gap-2">
          {content}
        </a>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-2">{content}</div>
      )}
      {memo.pdfId && onRemove ? (
        <button
          type="button"
          onClick={() => onRemove(memo.pdfId!)}
          className="grid h-6 w-6 shrink-0 place-items-center text-[var(--fintheon-muted)] transition hover:text-red-300"
          title="Remove PDF"
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}

function FolderSection({
  id,
  label,
  count,
  open,
  onToggle,
  children,
}: {
  id: FolderId;
  label: string;
  count: number;
  open: boolean;
  onToggle: (id: FolderId) => void;
  children: ReactNode;
}) {
  return (
    <section className="narrative-folder-section">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center gap-2 px-2 py-2 text-left text-[var(--fintheon-text)] transition hover:text-[var(--fintheon-accent)]"
        aria-expanded={open}
      >
        <ChevronRight size={13} className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
        <Layers size={14} className={open ? "text-[var(--fintheon-accent)]" : ""} />
        <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.15em]">
          {label}
        </span>
        <span className="font-mono text-[10px] text-[var(--fintheon-muted)]">{count}</span>
      </button>
      {open ? children : null}
    </section>
  );
}

function NarrativeFolderRow({
  group,
  catalysts,
}: {
  group: SensemakingNarrativeGroup;
  catalysts: SensemakingCatalyst[];
}) {
  const groupCatalysts = catalysts.filter((catalyst) => group.catalystIds.includes(catalyst.id));
  return (
    <article className="narrative-file-row px-2 py-2">
      <div className="flex items-start gap-2">
        <Network size={14} className="mt-0.5 shrink-0 text-[var(--fintheon-accent)]/76" />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-[var(--fintheon-text)]">{group.title}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[var(--fintheon-muted)]">{group.summary}</p>
          <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/64">
            {groupCatalysts.length} files / {group.timeSpan}
          </p>
        </div>
      </div>
    </article>
  );
}

function LinkPreview({
  link,
  title,
  onClose,
}: {
  link: NarrativeWorkspaceLink;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="relative h-full min-h-[620px] overflow-hidden">
      <iframe
        title={title}
        src={link.href}
        className="absolute inset-0 h-full w-full bg-[var(--fintheon-bg)]"
        sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[var(--fintheon-bg)] via-[var(--fintheon-bg)]/72 to-transparent" />
      <button
        type="button"
        onClick={onClose}
        className="absolute left-2 top-2 z-10 grid h-8 w-8 place-items-center text-[var(--fintheon-accent)] transition hover:-translate-y-px hover:text-[var(--fintheon-text)]"
        aria-label="Close link preview"
        title="Close preview"
      >
        <X size={15} />
      </button>
      <p className="pointer-events-none absolute left-12 top-3 z-10 max-w-[calc(100%-4rem)] truncate text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]">
        {title}
      </p>
    </div>
  );
}

function DocLink({
  link,
  title,
  onPreview,
}: {
  link: NarrativeWorkspaceLink;
  title: string;
  onPreview: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPreview}
      className="narrative-file-row flex w-full items-center justify-between gap-3 px-2 py-2 text-left text-xs text-[var(--fintheon-text)]/86 transition"
    >
      <span className="min-w-0 flex items-center gap-2">
        <Link2 size={13} className="shrink-0 text-[var(--fintheon-accent)]/72" />
        <span className="min-w-0">
          <span className="block truncate">{title}</span>
          {link.source ? <span className="block truncate text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)]">{link.source}</span> : null}
        </span>
      </span>
      <ExternalLink size={12} className="shrink-0 text-[var(--fintheon-accent)]/70" />
    </button>
  );
}

function EmptyFolder({ label }: { label: string }) {
  return (
    <p className="px-2 py-3 text-xs leading-5 text-[var(--fintheon-muted)]">
      {label}
    </p>
  );
}

function buildMemoFiles({
  session,
  response,
  uploadedPdfs,
}: {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  uploadedPdfs: WorkspacePdf[];
}): MemoFile[] {
  const report = session?.report ?? response?.forecast?.rationale ?? response?.synthesisSummary;
  const files = [
    {
      id: "fileroom-brief",
      kind: "fileroom" as const,
      title: report ? "Desk brief from FileRoom" : "FileRoom brief pending",
      source: "FileRoom",
      timeLabel: formatGeneratedAt(session?.generatedAt ?? response?.generatedAt),
    },
    ...((session?.workEvents ?? []).slice(0, 3).map((event) => ({
      id: event.id,
      kind: "agent" as const,
      title: event.summary,
      source: event.agent,
      timeLabel: event.timestamp ? formatGeneratedAt(event.timestamp) : "recent",
    }))),
    ...uploadedPdfs.map((file) => ({
      id: file.id,
      kind: "pdf" as const,
      title: file.name,
      source: formatBytes(file.size),
      timeLabel: formatGeneratedAt(file.uploadedAt),
      href: file.url,
      pdfId: file.id,
    })),
  ];
  return files;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function printQuickShare({
  session,
  response,
  links,
}: {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  links: NarrativeWorkspaceLink[];
}) {
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!win) return;
  const catalysts = response ? [...response.anchorCatalysts, ...response.relatedCatalysts] : [];
  win.document.write(buildPrintableDoc({ session, response, links, catalysts }));
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 250);
}

function buildPrintableDoc({
  session,
  response,
  links,
  catalysts,
}: {
  session: NarrativeWorkspaceSession | null;
  response: SensemakingResponse | null;
  links: NarrativeWorkspaceLink[];
  catalysts: SensemakingCatalyst[];
}) {
  const title = escapeHtml(session?.title ?? response?.anchorCatalysts[0]?.headline ?? "Narrative Brief");
  const synthesis = escapeHtml(session?.synthesis ?? response?.synthesisSummary ?? "Synthesis pending.");
  const catalystRows = catalysts
    .slice(0, 12)
    .map(
      (item) =>
        `<li><strong>${escapeHtml(item.headline)}</strong><span>${item.role} | IV ${item.ivScore.toFixed(1)} | ${escapeHtml(item.source)}</span><p>${escapeHtml(safeNarrativeText(item.summary, "No catalyst summary yet.") ?? "")}</p></li>`,
    )
    .join("");
  const linkRows = links
    .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(titleWebLink(link))}</a></li>`)
    .join("");
  return `<!doctype html><html><head><title>${title}</title><style>
    body{background:#050402;color:#f0ead6;font:14px/1.55 -apple-system,BlinkMacSystemFont,"Inter",sans-serif;margin:48px}
    header{border-bottom:1px solid rgba(199,159,74,.25);padding-bottom:18px;margin-bottom:24px}
    h1{font-size:28px;line-height:1.1;margin:0 0 8px} h2{color:#c79f4a;font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin:22px 0 8px}
    p{margin:0 0 10px;color:rgba(240,234,214,.86)} ul{padding:0;margin:0;list-style:none} li{border:1px solid rgba(199,159,74,.18);padding:12px;margin:8px 0}
    li span{display:block;color:rgba(240,234,214,.55);font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-top:4px}
    a{color:#c79f4a} @media print{body{background:#fff;color:#111}p,li span{color:#444}h2,a{color:#7a5a17}li{border-color:#ddd}}
  </style></head><body><header><h1>${title}</h1><p>Priced In Capital desk synthesis | ${escapeHtml(formatGeneratedAt(session?.generatedAt ?? response?.generatedAt))}</p></header><section><h2>Plain Read</h2><p>${synthesis}</p></section><section><h2>Catalyst Packet</h2><ul>${catalystRows || "<li>No catalysts attached.</li>"}</ul></section><section><h2>Sources</h2><ul>${linkRows || "<li>Source links pending.</li>"}</ul></section></body></html>`;
}

function formatGeneratedAt(value: string | undefined) {
  if (!value) return "Generated just now";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function titleWebLink(link: NarrativeWorkspaceLink) {
  const label = link.label.trim();
  if (label && !looksLikeUrl(label)) return compactLinkTitle(label);
  if (link.source && !looksLikeUrl(link.source)) return compactLinkTitle(link.source);
  return summarizeUrl(link.href);
}

function compactLinkTitle(value: string) {
  const cleaned = value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= 7) return cleaned;
  return words.slice(0, 4).join(" ");
}

function summarizeUrl(value: string) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("federalreserve")) return "Fed Policy Context";
    if (host.includes("bls.gov")) return "Labor Data Source";
    if (host.includes("bea.gov")) return "Growth Data Source";
    if (host.includes("treasury.gov")) return "Treasury Supply Context";
    if (host.includes("reuters")) return "Reuters Market Read";
    if (host.includes("bloomberg")) return "Bloomberg Market Read";
    const pathWords = url.pathname
      .split("/")
      .filter(Boolean)
      .slice(-2)
      .join(" ")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_-]+/g, " ")
      .split(" ")
      .filter((word) => word.length > 2);
    if (pathWords.length) return titleCase(pathWords.slice(0, 4).join(" "));
    return titleCase(host.split(".")[0] ?? "Narrative Source Link");
  } catch {
    return "Narrative Source Link";
  }
}

function looksLikeUrl(value: string) {
  return /^https?:\/\//i.test(value) || /^www\./i.test(value) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(value);
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[char] ?? char;
  });
}
