// [claude-code 2026-04-19] S24 unify: dismissal persists per-version in localStorage (key
//   fintheon:update-dismissed:v<version>). If the user clicks Later on v5.21.0, we don't nag
//   again until v5.22.0 releases. Also suppress the banner entirely when the pending version
//   equals the running build (stops the "already latest" repeat-prompt class reported by TP).
// [claude-code 2026-04-05] Bottom-right update toast — Install Now / Later CTAs, auto-downloads in background
import { useEffect, useState, useCallback } from "react";
import { Download, X, Loader2, RotateCw } from "@/components/shared/iso-icons";
import type { UpdateInfo, UpdateProgress } from "../types/electron";
import pkgJson from "../../package.json";

type UpdateState = "idle" | "downloading" | "ready";

const BUILD_VERSION = (pkgJson as { version?: string }).version ?? "0.0.0";
const DISMISS_KEY_PREFIX = "fintheon:update-dismissed:";

function isDismissedForVersion(v: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DISMISS_KEY_PREFIX + v) === "1";
  } catch {
    return false;
  }
}

function markDismissedForVersion(v: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DISMISS_KEY_PREFIX + v, "1");
  } catch {
    /* localStorage can be disabled — best-effort only */
  }
}

/**
 * Compare two semver strings: returns true if `candidate` is strictly newer than `current`.
 * Handles missing/malformed pieces by treating them as zero. "5.21.0" > "5.20.1" → true.
 */
function isNewerThan(candidate: string, current: string): boolean {
  const parse = (v: string) =>
    v
      .replace(/^v/, "")
      .split(/[.-]/)
      .map((p) => parseInt(p, 10))
      .map((n) => (Number.isFinite(n) ? n : 0));
  const a = parse(candidate);
  const b = parse(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>("idle");
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = window.electron;
    if (!el?.onUpdateAvailable) return;

    el.onUpdateAvailable((updateInfo) => {
      // Suppress if user already dismissed this exact version, or if the offered
      // version isn't actually newer than what's running (guards against the
      // "latest users still see the banner" class of bug).
      if (!isNewerThan(updateInfo.version, BUILD_VERSION)) {
        return;
      }
      if (isDismissedForVersion(updateInfo.version)) {
        return;
      }
      setInfo(updateInfo);
      setState("downloading");
      setDismissed(false);
    });

    el.onUpdateProgress((p) => {
      setProgress(p);
    });

    el.onUpdateDownloaded(() => {
      setState("ready");
    });

    return () => {
      el.onUpdateAvailable(null);
      el.onUpdateProgress(null);
      el.onUpdateDownloaded(null);
    };
  }, []);

  // Enter animation
  useEffect(() => {
    if (state !== "idle" && !dismissed) {
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
  }, [state, dismissed]);

  const handleInstall = useCallback(() => {
    window.electron?.installUpdate();
  }, []);

  const handleLater = useCallback(() => {
    if (info?.version) markDismissedForVersion(info.version);
    setEntered(false);
    setTimeout(() => setDismissed(true), 300);
  }, [info?.version]);

  if (state === "idle" || dismissed) return null;

  const isVisible = entered;
  const isReady = state === "ready";

  return (
    <div
      className="fixed z-[150] transition-all duration-300 ease-out"
      style={{
        bottom: "24px",
        right: "24px",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(16px)",
        width: "320px",
        borderRadius: "12px",
        border: `1px solid ${isReady ? "var(--fintheon-accent)" : "rgba(199,159,74,0.3)"}`,
        backgroundColor: "var(--fintheon-surface)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
        overflow: "hidden",
        pointerEvents: isVisible ? "auto" : "none",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: "12px 14px 0" }}
      >
        <div className="flex items-center" style={{ gap: "8px" }}>
          {isReady ? (
            <RotateCw size={14} style={{ color: "var(--fintheon-accent)" }} />
          ) : (
            <Download
              size={14}
              style={{ color: "var(--fintheon-accent)", opacity: 0.6 }}
            />
          )}
          <span
            className="text-[13px] font-semibold"
            style={{ color: "var(--fintheon-text)" }}
          >
            {isReady ? "Update ready" : "New update available"}
            {info?.version && (
              <span
                style={{ color: "var(--fintheon-accent)", marginLeft: "4px" }}
              >
                v{info.version}
              </span>
            )}
          </span>
        </div>
        <button
          onClick={handleLater}
          className="flex items-center justify-center rounded text-gray-500 hover:text-white transition-colors"
          style={{ width: "22px", height: "22px" }}
        >
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: "8px 14px 12px" }}>
        <p
          className="text-[11px] leading-relaxed"
          style={{ color: "rgba(156,163,175,0.8)", marginBottom: "8px" }}
        >
          {isReady
            ? "Ready to install. A quick restart will apply the update."
            : `Downloading in the background${progress ? ` — ${progress.percent}%` : "..."}`}
        </p>

        {/* Progress bar — only during download */}
        {state === "downloading" && (
          <div
            style={{
              height: "3px",
              borderRadius: "2px",
              backgroundColor: "rgba(199,159,74,0.15)",
              marginBottom: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress?.percent ?? 0}%`,
                borderRadius: "2px",
                backgroundColor: "var(--fintheon-accent)",
                transition: "width 300ms ease",
              }}
            />
          </div>
        )}

        {/* Actions — Later + Install Now */}
        <div className="flex items-center justify-end" style={{ gap: "8px" }}>
          <button
            onClick={handleLater}
            className="text-[11px] transition-colors"
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              color: "rgba(156,163,175,0.7)",
              backgroundColor: "transparent",
              border: "1px solid rgba(156,163,175,0.15)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(156,163,175,1)";
              e.currentTarget.style.borderColor = "rgba(156,163,175,0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(156,163,175,0.7)";
              e.currentTarget.style.borderColor = "rgba(156,163,175,0.15)";
            }}
          >
            Later
          </button>

          <button
            onClick={isReady ? handleInstall : undefined}
            disabled={!isReady}
            className="text-[11px] font-semibold transition-all flex items-center"
            style={{
              padding: "5px 14px",
              borderRadius: "6px",
              gap: "5px",
              color: isReady ? "#050402" : "rgba(156,163,175,0.5)",
              backgroundColor: isReady
                ? "var(--fintheon-accent)"
                : "rgba(199,159,74,0.15)",
              cursor: isReady ? "pointer" : "default",
            }}
            onMouseEnter={(e) => {
              if (isReady) e.currentTarget.style.filter = "brightness(1.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
            }}
          >
            {state === "downloading" && (
              <Loader2 size={11} className="animate-spin" />
            )}
            {state === "downloading" && "Downloading..."}
            {isReady && "Install Now"}
          </button>
        </div>
      </div>
    </div>
  );
}
