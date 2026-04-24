/**
 * VisionStatus
 * Eye indicator showing Harper Vision capture state
 * Solvys-feels: industrial-luxe monochrome with gold accent
 */

import React, { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useHarperVision } from "../../hooks/useHarperVision";
import { VisionPanel } from "./VisionPanel";

export const VisionStatus: React.FC = () => {
  const { status, isLoading, startCapture, stopCapture } = useHarperVision();
  const [showPanel, setShowPanel] = useState(false);
  const isCapturing = status.screen.isCapturing;

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
          background: isCapturing ? "rgba(199, 159, 74, 0.10)" : "transparent",
          border: isCapturing
            ? "1px solid rgba(199, 159, 74, 0.30)"
            : "1px solid rgba(199, 159, 74, 0.10)",
        }}
        title={
          isCapturing
            ? "Harper is watching — click to open panel"
            : "Enable Harper Vision"
        }
      >
        {isLoading ? (
          <Loader2
            size={16}
            className="animate-spin"
            style={{ color: "#c79f4a" }}
          />
        ) : isCapturing ? (
          <Eye size={16} style={{ color: "#c79f4a" }} />
        ) : (
          <EyeOff size={16} style={{ color: "rgba(240, 234, 214, 0.40)" }} />
        )}
        <span
          className="text-xs font-medium tracking-wide"
          style={{
            color: isCapturing ? "#c79f4a" : "rgba(240, 234, 214, 0.40)",
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
            style={{ background: "#c79f4a" }}
          />
        )}
      </button>
      {showPanel && <VisionPanel onClose={() => setShowPanel(false)} />}
    </>
  );
};
