import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import {
  type ActiveShot,
  addDitherAndGrid,
  disposeObject,
  disposeShots,
  loadCountries,
  makeGlobeBody,
  spawnShot,
  updateShots,
} from "../../components/loading/loading-globe-scene";

function canUseWebGL() {
  try {
    const test = document.createElement("canvas");
    return Boolean(test.getContext("webgl2") || test.getContext("webgl"));
  } catch {
    return false;
  }
}

export function setupGlobeHero(host: HTMLElement) {
  if (!canUseWebGL()) return;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.imageRendering = "pixelated";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  camera.position.set(0, 0, 4.5);

  const primaryColor = new THREE.Color("#c79f4a");
  const bgColor = new THREE.Color("#050402");
  const starGold = new THREE.Color("#d3ad52").lerp(primaryColor, 0.34);
  const globe = new THREE.Group();
  const countryFillLayer = new THREE.Group();
  const countryLayer = new THREE.Group();
  const shotLayer = new THREE.Group();
  const activeShots: ActiveShot[] = [];
  const pointLight = new THREE.PointLight(0xa6d6e5, 2.4, 8);

  scene.add(globe, pointLight, new THREE.AmbientLight(0xc79f4a, 0.32));
  globe.add(makeGlobeBody(bgColor), countryFillLayer, countryLayer, shotLayer);
  addDitherAndGrid({
    globe,
    scene,
    primaryColor,
    starGold,
    density: 0.82,
  });

  const glowCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.74, 32, 16),
    new THREE.MeshStandardMaterial({
      color: 0x050402,
      emissive: 0x0a3136,
      emissiveIntensity: 0.52,
      transparent: true,
      opacity: 0.24,
      roughness: 0.5,
    }),
  );
  glowCore.renderOrder = -2;
  globe.add(glowCore);

  let raf = 0;
  let disposed = false;
  let previous = performance.now();
  let nextShot = 0;
  let targetSpeed = 1;
  let dragging = false;
  let lastX = 0;

  loadCountries({
    countryLayer,
    countryFillLayer,
    primaryColor,
    isDisposed: () => disposed,
  });

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate(now: number) {
    const delta = Math.min(0.05, (now - previous) / 1000);
    previous = now;
    const elapsed = now / 1000;

    if (elapsed > nextShot) {
      spawnShot(shotLayer, activeShots, primaryColor);
      nextShot = elapsed + 1.8 + Math.random() * 2.2;
    }
    updateShots(activeShots, delta, shotLayer);
    globe.rotation.y += 0.0026 * targetSpeed * delta * 60;
    globe.rotation.x = Math.sin(elapsed * 0.35) * 0.05;
    renderer.render(scene, camera);
    raf = window.requestAnimationFrame(animate);
  }

  host.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastX = event.clientX;
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    const delta = event.clientX - lastX;
    lastX = event.clientX;
    globe.rotation.y += delta * 0.012;
  });
  host.addEventListener("pointerup", (event) => {
    dragging = false;
    host.releasePointerCapture(event.pointerId);
  });

  resize();
  raf = window.requestAnimationFrame(animate);
  window.addEventListener("resize", resize, { passive: true });
  ScrollTrigger.create({
    trigger: ".waitlist",
    start: "top 80%",
    end: "bottom top",
    scrub: true,
    onUpdate: (self) => {
      targetSpeed = 0.9 + self.progress * 4.8;
      pointLight.intensity = 2.2 + self.progress * 5.6;
      pointLight.position.set(1.4 - self.progress * 2.8, 1.1, 2.8);
    },
  });

  window.addEventListener(
    "pagehide",
    () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      disposeShots(activeShots, shotLayer);
      disposeObject(scene);
      renderer.dispose();
    },
    { once: true },
  );
}
