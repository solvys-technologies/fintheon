// [claude-code 2026-04-20] Frontend iso-icons public API — iso overrides cast to LucideIcon for drop-in type compat
import type { LucideIcon } from "lucide-react";

export { IsoIcon, type IsoIconProps } from "./IsoIcon";

// Iso overrides — nav
import {
  IsoHome,
  IsoNewspaper,
  IsoMessageSquare,
  IsoSettings,
  IsoMenu,
  IsoBell,
} from "./nav";
export const LayoutDashboard = IsoHome as unknown as LucideIcon;
export const Newspaper = IsoNewspaper as unknown as LucideIcon;
export const MessageSquare = IsoMessageSquare as unknown as LucideIcon;
export const Settings = IsoSettings as unknown as LucideIcon;
export const Menu = IsoMenu as unknown as LucideIcon;
export const Bell = IsoBell as unknown as LucideIcon;

// Iso overrides — status
import {
  IsoZap,
  IsoCrosshair,
  IsoSun,
  IsoMoon,
  IsoCheckCircle2,
  IsoXCircle,
  IsoShieldCheck,
} from "./status";
export const Zap = IsoZap as unknown as LucideIcon;
export const Crosshair = IsoCrosshair as unknown as LucideIcon;
export const Sun = IsoSun as unknown as LucideIcon;
export const Moon = IsoMoon as unknown as LucideIcon;
export const CheckCircle2 = IsoCheckCircle2 as unknown as LucideIcon;
export const XCircle = IsoXCircle as unknown as LucideIcon;
export const ShieldCheck = IsoShieldCheck as unknown as LucideIcon;

// Iso overrides — content
import {
  IsoSearch,
  IsoPaperclip,
  IsoStickyNote,
  IsoClock,
  IsoCalendarDays,
  IsoTrash2,
  IsoRefreshCw,
  IsoExternalLink,
  IsoMessageCircle,
} from "./content";
export const Search = IsoSearch as unknown as LucideIcon;
export const Paperclip = IsoPaperclip as unknown as LucideIcon;
export const StickyNote = IsoStickyNote as unknown as LucideIcon;
export const Clock = IsoClock as unknown as LucideIcon;
export const CalendarDays = IsoCalendarDays as unknown as LucideIcon;
export const Trash2 = IsoTrash2 as unknown as LucideIcon;
export const RefreshCw = IsoRefreshCw as unknown as LucideIcon;
export const ExternalLink = IsoExternalLink as unknown as LucideIcon;
export const MessageCircle = IsoMessageCircle as unknown as LucideIcon;

// Iso overrides — glyphs
import {
  IsoCheck,
  IsoX,
  IsoPlus,
  IsoMinus,
  IsoChevronUp,
  IsoChevronDown,
  IsoChevronRight,
  IsoArrowUp,
  IsoArrowRight,
  IsoArrowUpRight,
} from "./glyphs";
export const Check = IsoCheck as unknown as LucideIcon;
export const X = IsoX as unknown as LucideIcon;
export const Plus = IsoPlus as unknown as LucideIcon;
export const Minus = IsoMinus as unknown as LucideIcon;
export const ChevronUp = IsoChevronUp as unknown as LucideIcon;
export const ChevronDown = IsoChevronDown as unknown as LucideIcon;
export const ChevronRight = IsoChevronRight as unknown as LucideIcon;
export const ArrowUp = IsoArrowUp as unknown as LucideIcon;
export const ArrowRight = IsoArrowRight as unknown as LucideIcon;
export const ArrowUpRight = IsoArrowUpRight as unknown as LucideIcon;

// Iso overrides — sidebar
import {
  IsoLogOut,
  IsoLandmark,
  IsoGripVertical,
  IsoChevronsLeft,
  IsoChevronsRight,
  IsoBookOpenCheck,
  IsoBellOff,
  IsoWrench,
} from "./sidebar";
export const LogOut = IsoLogOut as unknown as LucideIcon;
export const Landmark = IsoLandmark as unknown as LucideIcon;
export const GripVertical = IsoGripVertical as unknown as LucideIcon;
export const ChevronsLeft = IsoChevronsLeft as unknown as LucideIcon;
export const ChevronsRight = IsoChevronsRight as unknown as LucideIcon;
export const BookOpenCheck = IsoBookOpenCheck as unknown as LucideIcon;
export const BellOff = IsoBellOff as unknown as LucideIcon;
export const Wrench = IsoWrench as unknown as LucideIcon;

// Lucide fallthrough — every other icon name used across frontend, re-exported verbatim
// until proper iso variants are drawn.
export {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRightLeft,
  Award,
  BarChart3,
  BookOpen,
  Bookmark,
  Bot,
  Brain,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckCircle,
  ChevronLeft,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleOff,
  CircleX,
  ClipboardList,
  Cloud,
  Code,
  Compass,
  Copy,
  Cpu,
  CreditCard,
  Crown,
  Database,
  Diff,
  DollarSign,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileBarChart,
  FileText,
  Filter,
  Fish,
  Flame,
  FolderCog,
  GitBranch,
  Globe,
  Hand,
  Heart,
  Highlighter,
  History,
  Image,
  Inbox,
  Info,
  Layers,
  Layout,
  LineChart,
  Link,
  Link2,
  ListOrdered,
  Loader2,
  Lock,
  Mail,
  Map,
  Maximize2,
  Megaphone,
  Merge,
  Mic,
  MicOff,
  Minimize2,
  Monitor,
  MousePointer2,
  Move,
  MoveLeft,
  MoveRight,
  Palette,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  PenLine,
  Pencil,
  Phone,
  PhoneOff,
  PictureInPicture2,
  Play,
  Plug2,
  Power,
  Radio,
  RotateCcw,
  RotateCw,
  Rss,
  Save,
  Scroll,
  Send,
  Server,
  Settings2,
  Shield,
  ShieldAlert,
  ShieldX,
  SlidersHorizontal,
  Sparkles,
  SplitSquareVertical,
  Sprout,
  Square,
  SquareDashedMousePointer,
  Stethoscope,
  StopCircle,
  Tag,
  Target,
  Terminal,
  ThumbsDown,
  ToggleLeft,
  ToggleRight,
  TrendingDown,
  TrendingUp,
  Trophy,
  Twitter,
  Unplug,
  Upload,
  User,
  UserPlus,
  Users,
  Video,
  Volume2,
  VolumeOff,
  WifiOff,
  Youtube,
  type LucideIcon,
} from "lucide-react";
