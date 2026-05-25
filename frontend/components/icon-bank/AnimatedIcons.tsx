// [codex 2026-05-23] Its Hover-inspired local icon facade. Vite aliases
// lucide-react here so app surfaces render the animated icon bank consistently.
import { forwardRef, type CSSProperties, type SVGProps } from "react";
import { DotMatrixLoader } from "./DotMatrixLoader";
import { EXACT_ICON_BODIES, type ExactIconKey } from "./iconifyBodies";

export interface HoverIconProps extends Omit<SVGProps<SVGSVGElement>, "color"> {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  absoluteStrokeWidth?: boolean;
}

type LegacyIconKey =
  | "activity" | "alert" | "arrow-down" | "arrow-left" | "arrow-right"
  | "arrow-up" | "at" | "atom" | "bank" | "bell" | "book" | "bookmark"
  | "bot" | "calendar" | "camera" | "chart" | "chart-candle" | "check"
  | "check-circle" | "chevron-down" | "chevron-left"
  | "chevron-right" | "chevron-up" | "circle" | "clock" | "cloud" | "code"
  | "copy" | "cpu" | "credit-card" | "cube-focus" | "dollar" | "download"
  | "eye" | "eye-off" | "file" | "filter" | "fingerprint" | "globe" | "grid"
  | "grip" | "heart" | "home" | "image" | "info" | "layers" | "link"
  | "lock" | "mail" | "menu" | "message" | "message-circle" | "mic" | "minus"
  | "moon" | "network" | "open-book" | "pause" | "phone" | "play" | "plug"
  | "plus" | "plus-minus-stack" | "power" | "radio" | "refresh" | "save"
  | "search" | "send" | "settings" | "share" | "shield" | "sliders"
  | "sparkles" | "square" | "stadium" | "target" | "trash" | "trend-down"
  | "trend-up" | "tv" | "upload" | "user" | "users" | "users-three" | "volume" | "volume-x"
  | "wrench" | "x" | "youtube" | "zap";
type IconKey = LegacyIconKey | ExactIconKey;

