import { ScrollTrigger } from "gsap/ScrollTrigger";

interface DataStream {
  x: number;
  y: number;
  speed: number;
  length: number;
  phase: number;
  scale: number;
}

const glyphs = "01@$#Sx+-=NQ8";

function randomGlyph() {
  return glyphs[(Math.random() * glyphs.length) | 0];
}

export function setupDataWall(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  const context = ctx;
  const streams: DataStream[] = [];
  let width = 0;
  let height = 0;
  let raf = 0;

  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    streams.length = 0;
    const count = Math.floor(width / 16);
    for (let i = 0; i < count; i += 1) {
      streams.push({
        x: i * 16 + Math.random() * 4,
        y: Math.random() * height,
        speed: 0.5 + Math.random() * 1.55,
        length: 6 + Math.floor(Math.random() * 22),
        phase: Math.random() * Math.PI * 2,
        scale: 0.82 + Math.random() * 0.34,
      });
    }
  }

  function drawLanes() {
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "#050402";
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(199, 159, 74, 0.025)";
    for (let x = 0; x < width; x += 16) {
      context.fillRect(x, 0, 1, height);
    }
  }

  function draw() {
    const now = performance.now();
    context.globalCompositeOperation = "source-over";
    context.fillStyle = "rgba(5, 4, 2, 0.34)";
    context.fillRect(0, 0, width, height);
    context.font = "12px Doto, JetBrains Mono, monospace";
    context.textBaseline = "top";
    context.globalCompositeOperation = "lighter";

    streams.forEach((stream) => {
      for (let i = 0; i < stream.length; i += 1) {
        const y = stream.y - i * 17 * stream.scale;
        const alpha = Math.max(0, 1 - i / stream.length);
        const shimmer = Math.max(
          0,
          Math.sin(now * 0.004 + stream.phase - i * 0.56),
        );
        const glow = i === 0 ? 0.58 + shimmer * 0.42 : 0.18 + shimmer * 0.42;
        const isCool = (i + Math.floor(stream.x)) % 4 === 0;

        context.fillStyle = isCool
          ? `rgba(166, 214, 229, ${alpha * glow * 0.62})`
          : `rgba(199, 159, 74, ${alpha * glow * 0.52})`;
        context.fillText(randomGlyph(), stream.x, y);

        if (shimmer > 0.94) {
          context.fillStyle = `rgba(240, 234, 214, ${alpha * 0.26})`;
          context.fillText(randomGlyph(), stream.x + 1, y);
        }
      }

      stream.y += stream.speed;
      if (stream.y - stream.length * 18 > height) {
        stream.y = -Math.random() * height * 0.35;
        stream.phase = Math.random() * Math.PI * 2;
      }
    });

    raf = window.requestAnimationFrame(draw);
  }

  resize();
  drawLanes();
  draw();
  window.addEventListener("resize", resize, { passive: true });
  ScrollTrigger.create({
    trigger: ".silence-section",
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      canvas.style.opacity = String(0.68 + self.progress * 0.2);
    },
  });

  window.addEventListener("pagehide", () => window.cancelAnimationFrame(raf), {
    once: true,
  });
}
