// [claude-code 2026-03-11] T3a: added mcpServers field to SkillDef and each skill entry
import {
  Globe,
  ShieldCheck,
  FileBarChart,
  GitBranch,
  Brain,
  Wrench,
  Activity,
  StopCircle,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

export interface SkillDef {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  description: string;
  keywords: string[];
  mcpServers?: string[];
}

export const SKILLS: readonly SkillDef[] = [
  {
    id: "brief",
    label: "Brief",
    icon: Globe,
    color: "#A78BFA",
    description: "Web search, summarize, and interpret for your instrument",
    keywords: ["brief", "search", "news", "summarize", "web"],
    mcpServers: ["exa"],
  },
  {
    id: "validate",
    label: "Validate",
    icon: ShieldCheck,
    color: "#F59E0B",
    description: "Risk validation against narratives, memos, and live news",
    keywords: ["validate", "risk", "check", "verify", "herald"],
    mcpServers: ["exa", "notion"],
  },
  {
    id: "report",
    label: "Report",
    icon: FileBarChart,
    color: "#60A5FA",
    description: "Generate HTML dashboard reports in app palette",
    keywords: ["report", "dashboard", "html", "chart"],
    mcpServers: ["exa", "fmp"],
  },
  {
    id: "track",
    label: "Track",
    icon: GitBranch,
    color: "#34D399",
    description: "Start a new narrative thread",
    keywords: ["track", "narrative", "thread", "thesis"],
    mcpServers: ["notion"],
  },
  {
    id: "psych_assist",
    label: "PsychAssist",
    icon: Brain,
    color: "#E879F9",
    description: "Psych analysis, performance review, trading activity",
    keywords: ["psych", "mental", "tilt", "emotion", "performance"],
    mcpServers: [],
  },
  {
    id: "maintenance",
    label: "Maintenance",
    icon: Wrench,
    color: "#9CA3AF",
    description: "Self-update app and changelog",
    keywords: ["maintenance", "update", "changelog", "fix"],
    mcpServers: [],
  },
  {
    id: "quick_fintheon",
    label: "QuickFintheon",
    icon: Activity,
    color: "var(--fintheon-accent)",
    description: "Chart screenshot analysis: bias, entries, stop, target",
    keywords: ["quick", "fintheon", "chart", "screenshot", "snap"],
    mcpServers: ["playwright"],
  },
  {
    id: "stop",
    label: "Stop",
    icon: StopCircle,
    color: "#EF4444",
    description: "Cancel the current run immediately",
    keywords: ["stop", "cancel", "abort", "halt"],
    mcpServers: [],
  },
  {
    id: "update_fintheon",
    label: "Update Fintheon",
    icon: RefreshCw,
    color: "#38BDF8",
    description: "Pull latest changes from repository and rebuild the app",
    keywords: ["update", "pull", "deploy", "rebuild", "upgrade"],
    mcpServers: [],
  },
] as const;

export type SkillId = (typeof SKILLS)[number]["id"];

export function filterSkills(query: string): SkillDef[] {
  if (!query) return [...SKILLS];
  const q = query.toLowerCase();
  return SKILLS.filter(
    (s) =>
      s.id.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.keywords.some((k) => k.includes(q)),
  );
}
