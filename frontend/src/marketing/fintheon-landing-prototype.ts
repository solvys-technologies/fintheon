import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  getApiBase,
  setupCatalystCounter,
  setupRiskSignalCounter,
} from "./fintheon-catalyst-counter";
import { setupDataWall } from "./fintheon-data-wall";
import { setupGlobeHero } from "./fintheon-globe-hero";

gsap.registerPlugin(ScrollTrigger);

const nav = document.querySelector("[data-nav]");
const form = document.querySelector<HTMLFormElement>(".beta-gate");
const emailInput = form?.querySelector<HTMLInputElement>("input");
const waitlistStatus = form?.querySelector<HTMLElement>(
  "[data-waitlist-status]",
);

function handleScroll() {
  if (!nav) return;
  nav.classList.toggle("is-scrolled", window.scrollY > 80);
}

function setWaitlistStatus(
  message: string,
  state: "idle" | "success" | "error",
) {
  if (!waitlistStatus) return;
  waitlistStatus.textContent = message;
  waitlistStatus.classList.toggle("is-success", state === "success");
  waitlistStatus.classList.toggle("is-error", state === "error");
}

async function handleSubmit(event: SubmitEvent) {
  event.preventDefault();
  if (!form || !emailInput) return;

  const address = emailInput.value.trim();
  const button = form.querySelector("button");
  if (!button) return;

  if (!address || !address.includes("@")) {
    button.textContent = "Enter email";
    setWaitlistStatus(
      "Use the email where the beta invite should land.",
      "error",
    );
    window.setTimeout(() => {
      button.textContent = "Request access";
    }, 1400);
    return;
  }

  button.disabled = true;
  button.textContent = "Requesting...";
  setWaitlistStatus("Sending the request to Priced In Research.", "idle");

  try {
    const response = await fetch(`${getApiBase()}/api/marketing/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: address,
        source: "fintheon-landing",
        pageUrl: window.location.href,
        referrer: document.referrer || null,
      }),
    });

    if (!response.ok)
      throw new Error(`Waitlist request failed: ${response.status}`);

    button.textContent = "Request received";
    setWaitlistStatus(
      "You are on the beta list. We will reply from Priced In Research.",
      "success",
    );
    emailInput.value = "";
  } catch {
    button.textContent = "Try again";
    setWaitlistStatus(
      "The form endpoint did not accept the request. Email contact@pricedinresearch.io if this persists.",
      "error",
    );
  } finally {
    button.disabled = false;
  }
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
  const circuit = agentSection.querySelector<HTMLElement>(".agent-circuit");
  const circuitPath = agentSection.querySelector<SVGPathElement>(
    "[data-circuit-active]",
  );
  const circuitNodes = gsap.utils.toArray<HTMLElement>("[data-circuit-node]");
  const compactQuery = window.matchMedia("(max-width: 820px)");
  const activeNumber = document.querySelector<HTMLElement>(
    "[data-agent-active]",
  );
  if (!steps.length || bgLayers.length < 2) return;

  const images = steps.map((step) => step.dataset.bg).filter(Boolean);
  const circuitLength = circuitPath?.getTotalLength() ?? 1;
  let visibleLayer = 0;
  let currentImage = -1;
  let lastProgress = 0;

  circuit?.style.setProperty("--circuit-length", `${circuitLength}`);

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
    lastProgress = rawProgress;
    const maxIndex = steps.length - 1;
    const smoothProgress = Math.max(0, Math.min(1, rawProgress / maxIndex));
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
    circuit?.style.setProperty("--circuit-progress", `${smoothProgress}`);
    if (circuitPath) {
      const sparkPoint = circuitPath.getPointAtLength(
        circuitLength * smoothProgress,
      );
      circuit?.style.setProperty("--spark-x", `${(sparkPoint.x / 160) * 100}%`);
      circuit?.style.setProperty("--spark-y", `${(sparkPoint.y / 520) * 100}%`);
    }
    if (introCopy) {
      if (compactQuery.matches) {
        introCopy.style.opacity = "1";
        introCopy.style.transform = "none";
        introCopy.style.pointerEvents = "auto";
      } else {
        introCopy.style.opacity = String(introFade);
        introCopy.style.transform = `translate3d(0, ${-28 * (1 - introFade)}px, 0)`;
        introCopy.style.pointerEvents = introFade > 0.08 ? "auto" : "none";
      }
    }
    activeNumber?.replaceChildren(
      document.createTextNode(String(activeIndex + 1).padStart(2, "0")),
    );
    setBackground(activeIndex);
    circuitNodes.forEach((node, index) => {
      node.classList.toggle("is-active", index === activeIndex);
      node.classList.toggle("is-complete", index < activeIndex);
    });

    steps.forEach((step, index) => {
      const offset = index - settledProgress;
      const distance = Math.abs(offset);
      const active = index === activeIndex;
      const compact = compactQuery.matches;
      const nearGhost = distance === 1;
      const opacity = compact
        ? active
          ? 1
          : nearGhost
            ? 0.54
            : 0.32
        : active
          ? 1
          : nearGhost
            ? 0.075
            : 0.018;
      const scale = compact ? 1 : active ? 1 : nearGhost ? 0.9 : 0.84;
      const blur = compact ? 0 : active ? 0 : nearGhost ? 0.65 : 1.2;
      const bodyOpacity = compact ? (active ? 1 : 0.58) : active ? 1 : 0;

      step.classList.toggle("is-active", active);
      step.style.opacity = String(opacity);
      step.style.setProperty("--ghost-blur", `${blur}px`);
      step.style.setProperty("--copy-opacity", active ? "1" : "0.72");
      step.style.setProperty("--body-opacity", String(bodyOpacity));
      step.style.transform = compact
        ? `translate3d(0, 0, 0) scale(${scale})`
        : `translate3d(0, calc(-50% + ${offset * 330}px), 0) scale(${scale})`;
      step.style.pointerEvents = compact || active ? "auto" : "none";
    });
  }

  bgLayers[0].style.backgroundImage = `url("${images[0]}")`;
  render(0);

  const trigger = ScrollTrigger.create({
    trigger: agentSection,
    start: () => (compactQuery.matches ? "top 78%" : "top top"),
    end: () => (compactQuery.matches ? "bottom 28%" : "bottom bottom"),
    scrub: compactQuery.matches ? 0.45 : true,
    invalidateOnRefresh: true,
    onUpdate: (self) => render(self.progress * (steps.length - 1)),
  });
  compactQuery.addEventListener("change", () => {
    trigger.refresh();
    render(lastProgress);
  });
}

function setupFaqTransitions() {
  const items = gsap.utils.toArray<HTMLDetailsElement>(".faq-list details");
  if (!items.length) return;

  const transitionMs = 300;

  function setBodyHeight(detail: HTMLDetailsElement) {
    const body = detail.querySelector<HTMLElement>("p");
    if (!body) return;
    detail.style.setProperty("--faq-body-height", `${body.scrollHeight}px`);
  }

  items.forEach((detail) => {
    const summary = detail.querySelector("summary");
    if (!summary) return;

    let isAnimating = false;

    if (detail.open) {
      detail.classList.add("is-open");
      setBodyHeight(detail);
    }

    function openDetail() {
      isAnimating = true;
      detail.open = true;
      detail.classList.remove("is-closing");
      detail.classList.add("is-opening");
      setBodyHeight(detail);

      window.requestAnimationFrame(() => {
        detail.classList.add("is-open");
        window.setTimeout(() => {
          detail.classList.remove("is-opening");
          setBodyHeight(detail);
          isAnimating = false;
        }, transitionMs);
      });
    }

    function closeDetail() {
      isAnimating = true;
      setBodyHeight(detail);
      detail.classList.remove("is-opening");
      detail.classList.add("is-closing");

      window.requestAnimationFrame(() => {
        detail.classList.remove("is-open");
        window.setTimeout(() => {
          detail.open = false;
          detail.classList.remove("is-closing");
          detail.style.removeProperty("--faq-body-height");
          isAnimating = false;
        }, transitionMs);
      });
    }

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      if (isAnimating) return;

      if (detail.open) {
        closeDetail();
      } else {
        openDetail();
      }
    });
  });

  window.addEventListener("resize", () => {
    items.forEach((detail) => {
      if (detail.open) setBodyHeight(detail);
    });
  });
}

window.addEventListener("scroll", handleScroll, { passive: true });
form?.addEventListener("submit", handleSubmit);
handleScroll();
setupStoryMotion();
setupAgentReveal();
setupFaqTransitions();

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

const riskSignalCounter = document.querySelector<HTMLElement>(
  "[data-risk-signal-count]",
);
if (riskSignalCounter) setupRiskSignalCounter(riskSignalCounter);
