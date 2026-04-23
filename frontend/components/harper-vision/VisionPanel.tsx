/**
 * VisionPanel
 * Harper Vision control panel
 * Solvys-feels: frosted glass surface, monochrome canvas, gold accent
 */

import React, { useState } from "react";
import { Eye, EyeOff, Camera, Mic, MicOff, Pause, Play, X } from "lucide-react";
import { useHarperVision } from "../../hooks/useHarperVision";

interface VisionPanelProps {
  onClose: () => void;
}

export const VisionPanel: React.FC<VisionPanelProps> = ({ onClose }) => {
  const {
    status,
    isLoading,
    lastFrame,
    startCapture,
    stopCapture,
    captureOnce,
  } = useHarperVision();

  const [privacyMode, setPrivacyMode] = useState(false);
  const isCapturing = status.screen.isCapturing;

  const glassStyle: React.CSSProperties = {
    background: "rgba(10, 9, 5, 0.85)",
    backdropFilter: "blur(20px) saturate(1.4)",
    border: "1px solid rgba(199, 159, 74, 0.10)",
    borderRadius: "6px",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(5, 4, 2, 0.70)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md mx-4 p-6"
        style={glassStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Eye size={18} style={{ color: "#c79f4a" }} />
            <h2
              className="text-sm font-semibold tracking-wide uppercase"
              style={{
                color: "#f0ead6",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Harper Vision
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors duration-150 hover:bg-white/5"
          >
            <X size={16} style={{ color: "rgba(240, 234, 214, 0.50)" }} />
          </button>
        </div>

        {/* Status */}
        <div
          className="mb-6 p-4 rounded"
          style={{
            background: "rgba(199, 159, 74, 0.04)",
            border: "1px solid rgba(199, 159, 74, 0.08)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-xs uppercase tracking-wider"
              style={{ color: "rgba(240, 234, 214, 0.50)" }}
            >
              Status
            </span>
            <div className="flex items-center gap-2">
              {isCapturing ? (
                <>
                  <span
                    className="w-1.5 h-1.5 rounded-full animate-pulse"
                    style={{ background: "#c79f4a" }}
                  />
                  <span className="text-xs" style={{ color: "#c79f4a" }}>
                    ACTIVE
                  </span>
                </>
              ) : (
                <span
                  className="text-xs"
                  style={{ color: "rgba(240, 234, 214, 0.30)" }}
                >
                  IDLE
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span
                className="text-xs"
                style={{ color: "rgba(240, 234, 214, 0.60)" }}
              >
                Screen captures
              </span>
              <span
                className="text-xs font-medium"
                style={{
                  color: "#f0ead6",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {status.screen.frameCounter}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span
                className="text-xs"
                style={{ color: "rgba(240, 234, 214, 0.60)" }}
              >
                Capture interval
              </span>
              <span
                className="text-xs font-medium"
                style={{
                  color: "#f0ead6",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {status.screen.intervalMs / 1000}s
              </span>
            </div>
            {status.screen.sessionId && (
              <div className="flex items-center justify-between">
                <span
                  className="text-xs"
                  style={{ color: "rgba(240, 234, 214, 0.60)" }}
                >
                  Session
                </span>
                <span
                  className="text-xs"
                  style={{
                    color: "rgba(240, 234, 214, 0.40)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {status.screen.sessionId.slice(0, 12)}...
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={isCapturing ? stopCapture : startCapture}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-medium tracking-wide uppercase transition-all duration-200"
            style={{
              background: isCapturing ? "rgba(199, 159, 74, 0.12)" : "#c79f4a",
              color: isCapturing ? "#c79f4a" : "#050402",
              border: isCapturing
                ? "1px solid rgba(199, 159, 74, 0.20)"
                : "1px solid #c79f4a",
            }}
          >
            {isCapturing ? (
              <>
                <EyeOff size={14} /> Stop Capture
              </>
            ) : (
              <>
                <Eye size={14} /> Start Capture
              </>
            )}
          </button>

          <button
            onClick={captureOnce}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs font-medium tracking-wide uppercase transition-all duration-200"
            style={{
              background: "transparent",
              color: "rgba(240, 234, 214, 0.70)",
              border: "1px solid rgba(199, 159, 74, 0.15)",
            }}
          >
            <Camera size={14} /> Capture Now
          </button>
        </div>

        {/* Privacy toggle */}
        <button
          onClick={() => setPrivacyMode(!privacyMode)}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded text-xs tracking-wide uppercase transition-all duration-200 mb-6"
          style={{
            background: privacyMode ? "rgba(218, 0, 0, 0.08)" : "transparent",
            color: privacyMode ? "#da0000" : "rgba(240, 234, 214, 0.40)",
            border: privacyMode
              ? "1px solid rgba(218, 0, 0, 0.15)"
              : "1px solid rgba(199, 159, 74, 0.08)",
          }}
        >
          {privacyMode ? (
            <>
              <Pause size={14} /> Privacy Mode — Paused
            </>
          ) : (
            <>
              <Play size={14} /> Privacy Mode — Off
            </>
          )}
        </button>

        {/* Last frame preview */}
        {lastFrame && (
          <div className="mb-4">
            <span
              className="text-xs uppercase tracking-wider block mb-2"
              style={{ color: "rgba(240, 234, 214, 0.40)" }}
            >
              Last Capture
            </span>
            <img
              src={lastFrame}
              alt="Last screen capture"
              className="w-full rounded"
              style={{
                border: "1px solid rgba(199, 159, 74, 0.08)",
                maxHeight: "200px",
                objectFit: "cover",
              }}
            />
          </div>
        )}

        {/* Footer note */}
        <p
          className="text-center text-xs"
          style={{ color: "rgba(240, 234, 214, 0.25)" }}
        >
          Screen data is stored for 24 hours and used to enrich Harper&apos;s
          context.
        </p>
      </div>
    </div>
  );
};
