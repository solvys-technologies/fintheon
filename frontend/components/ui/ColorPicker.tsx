// [claude-code 2026-03-24] Custom Fintheon color picker — dark popover with SV gradient, hue slider, hex input
import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";

// ── Color conversion utilities ──

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s,
    x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
    m = v - c;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

// ── Saturation/Value gradient canvas ──

function SatValCanvas({
  hue,
  sat,
  val,
  onChange,
  width = 220,
  height = 160,
}: {
  hue: number;
  sat: number;
  val: number;
  onChange: (s: number, v: number) => void;
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);

  const paint = useCallback(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    // Hue base fill
    ctx.fillStyle = hsvToHex(hue, 1, 1);
    ctx.fillRect(0, 0, width, height);
    // White gradient left→right
    const wg = ctx.createLinearGradient(0, 0, width, 0);
    wg.addColorStop(0, "#ffffff");
    wg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, width, height);
    // Black gradient top→bottom
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "rgba(0,0,0,0)");
    bg.addColorStop(1, "#000000");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }, [hue, width, height]);

  useEffect(() => {
    paint();
  }, [paint]);

  const pick = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      onChange(x, 1 - y);
    },
    [onChange],
  );

  useEffect(() => {
    const up = () => {
      dragging.current = false;
    };
    const move = (e: MouseEvent) => {
      if (dragging.current) pick(e);
    };
    window.addEventListener("mouseup", up);
    window.addEventListener("mousemove", move);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("mousemove", move);
    };
  }, [pick]);

  return (
    <div className="relative" style={{ width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="rounded-md cursor-crosshair"
        onMouseDown={(e) => {
          dragging.current = true;
          pick(e);
        }}
      />
      {/* Picker cursor */}
      <div
        className="absolute w-4 h-4 rounded-full border-2 border-white pointer-events-none"
        style={{
          left: `${sat * 100}%`,
          top: `${(1 - val) * 100}%`,
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 4px rgba(0,0,0,0.6)",
        }}
      />
    </div>
  );
}

// ── Hue slider ──

function HueSlider({
  hue,
  onChange,
}: {
  hue: number;
  onChange: (h: number) => void;
}) {
  return (
    <div
      className="relative h-3 rounded-full overflow-hidden cursor-pointer"
      style={{
        background:
          "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
      }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        onChange(
          Math.max(
            0,
            Math.min(359, ((e.clientX - rect.left) / rect.width) * 360),
          ),
        );
      }}
    >
      <div
        className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white pointer-events-none"
        style={{
          left: `${(hue / 360) * 100}%`,
          transform: "translate(-50%, -50%)",
          boxShadow: "0 0 4px rgba(0,0,0,0.5)",
          backgroundColor: hsvToHex(hue, 1, 1),
        }}
      />
    </div>
  );
}

// ── Main ColorPicker popover ──

interface ColorPickerProps {
  color: string; // Current hex color
  onChange: (hex: string) => void;
  label?: string;
  onClose?: () => void;
}

export function ColorPickerPopover({
  color,
  onChange,
  label,
  onClose,
}: ColorPickerProps) {
  const validColor = isValidHex(color) ? color : "#333333";
  const hsv = hexToHsv(validColor);
  const [hue, setHue] = useState(hsv.h);
  const [sat, setSat] = useState(hsv.s);
  const [val, setVal] = useState(hsv.v);
  const [hexDraft, setHexDraft] = useState(validColor);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync external color changes
  useEffect(() => {
    if (isValidHex(color)) {
      const h = hexToHsv(color);
      setHue(h.h);
      setSat(h.s);
      setVal(h.v);
      setHexDraft(color);
    }
  }, [color]);

  const emitColor = useCallback(
    (h: number, s: number, v: number) => {
      const hex = hsvToHex(h, s, v);
      setHexDraft(hex);
      onChange(hex);
    },
    [onChange],
  );

  const handleSatVal = useCallback(
    (s: number, v: number) => {
      setSat(s);
      setVal(v);
      emitColor(hue, s, v);
    },
    [hue, emitColor],
  );

  const handleHue = useCallback(
    (h: number) => {
      setHue(h);
      emitColor(h, sat, val);
    },
    [sat, val, emitColor],
  );

  const handleHexInput = (v: string) => {
    setHexDraft(v);
    if (isValidHex(v)) {
      const h = hexToHsv(v);
      setHue(h.h);
      setSat(h.s);
      setVal(h.v);
      onChange(v);
    }
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className="rounded-xl border border-[var(--fintheon-border)]/20 bg-[#0c0a06] shadow-2xl p-4 flex flex-col gap-3 z-50"
      style={{
        width: 252,
        boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 1px rgba(199,159,74,0.2)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-[var(--fintheon-text)]/70 uppercase tracking-wider">
          {label || "Color"}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="w-5 h-5 rounded flex items-center justify-center text-[var(--fintheon-muted)]/40 hover:text-[var(--fintheon-text)]/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Saturation / Value gradient */}
      <SatValCanvas hue={hue} sat={sat} val={val} onChange={handleSatVal} />

      {/* Hue slider */}
      <HueSlider hue={hue} onChange={handleHue} />

      {/* Hex input + preview swatch */}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-md border border-white/10 shrink-0"
          style={{ backgroundColor: hsvToHex(hue, sat, val) }}
        />
        <div className="flex-1 flex items-center gap-1 bg-[var(--fintheon-bg)]/60 rounded-md border border-[var(--fintheon-border)]/15 px-2 py-1.5">
          <span className="text-[10px] text-[var(--fintheon-muted)]/40 font-mono">
            #
          </span>
          <input
            type="text"
            value={hexDraft.replace("#", "")}
            onChange={(e) => handleHexInput(`#${e.target.value}`)}
            className="flex-1 bg-transparent text-[12px] text-[var(--fintheon-text)] font-mono outline-none uppercase"
            maxLength={6}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

// ── Trigger button: swatch that opens the picker inline ──

interface ColorSwatchInputProps {
  color: string;
  onChange: (hex: string) => void;
  label: string;
}

export function ColorSwatchInput({
  color,
  onChange,
  label,
}: ColorSwatchInputProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div
          className="w-8 h-8 rounded-md border border-white/10 shrink-0 transition-transform hover:scale-105"
          style={{ backgroundColor: isValidHex(color) ? color : "#333" }}
        />
        <div className="flex-1">
          <span className="text-[11px] text-[var(--fintheon-muted)]/60 uppercase tracking-wider block">
            {label}
          </span>
          <span className="text-[12px] font-mono text-[var(--fintheon-text)]/80">
            {color}
          </span>
        </div>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50">
          <ColorPickerPopover
            color={color}
            onChange={onChange}
            label={label}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
