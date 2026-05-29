import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { setupCatalystCounter } from "./fintheon-catalyst-counter";
import { setupDataWall } from "./fintheon-data-wall";
import { setupGlobeHero } from "./fintheon-globe-hero";

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
        trigger: ".surface",
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
if (productObject) setupGlobeHero(productObject);

const catalystCounter = document.querySelector<HTMLElement>(
  "[data-catalyst-count]",
);
if (catalystCounter) setupCatalystCounter(catalystCounter);
