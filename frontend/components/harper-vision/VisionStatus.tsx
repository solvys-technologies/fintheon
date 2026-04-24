// [claude-code 2026-04-23] S32-T2 Harper Vision — red eye when privacy-mode is on
/**
 * VisionStatus
 * Eye indicator showing Harper Vision capture state
 * Industrial-luxe monochrome with gold accent; red accent when paused.
 */

import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useHarperVision } from "../../hooks/useHarperVision";
import { VisionPanel } from "./VisionPanel";

export const VisionStatus: React.FC = () => {
  const { status, isLoading, startCapture, stopCapture } = useHarperVision();
  const [showPanel, setShowPanel] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const isCapturing = status.screen.isCapturing;

  useEffect(() => {
    const poll = () =>
      window.electron?.harperVision
        ?.getPrivacyMode()
        .then((res) => setPrivacyMode(!!res?.privacyMode))
        .catch(() => {});
    poll();
    const id = window.setInterval(poll, 3000);
    return () => window.clearInterval(id);
  }, []);

  const accent = privacyMode ? "#da0000" : "#c79f4a";

  const handleToggle = async () => {
    if (isLoading) return;
    if (isCapturing) {
      await stopCapture();
    } else {
      await startCapture();
    }
  };

  const handleClick = () => {
    setShowPanel(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md transition-all duration-200"
        style={{
          background: isCapturing
            ? privacyMode
              ? "rgba(218, 0, 0, 0.08)"
              : "rgba(199, 159, 74, 0.10)"
            : "transparent",
          border: isCapturing
            ? `1px solid ${privacyMode ? "rgba(218, 0, 0, 0.35)" : "rgba(199, 159, 74, 0.30)"}`
            : "1px solid rgba(199, 159, 74, 0.10)",
        }}
        title={
          privacyMode
            ? "Harper Vision paused (privacy mode)"
            : isCapturing
              ? "Harper is watching — click to open panel"
              : "Enable Harper Vision"
        }
      >
        {isLoading ? (
          <Loader2
            size={16}
            className="animate-spin"
            style={{ color: accent }}
          />
        ) : privacyMode ? (
          <EyeOff size={16} style={{ color: "#da0000" }} />
        ) : isCapturing ? (
          <Eye size={16} style={{ color: "#c79f4a" }} />
        ) : (
          <EyeOff size={16} style={{ color: "rgba(240, 234, 214, 0.40)" }} />
        )}
        <span
          className="text-xs font-medium tracking-wide"
          style={{
            color: isCapturing ? accent : "rgba(240, 234, 214, 0.40)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {isCapturing
            ? `VISION ${status.screen.frameCounter > 0 ? `(${status.screen.frameCounter})` : ""}`
            : "VISION"}
        </span>
        {isCapturing && (
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: accent }}
          />
        )}
      </button>
      {showPanel && <VisionPanel onClose={() => setShowPanel(false)} />}
    </>
  );
};