const PATHS: Record<LegacyIconKey, string[]> = {
  activity: ["M4 12h4l2-7 4 14 2-7h4"],
  alert: ["M12 3 22 20H2L12 3Z", "M12 9v4", "M12 17h.01"],
  "arrow-down": ["M12 5v14", "M16 15l-4 4", "M8 15l4 4"],
  "arrow-left": ["M19 12H5", "M9 8l-4 4", "M9 16l-4-4"],
  "arrow-right": ["M5 12h14", "M15 8l4 4", "M15 16l4-4"],
  "arrow-up": ["M12 19V5", "M16 9l-4-4", "M8 9l4-4"],
  at: ["M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
  atom: ["M12 12h.01", "M20.2 7.8c1.6 2.7-.6 7-5 9.6s-9.2 2.7-10.8 0 .6-7 5-9.6 9.2-2.7 10.8 0Z", "M3.8 7.8c1.6-2.7 6.4-2.6 10.8 0s6.6 6.9 5 9.6-6.4 2.6-10.8 0-6.6-6.9-5-9.6Z", "M12 3c3.2 0 5.8 4 5.8 9S15.2 21 12 21s-5.8-4-5.8-9S8.8 3 12 3Z"],
  bank: ["M3 10h18", "M5 10V8l7-4 7 4v2", "M6 10v9", "M10 10v9", "M14 10v9", "M18 10v9", "M4 19h16", "M2.5 22h19"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  book: ["M4 19.5A2.5 2.5 0 0 1 6.5 17H20", "M4 4v15.5", "M20 4v16", "M6.5 4H20"],
  bookmark: ["M6 3h12v18l-6-4-6 4V3Z"],
  bot: ["M7 8h10a3 3 0 0 1 3 3v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4v-5a3 3 0 0 1 3-3Z", "M12 4v4", "M9 13h.01", "M15 13h.01"],
  calendar: ["M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z", "M8 2v4", "M16 2v4", "M3 10h18"],
  camera: ["M4 7h3l1.4-2.1A2 2 0 0 1 10 4h4a2 2 0 0 1 1.6.9L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
  chart: ["M4 19V5", "M4 19h16", "M8 15l3-4 3 2 5-7"],
  "chart-candle": ["M6 4v16", "M18 4v16", "M4 8h4v7H4z", "M16 11h4v5h-4z", "M12 7v10", "M10 10h4v4h-4z"],
  check: ["M5 12.5l4.2 4.2L19 6.7"],
  "check-circle": ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", "M7.8 12.4l2.8 2.8 5.8-6.4"],
  "chevron-down": ["M6 9l6 6 6-6"],
  "chevron-left": ["M15 6l-6 6 6 6"],
  "chevron-right": ["M9 6l6 6-6 6"],
  "chevron-up": ["M6 15l6-6 6 6"],
  circle: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"],
  cloud: ["M17.5 19H8a6 6 0 1 1 5.8-7.5A4.5 4.5 0 1 1 17.5 19Z"],
  code: ["M8 6l-6 6 6 6", "M16 6l6 6-6 6"],
  copy: ["M8 8h11v11H8z", "M5 16H4a1 1 0 0 1-1-1V4h11v1"],
  cpu: ["M8 8h8v8H8z", "M12 2v4", "M12 18v4", "M2 12h4", "M18 12h4", "M7 2v3", "M17 19v3"],
  "credit-card": ["M3 6h18v12H3z", "M3 10h18"],
  "cube-focus": ["M12 3l7 4-7 4-7-4 7-4Z", "M5 7v8l7 4 7-4V7", "M12 11v8", "M8 2H4v4", "M16 2h4v4", "M8 22H4v-4", "M16 22h4v-4"],
  dollar: ["M16.7 8A3 3 0 0 0 14 6h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1-2.7-2", "M12 3v3", "M12 18v3"],
  download: ["M12 3v12", "M7 10l5 5 5-5", "M5 21h14"],
  eye: ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  "eye-off": ["M3 3l18 18", "M10.6 10.6A3 3 0 0 0 13.4 13.4", "M7.3 7.3C4 9.2 2 12 2 12s4 7 10 7c1.5 0 2.8-.4 4-1", "M14.5 5.4C19.2 6.7 22 12 22 12s-.8 1.5-2.2 3.1"],
  file: ["M6 2h8l4 4v16H6z", "M14 2v6h6"],
  filter: ["M4 5h16l-6 7v5l-4 2v-7L4 5Z"],
  fingerprint: ["M12 11a3 3 0 0 1 3 3c0 2.2-.8 4.1-2.1 5.6", "M9 14a3 3 0 0 1 6 0", "M7.1 17.6A7 7 0 0 1 19 12.7", "M5.2 14.8a7 7 0 0 1 13.3-4.1", "M4 11.4A9 9 0 0 1 20.5 8", "M8.2 21c1.1-1.2 1.8-2.8 1.8-5v-2a2 2 0 1 1 4 0v.4"],
  globe: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M3.6 9h16.8", "M3.6 15h16.8", "M12 3a15 15 0 0 0 0 18", "M12 3a15 15 0 0 1 0 18"],
  grid: ["M4 4h6v6H4z", "M14 4h6v6h-6z", "M4 14h6v6H4z", "M14 14h6v6h-6z"],
  grip: ["M9 5h.01", "M15 5h.01", "M9 12h.01", "M15 12h.01", "M9 19h.01", "M15 19h.01"],
  heart: ["M12 21s-7-4.4-9-9a5 5 0 0 1 8-5 5 5 0 0 1 8 5c-2 4.6-9 9-9 9Z"],
  home: ["M3 11l9-8 9 8", "M5 10v11h14V10", "M9 21v-6h6v6"],
  image: ["M4 5h16v14H4z", "M8 13l3-3 6 6", "M8 8h.01"],
  info: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 11v5", "M12 8h.01"],
  layers: ["M12 3l9 5-9 5-9-5 9-5Z", "M3 12l9 5 9-5", "M3 16l9 5 9-5"],
  link: ["M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1", "M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"],
  lock: ["M6 10h12v11H6z", "M8 10V7a4 4 0 0 1 8 0v3"],
  mail: ["M3 6h18v12H3z", "M3 7l9 7 9-7"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  message: ["M4 5h16v12H7l-3 3V5Z"],
  "message-circle": ["M21 11.5a8.5 8.5 0 0 1-12.7 7.4L3 21l2.1-5A8.5 8.5 0 1 1 21 11.5Z"],
  mic: ["M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z", "M5 11a7 7 0 0 0 14 0", "M12 18v4"],
  minus: ["M5 12h14"],
  moon: ["M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 7 7 0 1 0 20.5 14.2Z"],
  network: ["M6 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M18 23a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M18 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M8.6 6l6.8 12", "M15.4 6 8.6 18"],
  "open-book": ["M3.5 5.5A3.5 3.5 0 0 1 7 4h5v16H7a3.5 3.5 0 0 0-3.5 2V5.5Z", "M20.5 5.5A3.5 3.5 0 0 0 17 4h-5v16h5a3.5 3.5 0 0 1 3.5 2V5.5Z"],
  pause: ["M8 5v14", "M16 5v14"],
  phone: ["M22 16.9v3a2 2 0 0 1-2.2 2 19 19 0 0 1-17.7-17.7A2 2 0 0 1 4.1 2h3l2 5-2 1.2a12 12 0 0 0 5.7 5.7l1.2-2 5 2Z"],
  play: ["M7 4l14 8-14 8V4Z"],
  plug: ["M8 2v6", "M16 2v6", "M7 8h10v4a5 5 0 0 1-10 0V8Z", "M12 17v5"],
  plus: ["M12 5v14", "M5 12h14"],
  "plus-minus-stack": ["M12 5.5v8", "M8 9.5h8", "M8 18h8"],
  power: ["M12 2v10", "M6.4 5.6a8 8 0 1 0 11.2 0"],
  radio: ["M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z", "M16 8a6 6 0 0 1 0 8", "M8 8a6 6 0 0 0 0 8", "M20 5a10 10 0 0 1 0 14", "M4 5a10 10 0 0 0 0 14"],
  refresh: ["M20 11a8 8 0 0 0-15.5-2M4 5v4h4", "M4 13a8 8 0 0 0 15.5 2M20 19v-4h-4"],
  save: ["M5 3h12l2 2v16H5z", "M8 3v6h8", "M8 21v-7h8v7"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "M21 21l-4.3-4.3"],
  send: ["M22 2 11 13", "M22 2l-7 20-4-9-9-4 20-7Z"],
  settings: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M20 13.5v-3l-3-1a7 7 0 0 0-1-1.8l1-3-2.2-1.3-2.3 2a7 7 0 0 0-2 0l-2.3-2L6 4.7l1 3a7 7 0 0 0-1 1.8l-3 1v3l3 1a7 7 0 0 0 1 1.8l-1 3 2.2 1.3 2.3-2a7 7 0 0 0 2 0l2.3 2 2.2-1.3-1-3a7 7 0 0 0 1-1.8l3-1Z"],
  share: ["M4 12v7h16v-7", "M12 3v12", "M8 7l4-4 4 4"],
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"],
  sliders: ["M4 6h8", "M16 6h4", "M14 4v4", "M4 12h4", "M12 12h8", "M10 10v4", "M4 18h10", "M18 18h2", "M16 16v4"],
  sparkles: ["M12 3l1.5 5 5 1.5-5 1.5-1.5 5-1.5-5-5-1.5 5-1.5L12 3Z", "M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"],
  square: ["M5 5h14v14H5z"],
  stadium: ["M4 9c0-3 3.6-5 8-5s8 2 8 5v6c0 3-3.6 5-8 5s-8-2-8-5V9Z", "M4 9c0 3 3.6 5 8 5s8-2 8-5", "M8 13v5", "M12 14v6", "M16 13v5"],
  target: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z", "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"],
  trash: ["M4 7h16", "M10 11v6", "M14 11v6", "M6 7l1 14h10l1-14", "M9 7V4h6v3"],
  "trend-down": ["M4 7l6 6 4-4 6 6", "M20 9v6h-6"],
  "trend-up": ["M4 17l6-6 4 4 6-8", "M20 7v6h-6"],
  tv: ["M4 6h16v11H4z", "M9 21h6", "M12 17v4"],
  upload: ["M12 21V9", "M7 14l5-5 5 5", "M5 3h14"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21a8 8 0 0 1 16 0"],
  users: ["M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M2 21a7 7 0 0 1 14 0", "M17 4a4 4 0 0 1 0 8", "M22 21a7 7 0 0 0-5-6.7"],
  "users-three": ["M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M4.8 10a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z", "M19.2 10a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6Z", "M5 21a7 7 0 0 1 14 0", "M1.8 18.5a5 5 0 0 1 5.2-3.8", "M17 14.7a5 5 0 0 1 5.2 3.8"],
  volume: ["M4 9v6h4l5 4V5L8 9H4Z", "M16 8a5 5 0 0 1 0 8", "M18.5 5.5a9 9 0 0 1 0 13"],
  "volume-x": ["M4 9v6h4l5 4V5L8 9H4Z", "M19 9l-6 6", "M13 9l6 6"],
  wrench: ["M14.5 5.5a5 5 0 0 0 6 6L11 21l-5-5 9.5-9.5Z"],
  x: ["M6 6l12 12", "M18 6 6 18"],
  youtube: ["M22 12s0 4-1 5-9 1-9 1-8 0-9-1-1-5-1-5 0-4 1-5 9-1 9-1 8 0 9 1 1 5 1 5Z", "M10 8l6 4-6 4V8Z"],
  zap: ["M13 2 4 14h7l-1 8 10-13h-7l1-7Z"],
};

function iconFor(key: IconKey) {
  return forwardRef<SVGSVGElement, HoverIconProps>(function HoverIcon(
    { size = 31, color = "currentColor", strokeWidth = 2, className = "", style, ...props },
    ref,
  ) {
    if (String(className).includes("animate-spin")) {
      return (
        <DotMatrixLoader
          size={size}
          color={
            color === "currentColor"
              ? "var(--fintheon-primary, var(--fintheon-accent))"
              : color
          }
          variant={key === "refresh" ? "cipher" : "loading"}
          className={className}
        />
      );
    }
    const exact = EXACT_ICON_BODIES[key as ExactIconKey];
    if (exact) {
      return (
        <svg
          ref={ref}
          width={size}
          height={size}
          viewBox={`0 0 ${exact.width} ${exact.height}`}
          className={`fintheon-hover-icon ${className}`}
          style={{ color, ...style }}
          {...props}
        >
          <g
            className="fintheon-hover-icon__glyph"
            dangerouslySetInnerHTML={{ __html: exact.body }}
          />
        </svg>
      );
    }
    const paths = PATHS[key as LegacyIconKey] ?? PATHS.circle;
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`fintheon-hover-icon ${className}`}
        style={style}
        {...props}
      >
        <g className="fintheon-hover-icon__glyph">
          {paths.map((d) => <path key={d} d={d} />)}
        </g>
      </svg>
    );
  });
}

const i = iconFor;
export const Activity = i("activity"),
  AlertCircle = i("info-circled-preview"), AlertTriangle = i("exclamation-triangle-preview"),
  ArrowDown = i("arrow-down"), ArrowDownRight = i("arrow-down"), ArrowLeft = i("arrow-left"), ArrowRight = i("arrow-right"), ArrowUp = i("arrow-up"), ArrowUpRight = i("arrow-up"),
  AtSign = i("at-preview"), Atom = i("atom-preview"), Award = i("brain-electricity"), BarChart3 = i("graph-up-preview"),
  Bell = i("bell-preview"), BellOff = i("bell-preview"), BookOpen = i("book-open-preview"), Bookmark = i("bookmark"), Bot = i("brain-electricity"), Brain = i("brain-electricity"), Building2 = i("building-bank"),
  Calendar = i("calendar-preview"), CalendarCheck = i("calendar-preview"), CalendarClock = i("calendar-preview"), CalendarDays = i("calendar-preview"), Camera = i("image-preview"),
  Check = i("check"), CheckCircle = i("check-circled-preview"), CheckCircle2 = i("check-circled-preview"),
  ChevronDown = i("chevron-down"), ChevronLeft = i("chevron-left"), ChevronRight = i("chevron-right"), ChevronUp = i("chevron-up"),
  Circle = i("circle"), CircleDot = i("circle"), CircleOff = i("circle"), Clock = i("clock-preview"), Clock705 = i("clock-705"), Cloud = i("cloud"), Code = i("terminal-preview"), Columns3 = i("grid"), Copy = i("copy"),
  Cpu = i("cpu-preview"), CreditCard = i("graph-up-preview"), Crosshair = i("crosshair-preview"), CubeFocus = i("cube-focus-preview"), Diff = i("chart"), DollarSign = i("graph-up-preview"), Download = i("download"), Edit3 = i("wrench"),
  ExternalLink = i("internet-preview"), Eye = i("eye-preview"), EyeOff = i("eye-off"), FileCode2 = i("terminal-preview"), FileDown = i("database-script"), FileText = i("database-script"),
  Filter = i("chart-candle-preview"), Fingerprint = i("fingerprint-preview"), GitBranch = i("git-branch-preview"), Globe = i("internet-preview"), GripHorizontal = i("grip"), GripVertical = i("grip"),
  History = i("clock-preview"), Image = i("image-preview"), ImagePlus = i("image-preview"), Inbox = i("mail"), Info = i("info-circled-preview"), Landmark = i("building-bank"), Layers = i("layers"),
  LayoutDashboard = i("users-three-preview"), Link = i("internet-preview"), ListOrdered = i("chart-candle-preview"), Lock = i("fingerprint-preview"), LockOpen = i("fingerprint-preview"), Mail = i("mail"),
  MagnifyingGlass = i("magnifying-glass-preview"), Maximize2 = i("grid"), Menu = i("menu"), MessageCircle = i("message-circle-preview"), MessageSquare = i("message-circle-preview"), MessageSquareText = i("message-circle-preview"),
  Mic = i("mic-preview"), MicOff = i("mic-preview"), Minus = i("minus"), Moon = i("moon-preview"), Network = i("terminal-preview"), Newspaper = i("radio-tower-preview"), Palette = i("gear-preview"),
  PanelRightClose = i("grid"), Paperclip = i("internet-preview"), Pause = i("pause"), Pencil = i("wrench"), Phone = i("phone-preview"), PhoneOff = i("phone-preview"), PictureInPicture2 = i("grid"), Play = i("play"),
  Plug = i("terminal-preview"), Plug2 = i("terminal-preview"), Plus = i("plus-preview"), PlusCircle = i("plus-preview"), Power = i("power"), Radio = i("radio-tower-preview"), RadioTower = i("radio-tower-preview"),
  RefreshCcw = i("refresh"), RefreshCw = i("refresh"), RotateCcw = i("refresh"), Route = i("terminal-preview"), Rss = i("internet-preview"), Save = i("save"), ScanEye = i("eye-preview"), Scroll = i("database-script"),
  Search = i("search-preview"), Send = i("send"), ServerCog = i("gear-preview"), Settings = i("gear-preview"), Share2 = i("internet-preview"),
  Shield = i("fingerprint-preview"), ShieldAlert = i("fingerprint-preview"), ShieldCheck = i("fingerprint-preview"), ShieldOff = i("fingerprint-preview"), ShieldX = i("fingerprint-preview"),
  SlidersHorizontal = i("chart-candle-preview"), Sparkles = i("brain-electricity"), Square = i("square"), Stadium = i("building-stadium"), Stethoscope = i("heart"), Target = i("crosshair-preview"),
  ThumbsDown = i("trend-down"), ThumbsUp = i("trend-up"), Trash2 = i("trash"), TrendingDown = i("trend-down"), TrendingUp = i("graph-up-preview"), Tv = i("tv-preview"), Upload = i("upload"),
  User = i("profile-circle-preview"), UserPlus = i("profile-circle-preview"), Users = i("users-three-preview"), Volume2 = i("mic-preview"), VolumeOff = i("volume-x"), VolumeX = i("volume-x"),
  Wrench = i("wrench"), X = i("cross-2-preview"), XCircle = i("cross-2-preview"), Youtube = i("internet-preview"), Zap = i("zap");
export const Loader2 = forwardRef<SVGSVGElement, HoverIconProps>(
  function Loader2({ size = 18, color = "var(--fintheon-primary, var(--fintheon-accent))", className, style }, _ref) {
    return (
      <DotMatrixLoader
        variant="diagonal-scan"
        size={size}
        color={color}
        className={className}
        style={style as CSSProperties}
      />
    );
  },
);

export const HardDrive = Cpu, GitMerge = GitBranch, Trophy = Award, HeartPulse = Stethoscope, Heart = Stethoscope, Twitter = Globe, Database = i("database-script"), CheckSquare = CheckCircle, ListTodo = ListOrdered, Crown = Award, Megaphone = i("megaphone-preview"), Compass = Search, PanelRightOpen = PanelRightClose, LineChart = BarChart3, CandlestickChart = Filter, ChartCandlestick = Filter, ChartLine = i("chart-line-preview"), Box = CubeFocus, MoveLeft = ArrowLeft, MoveRight = ArrowRight, Video = Camera, Terminal = FileCode2, SplitSquareVertical = Columns3, LogOut = ArrowRight, BookOpenCheck = BookOpen, Monitor = Tv, ClipboardList = FileText, Link2 = Link, BriefcaseBusiness = Building2, Map = Network, PanelLeftOpen = PanelRightClose, Hand = User, MousePointer2 = Target, Highlighter = Pencil, SquareDashedMousePointer = Square, ClipboardPlus = BookOpen, GitPullRequest = GitBranch, Pin = Target, Settings2 = Settings, Move = GripVertical, Server = Cpu, ToggleLeft = Power, ToggleRight = Power, Tag = Bookmark, Sprout = Sparkles, ArrowLeftRight = ArrowRight, ArrowRightLeft = ArrowRight, Merge = GitBranch, Layout = LayoutDashboard, StickyNote = i("note-pencil-preview"), Flame = Zap, CircleAlert = AlertTriangle, CircleDotDashed = CircleDot, CircleX = XCircle, FileBarChart = BarChart3, StopCircle = CircleOff, HelpCircle = Info, Sun = Circle, Globe2 = Globe, BookText = BookOpen, NoneIcon = i("component-none-preview"), PlusMinusStack = i("plus-minus-stack-preview");
export type LucideIcon = typeof Check;
