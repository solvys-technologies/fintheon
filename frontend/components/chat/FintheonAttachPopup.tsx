// [claude-code 2026-04-12] Liquid glass + tab fade transitions + RiskFlow headline picker wired
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type DragEvent,
} from "react";
import { X, FileText, Image, Activity, Check, Search } from "lucide-react";
import type { RiskFlowAlert } from "../../lib/riskflow-feed";
import { useToast } from "../../contexts/ToastContext";
import { RepoChatComposerSurface } from "./composer/RepoChatComposer";

type AttachTab = "docs" | "media" | "riskflow";

export interface HeadlineAttachment {
  id: string;
  headline: string;
  severity?: string;
  direction?: string | null;
}

interface FintheonAttachPopupProps {
  open: boolean;
  onClose: () => void;
  initialTab?: AttachTab;
  onAttachImage?: (dataUrl: string) => void;
  onAttachDocument?: (payload: { filename: string; text: string }) => void;
  /** Scored RiskFlow alerts available for attachment */
  riskflowAlerts?: RiskFlowAlert[];
  /** Callback when headlines are selected and confirmed */
  onAttachHeadlines?: (items: HeadlineAttachment[]) => void;
}

function compressImage(
  file: File,
  maxDim = 1200,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function FintheonAttachPopup({
  open,
  onClose,
  initialTab = "media",
  onAttachImage,
  onAttachDocument,
  riskflowAlerts = [],
  onAttachHeadlines,
}: FintheonAttachPopupProps) {
  const { addToast } = useToast();
  const [tab, setTab] = useState<AttachTab>(initialTab);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabAnimating, setTabAnimating] = useState(false);
  const [visibleTab, setVisibleTab] = useState<AttachTab>(initialTab);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef = useRef<HTMLInputElement>(null);

  // RiskFlow inline picker state
  const [rfQuery, setRfQuery] = useState("");
  const [rfSelected, setRfSelected] = useState<Set<string>>(new Set());
  const rfInputRef = useRef<HTMLInputElement>(null);

  // Tab transition with fade
  const switchTab = useCallback(
    (newTab: AttachTab) => {
      if (newTab === tab) return;
      setTabAnimating(true);
      // Fade out current, then swap
      setTimeout(() => {
        setVisibleTab(newTab);
        setTab(newTab);
        setError(null);
        // Fade in new
        requestAnimationFrame(() => setTabAnimating(false));
      }, 150);
    },
    [tab],
  );

  // Reset state when popup closes
  useEffect(() => {
    if (!open) {
      setRfQuery("");
      setRfSelected(new Set());
      return;
    }
    setTab(initialTab);
    setVisibleTab(initialTab);
    setTabAnimating(false);
  }, [initialTab, open]);

  // Focus search when switching to riskflow tab
  useEffect(() => {
    if (visibleTab === "riskflow" && !tabAnimating) {
      setTimeout(() => rfInputRef.current?.focus(), 50);
    }
  }, [visibleTab, tabAnimating]);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        addToast("Only image files are supported in Media tab.", "error");
        setError("Only image files are supported.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        addToast("Image must be under 10 MB.", "error");
        setError("Image must be under 10 MB.");
        return;
      }
      setError(null);
      try {
        const dataUrl = await compressImage(file);
        onAttachImage?.(dataUrl);
        onClose();
      } catch {
        addToast("Failed to process image.", "error");
        setError("Failed to process image.");
      }
    },
    [onAttachImage, onClose, addToast],
  );

  const handleDocumentFile = useCallback(
    async (file: File) => {
      const lower = file.name.toLowerCase();
      const isMarkdown = lower.endsWith(".md") || file.type === "text/markdown";
      const isPdf = lower.endsWith(".pdf") || file.type === "application/pdf";
      if (!isMarkdown && !isPdf) {
        addToast("Only .pdf and .md files are supported.", "error");
        setError("Only .pdf and .md files are supported.");
        return;
      }
      setError(null);

      if (isMarkdown) {
        try {
          const text = await file.text();
          onAttachDocument?.({
            filename: file.name,
            text: text.slice(0, 20_000),
          });
          addToast(`Markdown file "${file.name}" attached.`, "success");
          onClose();
        } catch {
          addToast("Failed to read markdown file.", "error");
          setError("Failed to read markdown file.");
        }
        return;
      }

      onAttachDocument?.({
        filename: file.name,
        text: `[PDF Attachment: ${file.name}]`,
      });
      addToast(`PDF "${file.name}" attached (content preview only).`, "info");
      onClose();
    },
    [onAttachDocument, onClose, addToast],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const toggleRfItem = useCallback((id: string) => {
    setRfSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAttachSelected = useCallback(() => {
    if (rfSelected.size === 0) return;
    const items: HeadlineAttachment[] = riskflowAlerts
      .filter((a) => rfSelected.has(a.id))
      .map((a) => ({
        id: a.id,
        headline: a.headline,
        severity: a.severity,
        direction: a.direction,
      }));
    onAttachHeadlines?.(items);
    setRfSelected(new Set());
    onClose();
  }, [rfSelected, riskflowAlerts, onAttachHeadlines, onClose]);

  const filteredAlerts = rfQuery.trim()
    ? riskflowAlerts.filter((a) =>
        a.headline.toLowerCase().includes(rfQuery.toLowerCase()),
      )
    : riskflowAlerts;

  const tabs: { id: AttachTab; label: string; icon: typeof FileText }[] = [
    { id: "docs", label: "Docs", icon: FileText },
    { id: "media", label: "Media", icon: Image },
    { id: "riskflow", label: "RiskFlow", icon: Activity },
  ];

  return (
    <RepoChatComposerSurface
      open={open}
      kind="drawer"
      className="narrative-attach-drawer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[12px] font-semibold text-gray-400 uppercase tracking-wider">
          Attach
        </span>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => switchTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors ${
              tab === id
                ? "text-[var(--fintheon-accent)] border-b-2 border-[var(--fintheon-accent)]"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Content — with fade transition */}
      <div
        style={{
          padding: "12px 16px",
          minHeight: "80px",
          opacity: tabAnimating ? 0 : 1,
          transform: tabAnimating ? "translateY(4px)" : "translateY(0)",
          transition: "opacity 150ms ease, transform 150ms ease",
        }}
      >
        {visibleTab === "docs" && (
          <div className="text-center">
            <div
              onClick={() => docsInputRef.current?.click()}
              className="cursor-pointer flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-4 w-full transition-colors border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/40"
            >
              <FileText size={24} className="text-gray-600" />
              <span className="text-[12px] text-gray-400">
                Click to attach .pdf or .md
              </span>
              <span className="text-[10px] text-gray-500">
                Markdown text is attached inline for CAO context.
              </span>
              <input
                ref={docsInputRef}
                type="file"
                accept=".md,.pdf,text/markdown,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleDocumentFile(file);
                  e.target.value = "";
                }}
              />
            </div>
            {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
          </div>
        )}
        {visibleTab === "media" && (
          <div className="text-center">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer flex flex-col items-center gap-2 border-2 border-dashed rounded-lg p-4 w-full transition-colors ${
                isDragging
                  ? "border-[var(--fintheon-accent)]/60 bg-[var(--fintheon-accent)]/5"
                  : "border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/40"
              }`}
            >
              <Image size={24} className="text-gray-600" />
              <span className="text-[12px] text-gray-400">
                {isDragging ? "Drop image here" : "Drop or click to upload"}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>
            {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
          </div>
        )}
        {visibleTab === "riskflow" && (
          <div className="flex flex-col gap-2">
            {/* Search bar */}
            <div className="flex items-center gap-2 rounded-md bg-[var(--fintheon-accent)]/5 px-2 py-1">
              <Search size={11} className="text-zinc-500 shrink-0" />
              <input
                ref={rfInputRef}
                type="text"
                value={rfQuery}
                onChange={(e) => setRfQuery(e.target.value)}
                placeholder="Search headlines..."
                className="flex-1 bg-transparent text-[11px] text-[var(--fintheon-text)] placeholder:text-zinc-600 focus:outline-none"
              />
              {rfSelected.size > 0 && (
                <button
                  onClick={handleAttachSelected}
                  className="shrink-0 px-2 py-0.5 rounded text-[9px] font-bold tracking-wide bg-[var(--fintheon-accent)] text-black transition-colors hover:brightness-110"
                >
                  Attach {rfSelected.size}
                </button>
              )}
            </div>
            {/* Headlines list */}
            <div className="overflow-y-auto max-h-[140px]">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-4 text-[10px] text-zinc-600">
                  {rfQuery
                    ? "No matching headlines"
                    : "No scored headlines available"}
                </div>
              ) : (
                filteredAlerts.slice(0, 20).map((a) => {
                  const isSelected = rfSelected.has(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleRfItem(a.id)}
                      className={`w-full text-left px-2 py-1.5 text-[10px] transition-colors flex items-center gap-2 rounded ${
                        isSelected
                          ? "bg-[var(--fintheon-accent)]/8 text-[var(--fintheon-text)]"
                          : "text-[var(--fintheon-text)]/60 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          a.severity === "high" || a.severity === "critical"
                            ? "bg-red-400"
                            : a.severity === "medium"
                              ? "bg-[var(--fintheon-accent)]"
                              : "bg-zinc-500"
                        }`}
                      />
                      <span className="truncate flex-1">{a.headline}</span>
                      {a.direction && (
                        <span
                          className={`text-[8px] shrink-0 ${
                            a.direction === "Bullish"
                              ? "text-emerald-400/60"
                              : a.direction === "Bearish"
                                ? "text-red-400/60"
                                : "text-zinc-500"
                          }`}
                        >
                          {a.direction}
                        </span>
                      )}
                      <span
                        className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "border-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/20"
                            : "border-zinc-600"
                        }`}
                      >
                        {isSelected && (
                          <Check
                            size={9}
                            className="text-[var(--fintheon-accent)]"
                          />
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </RepoChatComposerSurface>
  );
}
