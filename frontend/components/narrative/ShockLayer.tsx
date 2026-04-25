// [claude-code 2026-04-24] S36 ClusterBeam — SVG overlay that fires a moving gold dot from a
// cluster node to its narrative hub (or reverse for shock-on-arrival) whenever a
// narrative:shock CustomEvent is dispatched on window. Uses DOM `data-id` lookups so it
// stays compatible with whatever internal path React Flow uses for the rope, and drives
// the traveling dot via the Web Animations API so we don't depend on SVG-keyframe support.
import { useEffect, useRef } from "react";

interface ShockDetail {
  fromNodeId: string;
  toNodeId?: string;
  toSlug?: string;
  reverse?: boolean;
}

const DURATION_MS = 600;
const ACCENT = "#c79f4a";

function cssEscape(input: string): string {
  const css = (
    window as unknown as { CSS?: { escape?: (s: string) => string } }
  ).CSS;
  if (typeof css?.escape === "function") return css.escape(input);
  return input.replace(/([^\w-])/g, "\\$1");
}

function findNodeElement(nodeId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `.react-flow__node[data-id="${cssEscape(nodeId)}"]`,
  );
}

function findHubBySlug(slug: string): HTMLElement | null {
  const candidates = [`hub-${slug}`, `narrative-${slug}`, `lane-${slug}`, slug];
  for (const id of candidates) {
    const el = findNodeElement(id);
    if (el) return el;
  }
  const all = document.querySelectorAll<HTMLElement>(".react-flow__node");
  for (const el of Array.from(all)) {
    if ((el.dataset.slug ?? "") === slug) return el;
  }
  return null;
}

function centerOf(el: HTMLElement): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function flashAbsorb(el: HTMLElement): void {
  el.classList.add("hub-absorb-flash");
  window.setTimeout(() => el.classList.remove("hub-absorb-flash"), 700);
}

function spawnPulse(
  svg: SVGSVGElement,
  from: { x: number; y: number },
  to: { x: number; y: number },
): void {
  const ns = "http://www.w3.org/2000/svg";

  const trail = document.createElementNS(ns, "line");
  trail.setAttribute("x1", String(from.x));
  trail.setAttribute("y1", String(from.y));
  trail.setAttribute("x2", String(from.x));
  trail.setAttribute("y2", String(from.y));
  trail.setAttribute("stroke", ACCENT);
  trail.setAttribute("stroke-width", "1");
  trail.setAttribute("stroke-opacity", "0.35");
  svg.appendChild(trail);

  const dot = document.createElementNS(ns, "circle");
  dot.setAttribute("cx", String(from.x));
  dot.setAttribute("cy", String(from.y));
  dot.setAttribute("r", "3");
  dot.setAttribute("fill", ACCENT);
  dot.setAttribute("opacity", "0");
  svg.appendChild(dot);

  const easing = "cubic-bezier(0.4, 0, 0.2, 1)";

  const dotAnim = dot.animate(
    [
      { cx: from.x, cy: from.y, r: 3, opacity: 0 },
      { cx: from.x, cy: from.y, r: 4, opacity: 1, offset: 0.15 },
      { cx: to.x, cy: to.y, r: 4, opacity: 1, offset: 0.85 },
      { cx: to.x, cy: to.y, r: 3, opacity: 0 },
    ] as Keyframe[],
    { duration: DURATION_MS, easing, fill: "forwards" },
  );

  const trailAnim = trail.animate(
    [
      { x2: from.x, y2: from.y, opacity: 0.35 },
      { x2: to.x, y2: to.y, opacity: 0 },
    ] as Keyframe[],
    { duration: DURATION_MS, easing, fill: "forwards" },
  );

  const cleanup = () => {
    dot.remove();
    trail.remove();
  };
  dotAnim.addEventListener("finish", cleanup);
  dotAnim.addEventListener("cancel", cleanup);
  // Safety net in case WAAPI reports neither event on some edge cases
  window.setTimeout(cleanup, DURATION_MS + 200);
  void trailAnim;
}

export function ShockLayer() {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const onShock = (e: Event) => {
      const detail = (e as CustomEvent<ShockDetail>).detail;
      const svg = svgRef.current;
      if (!detail || !svg) return;
      const fromEl = findNodeElement(detail.fromNodeId);
      let toEl: HTMLElement | null = null;
      if (detail.toNodeId) toEl = findNodeElement(detail.toNodeId);
      if (!toEl && detail.toSlug) toEl = findHubBySlug(detail.toSlug);
      if (!fromEl || !toEl) return;

      const fromC = centerOf(fromEl);
      const toC = centerOf(toEl);
      const reverse = detail.reverse === true;
      const start = reverse ? toC : fromC;
      const end = reverse ? fromC : toC;

      spawnPulse(svg, start, end);

      window.setTimeout(() => {
        const target = reverse ? fromEl : toEl;
        if (target) flashAbsorb(target);
      }, DURATION_MS - 40);
    };
    window.addEventListener("narrative:shock", onShock as EventListener);
    return () =>
      window.removeEventListener("narrative:shock", onShock as EventListener);
  }, []);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 45,
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}
