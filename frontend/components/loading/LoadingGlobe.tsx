import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import * as THREE from "three";
import { readLoadingThemeColors } from "./loading-globe-config";
import {
  type ActiveShot,
  addDitherAndGrid,
  disposeObject,
  disposeShots,
  loadCountries,
  makeGlobeBody,
  spawnShot,
  updateShots,
} from "./loading-globe-scene";

export type LoadingGlobePhase = "idle" | "auth" | "ready";

interface LoadingGlobeProps {
  phase?: LoadingGlobePhase;
  className?: string;
  style?: CSSProperties;
  density?: number;
}

export function LoadingGlobe({
  phase = "idle",
  className,
  style,
  density = 1,
}: LoadingGlobeProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef<LoadingGlobePhase>(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const mount = host;

    const colors = readLoadingThemeColors();
    const primaryColor = new THREE.Color(colors.primary);
    const bgColor = new THREE.Color(colors.bg);
    const starGold = new THREE.Color("#d3ad52").lerp(primaryColor, 0.34);
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.imageRendering = "pixelated";
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0, 0, 4.3);

    const globe = new THREE.Group();
    const countryFillLayer = new THREE.Group();
    const countryLayer = new THREE.Group();
    const shotLayer = new THREE.Group();
    const activeShots: ActiveShot[] = [];
    scene.add(globe);
    globe.add(
      makeGlobeBody(bgColor),
      countryFillLayer,
      countryLayer,
      shotLayer,
    );
    addDitherAndGrid({ globe, scene, primaryColor, starGold, density });

    const successRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.006, 8, 160),
      new THREE.MeshBasicMaterial({
        color: primaryColor,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      }),
    );
    scene.add(successRing);

    const state = {
      speed: 1,
      start: performance.now(),
      previous: performance.now(),
      nextShot: 0,
      authPulse: phaseRef.current === "auth" ? 1 : 0,
      authUntil: phaseRef.current === "auth" ? 1.35 : 0,
      lastPhase: phaseRef.current,
    };

    let frame = 0;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    loadCountries({
      countryLayer,
      countryFillLayer,
      primaryColor,
      isDisposed: () => disposed,
    });

    function resize() {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    function animate(now: number) {
      const elapsed = (now - state.start) / 1000;
      const delta = Math.min(0.05, (now - state.previous) / 1000);
      state.previous = now;
      syncPhase(state, phaseRef.current, elapsed);

      if (elapsed > state.nextShot && phaseRef.current !== "ready") {
        spawnShot(shotLayer, activeShots, primaryColor);
        state.nextShot = elapsed + 2.1 + Math.random() * 2.1;
      }

      updateShots(activeShots, delta, shotLayer);
      const starPulse = getStarPulse(elapsed);
      updateNamedObject(scene, "starfield", (object) => {
        const material = (object as THREE.Points)
          .material as THREE.PointsMaterial;
        material.opacity = 0.065 + starPulse * 0.105;
        material.size = 0.011 + starPulse * 0.004;
        object.rotation.z += 0.00008 * delta * 60;
      });

      const targetSpeed = targetSpeedForPhase(
        phaseRef.current,
        elapsed,
        state.authUntil,
      );
      state.speed += (targetSpeed - state.speed) * 0.055;
      state.authPulse = Math.max(0, state.authPulse - 0.018 * delta * 60);
      globe.rotation.y += 0.0028 * state.speed * delta * 60;
      globe.rotation.x = Math.sin(elapsed * 0.35) * 0.045;
      successRing.material.opacity = state.authPulse * 0.42;
      successRing.scale.setScalar(1 + (1 - state.authPulse) * 0.16);
      camera.position.z +=
        ((phaseRef.current === "ready" ? 2.05 : 4.3) - camera.position.z) *
        0.028;

      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(animate);
    }

    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    frame = window.requestAnimationFrame(animate);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      disposeShots(activeShots, shotLayer);
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [density]);

  return (
    <div
      ref={hostRef}
      className={className}
      aria-hidden="true"
      style={{ position: "relative", overflow: "hidden", ...style }}
    />
  );
}

function syncPhase(
  state: { lastPhase: LoadingGlobePhase; authPulse: number; authUntil: number },
  phase: LoadingGlobePhase,
  elapsed: number,
) {
  if (phase === state.lastPhase) return;
  state.lastPhase = phase;
  if (phase !== "auth") return;
  state.authPulse = 1;
  state.authUntil = elapsed + 1.35;
}

function targetSpeedForPhase(
  phase: LoadingGlobePhase,
  elapsed: number,
  authUntil: number,
) {
  if (phase === "ready") return 1.6;
  if (phase === "auth" && elapsed < authUntil) return 2;
  return 1;
}

function getStarPulse(elapsed: number) {
  const phase = (elapsed % 7.5) / 7.5;
  return phase < 0.2 ? Math.sin((phase / 0.2) * Math.PI) : 0;
}

function updateNamedObject(
  scene: THREE.Scene,
  name: string,
  update: (object: THREE.Object3D) => void,
) {
  const object = scene.getObjectByName(name);
  if (object) update(object);
}
