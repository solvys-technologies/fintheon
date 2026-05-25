// [claude-code 2026-04-10] Extracted from ConsiliumHub.tsx
import {
  Clock,
  GitBranch,
  MessageCircle,
  Stadium,
  Brain,
  BookOpen,
  Moon,
  Users,
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
  icon: typeof MessageCircle;
}[] = [{ id: "chat", label: "Chat", icon: MessageCircle }];

// Icon broadened to include the custom ArbitrumGlyph alongside lucide types — both
// expose a {size, className} prop API so callers can render uniformly.
type SubViewIcon = typeof GitBranch | typeof ArbitrumGlyph;
type LucideIcon = typeof MessageCircle;

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
  icon: LucideIcon;
}[] = [
  {
    id: "forum",
    label: "Forum",
    subtitle: "ProxVoice floor",
    icon: Stadium,
  },
  {
    id: "agentic-chat",
    label: "Agentic Forum",
    subtitle: "Chat with Hermes & CAO",
    icon: Stadium,
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
  icon: LucideIcon;
}[] = [
  {
    id: "desk",
    label: "Desk",
    subtitle: "Agent dossiers & monitoring",
    icon: Users,
  },
  {
    id: "fileroom",
    label: "File Room",
    subtitle: "Docs, memos, uploads",
    icon: Brain,
  },
  {
    id: "lounge",
    label: "Agent Lounge",
    subtitle: "Agents and their thoughts",
    icon: Moon,
  },
];
