import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";

gsap.registerPlugin(ScrollTrigger);

const nav = document.querySelector("[data-nav]");
const form = document.querySelector<HTMLFormElement>(".beta-gate");
const emailInput = form?.querySelector<HTMLInputElement>("input");

function handleScroll() {
  if (!nav) return;
  nav.classList.toggle("is-scrolled", window.scrollY > 80);
}

function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  if (!form || !emailInput) return;

  const address = emailInput.value.trim();
  const button = form.querySelector("button");
  if (!button) return;

  if (!address || !address.includes("@")) {
    button.textContent = "Enter email";
    window.setTimeout(() => {
      button.textContent = "Request access";
    }, 1400);
    return;
  }

  button.textContent = "Request received";
  emailInput.value = "";
}

function setupStoryMotion() {
  const beats = gsap.utils.toArray<HTMLElement>("[data-story-beat]");
  beats.forEach((beat) => {
    gsap.fromTo(
      beat,
      { opacity: 0.36, y: 22 },
      {
        opacity: 1,
        y: 0,
        ease: "power3.out",
        scrollTrigger: {
          trigger: beat,
          start: "top 76%",
          end: "bottom 46%",
          scrub: true,
        },
      },
    );
  });

  gsap.fromTo(
    ".mockup-shell",
    { y: 42, opacity: 0.78 },
    {
      y: 0,
      opacity: 1,
      ease: "power4.out",
      scrollTrigger: {
        trigger: ".mockup-showcase",
        start: "top 82%",
        end: "top 18%",
        scrub: true,
      },
    },
  );
}

function setupAgentReveal() {
  const section = document.querySelector<HTMLElement>("[data-agent-section]");
  if (!section) return;
  const agentSection = section;

  const steps = gsap.utils.toArray<HTMLElement>("[data-agent-step]");
  const bgLayers = gsap.utils.toArray<HTMLElement>("[data-agent-bg]");
  const introCopy =
    agentSection.querySelector<HTMLElement>(".agent-reveal-copy");
  const activeNumber = document.querySelector<HTMLElement>(
    "[data-agent-active]",
  );
  if (!steps.length || bgLayers.length < 2) return;

  const images = steps.map((step) => step.dataset.bg).filter(Boolean);
  let visibleLayer = 0;
  let currentImage = -1;

  function setBackground(index: number) {
    if (index === currentImage) return;
    currentImage = index;
    visibleLayer = 1 - visibleLayer;

    const next = bgLayers[visibleLayer];
    const previous = bgLayers[1 - visibleLayer];
    next.style.backgroundImage = `url("${images[index] ?? images[0]}")`;
    next.classList.add("is-active");
    previous.classList.remove("is-active");
  }

  function render(rawProgress: number) {
    const maxIndex = steps.length - 1;
    const activeIndex = Math.max(
      0,
      Math.min(maxIndex, Math.round(rawProgress)),
    );
    const settledProgress = activeIndex;
    const lightX = 35 + (activeIndex / maxIndex) * 38;
    const lightY = 38 + Math.sin(settledProgress * Math.PI) * 18;
    const introFade = Math.max(0, 1 - rawProgress / 0.72);

    agentSection.style.setProperty("--agent-light-x", `${lightX}%`);
    agentSection.style.setProperty("--agent-light-y", `${lightY}%`);
    if (introCopy) {
      introCopy.style.opacity = String(introFade);
      introCopy.style.transform = `translate3d(0, ${-28 * (1 - introFade)}px, 0)`;
      introCopy.style.pointerEvents = introFade > 0.08 ? "auto" : "none";
    }
    activeNumber?.replaceChildren(
      document.createTextNode(String(activeIndex + 1).padStart(2, "0")),
    );
    setBackground(activeIndex);

    steps.forEach((step, index) => {
      const offset = index - settledProgress;
      const distance = Math.abs(offset);
      const active = index === activeIndex;
      const nearGhost = distance === 1;
      const opacity = active ? 1 : nearGhost ? 0.075 : 0.018;
      const scale = active ? 1 : nearGhost ? 0.9 : 0.84;
      const blur = active ? 0 : nearGhost ? 0.65 : 1.2;
      const bodyOpacity = active ? 1 : 0;

      step.classList.toggle("is-active", active);
      step.style.opacity = String(opacity);
      step.style.setProperty("--ghost-blur", `${blur}px`);
      step.style.setProperty("--copy-opacity", active ? "1" : "0.72");
      step.style.setProperty("--body-opacity", String(bodyOpacity));
      step.style.transform = `translate3d(0, calc(-50% + ${offset * 330}px), 0) scale(${scale})`;
      step.style.pointerEvents = active ? "auto" : "none";
    });
  }

  bgLayers[0].style.backgroundImage = `url("${images[0]}")`;
  render(0);

  ScrollTrigger.create({
    trigger: agentSection,
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    snap: {
      snapTo: 1 / (steps.length - 1),
      duration: { min: 0.16, max: 0.34 },
      delay: 0.03,
      ease: "power3.out",
    },
    onUpdate: (self) => render(self.progress * (steps.length - 1)),
  });
}

