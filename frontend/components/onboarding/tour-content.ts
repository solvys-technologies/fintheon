export const TOUR_STORAGE_KEY = "fintheon:tour-completed";
export const LAST_VERSION_KEY = "fintheon:last-seen-version";
export const CURRENT_VERSION = "8.20.3";

export interface TourStep {
  title: string;
  description: string;
  nav: string | null;
  selector: string;
  position: "top" | "bottom" | "left" | "right";
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Desk",
    description:
      "Briefing, Desk Plan, Risk Signals, and Sprint Map in one work surface.",
    nav: "dashboard",
    selector: 'button[data-tour-target="dashboard"]',
    position: "right",
  },
  {
    title: "Consilium",
    description:
      "Where your AI agents debate, analyze, and surface desk reads.",
    nav: "analysis",
    selector: 'button[data-tour-target="analysis"]',
    position: "right",
  },
  {
    title: "Chat",
    description:
      "Talk directly to Hermes. Ask questions, run reports, get briefs.",
    nav: "analysis",
    selector: 'button[data-tour-target="analysis"]',
    position: "right",
  },
  {
    title: "Boardroom",
    description:
      "The agent discussion room. Watch Oracle, Feucht, and Herald deliberate.",
    nav: "analysis",
    selector: 'button[data-tour-target="analysis"]',
    position: "right",
  },
  {
    title: "Desk Plans",
    description: "Upcoming desk plans, ordered as a live feed.",
    nav: "proposals",
    selector: '[data-tour-target="desk-rail"]',
    position: "right",
  },
  {
    title: "Desk Signals",
    description: "Risk Signals from Forum, folded into the Desk rail.",
    nav: "proposals",
    selector: '[data-tour-target="desk-rail"]',
    position: "right",
  },
  {
    title: "Narratives",
    description: "Map market narratives. Drag catalysts, draw connections.",
    nav: "narrative",
    selector: 'button[data-tour-target="narrative"]',
    position: "right",
  },
  {
    title: "Apparatus",
    description:
      "Agent intelligence. See what your agents know and when they work.",
    nav: "apparatus",
    selector: 'button[data-tour-target="apparatus"]',
    position: "right",
  },
  {
    title: "Strategium",
    description: "Mission Control: ER, account tracking, regime detection.",
    nav: "dashboard",
    selector: '[data-tour-target="strategium"]',
    position: "left",
  },
  {
    title: "RiskFlow",
    description: "Real-time market feed. News, prints, and trade ideas.",
    nav: "riskflow",
    selector: 'button[data-tour-target="riskflow"]',
    position: "right",
  },
  {
    title: "Toolbar",
    description: "VIX, IV scoring, platform controls, and layout options.",
    nav: null,
    selector: '[data-tour-target="toolbar"]',
    position: "bottom",
  },
];

export const WHATS_NEW_ITEMS = [
  "Contextual walkthrough tour with 11-step guided overview",
  "Consilium - AI agents debate trades and surface desk plans",
  "Apparatus - agent memory, reasoning, and schedule visibility",
  "Narrative Map canvas with AgentDesk integration",
  "Blindspots interview - personalized trader profile setup",
  "Setup wizard for backend dependency checks",
];
