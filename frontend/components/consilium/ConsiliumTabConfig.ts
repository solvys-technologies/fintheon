// [claude-code 2026-04-10] Extracted from ConsiliumHub.tsx
// [claude-code 2026-04-25] S35: Arbitrum entry's icon swapped from Fish (lucide) to
//   ArbitrumGlyph — stacked +/- in Nothing Display font, matching the deliberation
//   semantics of the 5-seat chamber.
import {
  MessageSquare,
  Clock,
  GitBranch,
  Cpu,
  Users,
  Shield,
  Brain,
  BookOpen,
  Moon,
} from "lucide-react";
import { ArbitrumGlyph } from "../icons/ArbitrumGlyph";

// Top-level tabs: Sanctum, Boardroom, Apparatus are dropdowns; Chat is a direct button
export type ConsiliumTab = "sanctum" | "chat" | "boardroom" | "apparatus";
export type SanctumSubView = "narratives" | "arbitrumChamber" | "timeline";
export type BoardroomSubView = "forum" | "agentic-chat" | "research";
export type ApparatusSubView = "desk" | "fileroom" | "lounge";

// Chat is the only direct button now
export const REGULAR_TABS: {
  id: ConsiliumTab;
  label: string;
  icon: typeof MessageSquare;
}[] = [{ id: "chat", label: "Chat", icon: MessageSquare }];

// Icon broadened to include the custom ArbitrumGlyph alongside lucide types — both
// expose a {size, className} prop API so callers can render uniformly.
type SubViewIcon = typeof GitBranch | typeof ArbitrumGlyph;

export const SANCTUM_SUB_VIEWS: {
  id: SanctumSubView;
  label: string;
  subtitle?: string;
  icon: SubViewIcon;
}[] = [
  {
    id: "timeline",
    label: "Timeline",
    subtitle: "Track the catalysts",
    icon: Clock,
  },
  {
    id: "narratives",
    label: "NarrativeFlow",
    subtitle: "Visualize the situation",
    icon: GitBranch,
  },
  {
    id: "arbitrumChamber",
    label: "Arbitrum",
    subtitle: "Deliberate it.",
    icon: ArbitrumGlyph,
  },
];

export const BOARDROOM_SUB_VIEWS: {
  id: BoardroomSubView;
  label: string;
  subtitle?: string;
  icon: typeof MessageSquare;
}[] = [
  {
    id: "forum",
    label: "Forum",
    subtitle: "Community hub & voice",
    icon: MessageSquare,
  },
  {
    id: "agentic-chat",
    label: "Agentic Forum",
    subtitle: "Chat with Hermes & CAO",
    icon: Cpu,
  },
  {
    id: "research",
    label: "Research",
    subtitle: "Research knowledge base",
    icon: BookOpen,
  },
];

export const APPARATUS_SUB_VIEWS: {
  id: ApparatusSubView;
  label: string;
  subtitle?: string;
  icon: typeof Cpu;
}[] = [
  {
    id: "desk",
    label: "Desk",
    subtitle: "Agent dossiers & monitoring",
    icon: Users,
  },
  {
    id: "fileroom",
    label: "Fileroom",
    subtitle: "Agent soul card editor",
    icon: Brain,
  },
  {
    id: "lounge",
    label: "Agent Lounge",
    subtitle: "Agents and their thoughts",
    icon: Moon,
  },
];
