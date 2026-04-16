// [claude-code 2026-04-10] Extracted from ConsiliumHub.tsx
import {
  MessageSquare,
  Clock,
  GitBranch,
  Cpu,
  Users,
  Fish,
  Shield,
  Brain,
  BookOpen,
  Moon,
} from "lucide-react";

// Top-level tabs: Sanctum, Boardroom, Apparatus are dropdowns; Chat is a direct button
export type ConsiliumTab = "sanctum" | "chat" | "boardroom" | "apparatus";
export type SanctumSubView = "narratives" | "aquarium" | "timeline";
export type BoardroomSubView =
  | "forum"
  | "imperium"
  | "agentic-chat"
  | "research";
export type ApparatusSubView = "desk" | "fileroom";

// Chat is the only direct button now
export const REGULAR_TABS: {
  id: ConsiliumTab;
  label: string;
  icon: typeof MessageSquare;
}[] = [{ id: "chat", label: "Chat", icon: MessageSquare }];

export const SANCTUM_SUB_VIEWS: {
  id: SanctumSubView;
  label: string;
  subtitle?: string;
  icon: typeof GitBranch;
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
    id: "aquarium",
    label: "Aquarium",
    subtitle: "The Shark Tank. Deliberate it.",
    icon: Fish,
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
  {
    id: "imperium",
    label: "Agent Lounge",
    subtitle: "Agents and their thoughts",
    icon: Moon,
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
    subtitle: "AI-generated context bank",
    icon: Brain,
  },
];