function setupDataWall(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;
  const context = ctx;

  const glyphs = "01@$#Sx+-=·";
  const streams: { x: number; y: number; speed: number; length: number }[] = [];
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
    const count = Math.floor(width / 14);
    for (let i = 0; i < count; i += 1) {
      streams.push({
        x: i * 14,
        y: Math.random() * height,
        speed: 0.4 + Math.random() * 1.7,
        length: 5 + Math.floor(Math.random() * 18),
      });
    }
  }

  function draw() {
    context.fillStyle = "rgba(3, 3, 3, 0.19)";
    context.fillRect(0, 0, width, height);
    context.font = "12px Space Mono, monospace";
    context.textBaseline = "top";

    streams.forEach((stream) => {
      for (let i = 0; i < stream.length; i += 1) {
        const alpha = 1 - i / stream.length;
        context.fillStyle =
          i === 0
            ? `rgba(166, 214, 229, ${alpha * 0.52})`
            : `rgba(199, 159, 74, ${alpha * 0.26})`;
        const glyph = glyphs[(Math.random() * glyphs.length) | 0];
        context.fillText(glyph, stream.x, stream.y - i * 18);
      }

      stream.y += stream.speed;
      if (stream.y - stream.length * 18 > height) {
        stream.y = -Math.random() * height * 0.4;
      }
    });

    raf = window.requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener("resize", resize, { passive: true });
  ScrollTrigger.create({
    trigger: ".silence-section",
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (self) => {
      canvas.style.opacity = String(0.48 + self.progress * 0.34);
    },
  });

  window.addEventListener("pagehide", () => window.cancelAnimationFrame(raf), {
    once: true,
  });
}

function canUseWebGL() {
  try {
    const test = document.createElement("canvas");
    return Boolean(test.getContext("webgl2") || test.getContext("webgl"));
  } catch {
    return false;
  }
}

function setupProductObject(host: HTMLElement) {
  if (!canUseWebGL()) return;

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
  camera.position.set(0, 0, 5.4);

  const group = new THREE.Group();
  group.position.y = 0.82;
  scene.add(group);

  const pointLight = new THREE.PointLight(0xa6d6e5, 4.2, 9);
  pointLight.position.set(1.2, 1.1, 2.7);
  scene.add(pointLight, new THREE.AmbientLight(0xc79f4a, 0.55));

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.72, 2),
    new THREE.MeshStandardMaterial({
      color: 0x071014,
      emissive: 0x0a3440,
      emissiveIntensity: 0.72,
      metalness: 0.78,
      roughness: 0.34,
    }),
  );
  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.76, 2),
    new THREE.MeshBasicMaterial({
      color: 0xc79f4a,
      transparent: true,
      opacity: 0.56,
      wireframe: true,
      blending: THREE.AdditiveBlending,
    }),
  );
  group.add(core, wire);

  for (let i = 0; i < 22; i += 1) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.9 + i * 0.19, 0.0028, 4, 128),
      new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0xa6d6e5 : 0xc79f4a,
        transparent: true,
        opacity: Math.max(0.04, 0.24 - i * 0.007),
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.position.z = -i * 0.22;
    ring.position.y = 0.82;
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);
  }

  let width = 1;
  let height = 1;
  let raf = 0;
  let dragging = false;
  let lastX = 0;
  let targetSpin = 0.003;

  function resize() {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.floor(rect.width));
    height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    group.rotation.y += targetSpin;
    group.rotation.x = Math.sin(performance.now() * 0.0007) * 0.16;
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
    group.rotation.y += delta * 0.012;
  });
  host.addEventListener("pointerup", (event) => {
    dragging = false;
    host.releasePointerCapture(event.pointerId);
  });

  resize();
  animate();
  window.addEventListener("resize", resize, { passive: true });
  ScrollTrigger.create({
    trigger: ".waitlist",
    start: "top 78%",
    end: "bottom top",
    scrub: true,
    onUpdate: (self) => {
      targetSpin = 0.002 + self.progress * 0.018;
      pointLight.intensity = 3.4 + self.progress * 4.8;
      pointLight.position.x = 1.2 - self.progress * 2.4;
    },
  });

  window.addEventListener("pagehide", () => window.cancelAnimationFrame(raf), {
    once: true,
  });
}

window.addEventListener("scroll", handleScroll, { passive: true });
form?.addEventListener("submit", handleSubmit);
handleScroll();
setupStoryMotion();
setupAgentReveal();

const dataWall = document.querySelector<HTMLCanvasElement>("[data-data-wall]");
if (dataWall) setupDataWall(dataWall);

const productObject = document.querySelector<HTMLElement>(
  "[data-product-object]",
);
if (productObject) setupProductObject(productObject);
