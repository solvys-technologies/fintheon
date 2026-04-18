// [claude-code 2026-04-03] Removed stale heartbeat/pulse/NTN/X indicators — system status now from /api/diagnostics only
import { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronUp,
  ChevronDown,
  Terminal,
  ExternalLink,
  SplitSquareVertical,
  Power,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  PLATFORM_LABELS,
  PLATFORM_URLS,
  type TradingPlatform,
} from "../TradingBrowser";
import { changelog } from "../../../src/lib/changelog";
import { useErrorLog } from "../../hooks/useErrorLog";
import { useSystemStatus } from "../../hooks/useSystemStatus";
import { useSettings } from "../../contexts/SettingsContext";
import { useGateway } from "../../contexts/GatewayContext";
import { useRiskFlow } from "../../contexts/RiskFlowContext";
import { EPOCH_VERSION } from "../../lib/epoch-version";
import { ErrorLogPanel } from "../ui/ErrorLogPanel";
import { StatusIndicator } from "../ui/StatusIndicator";
import { TeamPanel } from "../team/TeamPanel";
import { HarperOpsPanel } from "../harper-ops/HarperOpsPanel";
import { Users, Bot } from "lucide-react";

type PanelTab = "terminal" | "changelog" | "errors" | "team" | "harper-ops";

/** Slash-command suggestions (like Claude Code skills) for the Fintheon CLI */
const CLI_SLASH_COMMANDS: { slug: string; label: string; command: string }[] = [
  {
    slug: "start-backend",
    label: "Start backend",
    command: "fintheon start backend",
  },
  { slug: "frontend", label: "Start frontend dev", command: "bunx vite" },
  {
    slug: "install",
    label: "Install all deps",
    command:
      "bun install && cd frontend && bun install && cd ../backend-hono && bun install",
  },
  { slug: "build", label: "Build frontend", command: "bunx vite build" },
  {
    slug: "typecheck",
    label: "Typecheck backend",
    command: "cd backend-hono && bunx tsc --noEmit",
  },
  {
    slug: "hermes-start",
    label: "Start Hermes gateway",
    command: "hermes gateway start",
  },
  {
    slug: "hermes-restart",
    label: "Restart Hermes gateway",
    command: "hermes gateway stop && hermes gateway start",
  },
  {
    slug: "hermes-port",
    label: "Change Hermes port",
    command: "hermes gateway start --port 7787",
  },
];

function resolveSlashCommand(input: string): string | null {
  if (!input.startsWith("/")) return null;
  const slug = input.slice(1).trim().toLowerCase().replace(/\s+/g, "-");
  const match = CLI_SLASH_COMMANDS.find(
    (c) =>
      c.slug === slug || c.slug.replace(/-/g, "") === slug.replace(/-/g, ""),
  );
  return match?.command ?? null;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

/** Render terminal output with clickable `backtick commands` */
function renderOutputLine(text: string, onClickCommand: (cmd: string) => void) {
  const parts = text.split(/`([^`]+)`/);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <button
        key={i}
        type="button"
        onClick={() => onClickCommand(part)}
        className="text-[var(--fintheon-accent)] hover:underline cursor-pointer"
        title={`Click to fill: ${part}`}
      >
        {part}
      </button>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

interface FooterToolbarProps {
  topStepXEnabled?: boolean;
  primaryPlatform?: TradingPlatform;
  onPrimaryPlatformChange?: (p: TradingPlatform) => void;
  secondaryPlatform?: TradingPlatform;
  onSecondaryPlatformChange?: (p: TradingPlatform) => void;
  splitViewEnabled?: boolean;
  onSplitViewToggle?: () => void;
  allowSplitView?: boolean;
  onPowerOff?: () => void;
}

export function FooterToolbar({
  topStepXEnabled = false,
  primaryPlatform = "topstepx",
  onPrimaryPlatformChange,
  secondaryPlatform = "research",
  onSecondaryPlatformChange,
  splitViewEnabled = false,
  onSplitViewToggle,
  allowSplitView = false,
  onPowerOff,
}: FooterToolbarProps) {
  const { proposerIframeSources } = useSettings();
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>("terminal");
  const [cliInput, setCliInput] = useState("");
  const [cliHistory, setCliHistory] = useState<
    Array<{ type: "input" | "output"; text: string }>
  >([
    {
      type: "output",
      text: 'Fintheon CLI — type / for commands or "help" for built-ins.',
    },
    {
      type: "output",
      text: "Slash commands: /start-backend, /frontend, /install, /build, /typecheck, /hermes-start, /hermes-restart, /hermes-port",
    },
  ]);
  const [slashSuggestionsOpen, setSlashSuggestionsOpen] = useState(false);
  const [slashSuggestionsIndex, setSlashSuggestionsIndex] = useState(0);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cliContainerRef = useRef<HTMLDivElement>(null);
  const prevPanelOpenRef = useRef(false);
  const activeProcessRef = useRef<{
    processId: string;
    es: EventSource;
  } | null>(null);

  const { fetchStatus, refreshing } = useRiskFlow();

  // Listen for update-installing event from VersionChecker
  const [updateInstalling, setUpdateInstalling] = useState(false);
  useEffect(() => {
    const handler = () => setUpdateInstalling(true);
    window.addEventListener("fintheon:update-installing", handler);
    return () =>
      window.removeEventListener("fintheon:update-installing", handler);
  }, []);
  const isElectron =
    typeof window !== "undefined" && window.electron?.runShellCommand != null;
  const slashFilter = cliInput.startsWith("/")
    ? cliInput.slice(1).toLowerCase().trim()
    : "";
  const slashSuggestions = slashFilter
    ? CLI_SLASH_COMMANDS.filter(
        (c) =>
          c.slug.toLowerCase().includes(slashFilter) ||
          c.label.toLowerCase().includes(slashFilter),
      )
    : CLI_SLASH_COMMANDS;
  const showSlashSuggestions =
    slashSuggestionsOpen && (cliInput === "/" || slashSuggestions.length > 0);

  useEffect(() => {
    setSlashSuggestionsIndex(0);
  }, [slashFilter, slashSuggestions.length]);

  // Subscribe to CLI output from Electron
  useEffect(() => {
    if (!window.electron?.setCliOutputCallback) return;
    const append = (event: {
      type: string;
      data?: string;
      code?: number | null;
      signal?: string | null;
    }) => {
      setCliHistory((prev) => {
        if (event.type === "stdout" || event.type === "stderr") {
          const lines = String(event.data ?? "")
            .split("\n")
            .filter(Boolean);
          return [
            ...prev,
            ...lines.map((text) => ({ type: "output" as const, text })),
          ];
        }
        if (event.type === "exit") {
          const code = event.code ?? event.signal ?? "?";
          return [...prev, { type: "output", text: `[exit ${code}]` }];
        }
        return prev;
      });
    };
    window.electron.setCliOutputCallback(append);
    return () => window.electron?.setCliOutputCallback(null);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [cliHistory]);

  // When panel first opens on terminal tab: focus input and show commands list (popup)
  useEffect(() => {
    if (panelOpen && activeTab === "terminal") {
      inputRef.current?.focus();
      const justOpened = !prevPanelOpenRef.current;
      if (justOpened) {
        setCliInput("/");
        setSlashSuggestionsOpen(true);
      }
    }
    prevPanelOpenRef.current = panelOpen;
  }, [panelOpen, activeTab]);

  // Click outside to close slash suggestions
  useEffect(() => {
    if (!showSlashSuggestions) return;
    const onMouseDown = (e: MouseEvent) => {
      if (cliContainerRef.current?.contains(e.target as Node)) return;
      setSlashSuggestionsOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [showSlashSuggestions]);

  const runViaBackend = useCallback((cmd: string) => {
    fetch(`${API_BASE}/api/terminal/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd }),
    })
      .then((r) => r.json())
      .then((data: { ok?: boolean; processId?: string; error?: string }) => {
        if (!data.ok || !data.processId) {
          setCliHistory((prev) => [
            ...prev,
            { type: "output", text: data.error ?? "Failed to start command" },
          ]);
          return;
        }
        const es = new EventSource(
          `${API_BASE}/api/terminal/stream/${data.processId}`,
        );
        activeProcessRef.current = { processId: data.processId, es };

        const stripAnsi = (s: string) =>
          s.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
        const onData = (e: MessageEvent) => {
          const lines = stripAnsi(String(e.data)).split("\n").filter(Boolean);
          setCliHistory((prev) => [
            ...prev,
            ...lines.map((text) => ({ type: "output" as const, text })),
          ]);
        };
        es.addEventListener("stdout", onData);
        es.addEventListener("stderr", onData);
        es.addEventListener("exit", (e: MessageEvent) => {
          try {
            const { code, signal } = JSON.parse(e.data);
            const exitVal = code ?? signal ?? "?";
            setCliHistory((prev) => [
              ...prev,
              { type: "output", text: `[exit ${exitVal}]` },
            ]);
          } catch {
            setCliHistory((prev) => [
              ...prev,
              { type: "output", text: "[exit]" },
            ]);
          }
          es.close();
          activeProcessRef.current = null;
        });
        es.onerror = () => {
          es.close();
          activeProcessRef.current = null;
        };
      })
      .catch((err) => {
        setCliHistory((prev) => [
          ...prev,
          {
            type: "output",
            text: `Backend unavailable — start it with \`fintheon start\``,
          },
        ]);
      });
  }, []);

  const killActiveProcess = useCallback(() => {
    const active = activeProcessRef.current;
    if (!active) return;
    fetch(`${API_BASE}/api/terminal/kill/${active.processId}`, {
      method: "POST",
    }).catch(() => {});
    active.es.close();
    activeProcessRef.current = null;
    setCliHistory((prev) => [...prev, { type: "output", text: "^C" }]);
  }, []);

  const runShellCommand = useCallback(
    (cmd: string) => {
      // Always use backend SSE — Electron IPC cwd is inside the .app bundle and unreliable
      runViaBackend(cmd);
    },
    [runViaBackend],
  );

  const handleCli = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Ctrl+C kills the active process
      if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        killActiveProcess();
        return;
      }

      const cmd = cliInput.trim();

      if (showSlashSuggestions && slashSuggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashSuggestionsIndex((i) => (i + 1) % slashSuggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashSuggestionsIndex(
            (i) => (i - 1 + slashSuggestions.length) % slashSuggestions.length,
          );
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const selected = slashSuggestions[slashSuggestionsIndex];
          setCliInput(selected.command);
          setSlashSuggestionsOpen(false);
          inputRef.current?.focus();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSlashSuggestionsOpen(false);
          return;
        }
      }

      if (e.key !== "Enter") return;
      if (!cmd) return;
      setSlashSuggestionsOpen(false);

      // Resolve /start-backend, /backend, etc. to the actual shell command
      const resolved = resolveSlashCommand(cmd);
      const commandToRun = resolved ?? cmd;
      const displayCmd = resolved ? cmd : commandToRun;
      setCliInput("");

      const newHistory = [
        ...cliHistory,
        { type: "input" as const, text: displayCmd },
      ];

      const lower = cmd.toLowerCase().trim();
      if (lower === "help") {
        newHistory.push({
          type: "output",
          text: "Built-in: help, changelog, clear, status, version, update. Slash: /start-backend, /frontend, /install, /build, /typecheck, /hermes-start, /hermes-restart, /hermes-port",
        });
        newHistory.push({
          type: "output",
          text: "Any line runs as a shell command. Ctrl+C to kill a running process.",
        });
        setCliHistory(newHistory);
        return;
      }
      if (lower === "clear") {
        setCliHistory([
          { type: "output", text: "Fintheon CLI — type / for commands." },
          {
            type: "output",
            text: "Slash: /start-backend, /backend, /frontend, /install, /build, /typecheck",
          },
        ]);
        return;
      }
      if (lower === "changelog") {
        setActiveTab("changelog");
        newHistory.push({ type: "output", text: "Switched to changelog tab." });
        setCliHistory(newHistory);
        return;
      }
      if (lower === "status") {
        newHistory.push({
          type: "output",
          text: `System: online | Backend: localhost:8080 | Agents: standby`,
        });
        setCliHistory(newHistory);
        return;
      }
      if (lower === "version") {
        newHistory.push({
          type: "output",
          text: `Fintheon Epoch ${EPOCH_VERSION}`,
        });
        setCliHistory(newHistory);
        return;
      }
      // Intercept update commands — the bash script kills the app, so use Electron auto-updater instead
      if (lower === "update" || lower === "fintheon update") {
        newHistory.push({
          type: "output",
          text: "Checking for updates via Electron auto-updater...",
        });
        setCliHistory(newHistory);
        if (window.electron?.checkForUpdate) {
          window.electron
            .checkForUpdate()
            .then(({ ok }) => {
              setCliHistory((prev) => [
                ...prev,
                {
                  type: "output",
                  text: ok
                    ? "Update check triggered — banner will appear if an update is available."
                    : "Update check failed or already up to date.",
                },
              ]);
            })
            .catch(() => {
              setCliHistory((prev) => [
                ...prev,
                {
                  type: "output",
                  text: "Update check failed — try again from an external terminal: fintheon update",
                },
              ]);
            });
        } else {
          setCliHistory((prev) => [
            ...prev,
            {
              type: "output",
              text: "Not running in Electron — use external terminal: fintheon update",
            },
          ]);
        }
        return;
      }
      setCliHistory(newHistory);
      runShellCommand(commandToRun);
    },
    [
      cliInput,
      cliHistory,
      runShellCommand,
      killActiveProcess,
      showSlashSuggestions,
      slashSuggestions,
      slashSuggestionsIndex,
    ],
  );

  const onCliInputChange = (value: string) => {
    setCliInput(value);
    if (value.startsWith("/")) {
      setSlashSuggestionsOpen(true);
      setSlashSuggestionsIndex(0);
    } else {
      setSlashSuggestionsOpen(false);
    }
  };

  const { errorCount } = useErrorLog();
  const { overall: systemOverall, services } = useSystemStatus();
  const { status: gatewayStatus } = useGateway();
  const togglePanel = () => setPanelOpen((v) => !v);

  const openTab = (tab: PanelTab) => {
    if (panelOpen && activeTab === tab) {
      setPanelOpen(false);
    } else {
      setActiveTab(tab);
      setPanelOpen(true);
    }
  };

  return (
    <div className="flex-shrink-0 border-t border-[var(--fintheon-accent)]/12 bg-[var(--fintheon-bg)]">
      {/* Slide-up panel */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: panelOpen ? "280px" : "0px" }}
      >
        <div className="h-[280px] flex flex-col border-b border-[var(--fintheon-accent)]/10">
          {/* Panel tab bar */}
          <div className="flex items-center gap-0 border-b border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-surface)] shrink-0">
            <button
              onClick={() => setActiveTab("terminal")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono tracking-wider uppercase transition-colors border-b-2 ${
                activeTab === "terminal"
                  ? "border-[var(--fintheon-accent)] text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Terminal className="w-3 h-3" />
              Terminal
            </button>
            <button
              onClick={() => setActiveTab("changelog")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono tracking-wider uppercase transition-colors border-b-2 ${
                activeTab === "changelog"
                  ? "border-[var(--fintheon-accent)] text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5"
                  : "border-transparent text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
              }`}
            >
              <FileText className="w-3 h-3" />
              Changelog
            </button>
            <button
              onClick={() => setActiveTab("errors")}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono tracking-wider uppercase transition-colors border-b-2 ${
                activeTab === "errors"
                  ? "border-[var(--fintheon-severe)] text-[var(--fintheon-severe)] bg-[var(--fintheon-severe)]/5"
                  : "border-transparent text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              Errors
              {errorCount > 0 && (
                <span className="ml-1 px-1 py-px text-[8px] font-mono rounded-full bg-[var(--fintheon-severe)]/20 text-[var(--fintheon-severe)] leading-none">
                  {errorCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono tracking-wider uppercase transition-colors border-b-2 ${
                activeTab === "team"
                  ? "border-[var(--fintheon-accent)] text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5"
                  : "border-transparent text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
              }`}
            >
              <Users className="w-3 h-3" />
              Team
            </button>
            <button
              onClick={() => setActiveTab("harper-ops")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono tracking-wider uppercase transition-colors border-b-2 ${
                activeTab === "harper-ops"
                  ? "border-[var(--fintheon-accent)] text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/5"
                  : "border-transparent text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
              }`}
            >
              <Bot className="w-3 h-3" />
              Harper Ops
            </button>
          </div>

          {/* Panel content */}
          <div
            className="flex-1 overflow-y-auto min-h-0"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {activeTab === "terminal" && (
              <div className="h-full flex flex-col">
                {/* Terminal output */}
                <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] space-y-0.5">
                  {cliHistory.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.type === "input"
                          ? "text-[var(--fintheon-accent)]"
                          : "text-zinc-500"
                      }
                    >
                      {line.type === "input"
                        ? `> ${line.text}`
                        : renderOutputLine(line.text, (cmd) => {
                            setCliInput(cmd);
                            inputRef.current?.focus();
                          })}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
                {/* Terminal input + slash suggestions */}
                <div className="relative shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-t border-[var(--fintheon-accent)]/10">
                    <span className="text-[var(--fintheon-accent)]/50 text-[11px] font-mono">
                      {">"}
                    </span>
                    <input
                      ref={inputRef}
                      value={cliInput}
                      onChange={(e) => onCliInputChange(e.target.value)}
                      onKeyDown={handleCli}
                      className="flex-1 bg-transparent text-[11px] text-[var(--fintheon-accent)] placeholder-zinc-700 focus:outline-none font-mono"
                      placeholder="type a command or / for scripts..."
                      spellCheck={false}
                    />
                  </div>
                  {showSlashSuggestions &&
                    panelOpen &&
                    activeTab === "terminal" && (
                      <div className="absolute left-0 right-0 bottom-full mb-0.5 z-50 max-h-48 overflow-y-auto rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-lg">
                        {slashSuggestions.map((item, i) => (
                          <button
                            key={item.slug}
                            type="button"
                            onClick={() => {
                              setCliInput(item.command);
                              setSlashSuggestionsOpen(false);
                              inputRef.current?.focus();
                            }}
                            className={`w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors ${
                              i === slashSuggestionsIndex
                                ? "bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]"
                                : "text-zinc-400 hover:bg-[var(--fintheon-accent)]/10 hover:text-zinc-300"
                            }`}
                          >
                            <span className="text-[var(--fintheon-accent)]/70">
                              /{item.slug}
                            </span>
                            <span className="ml-2 text-zinc-500">
                              {item.label}
                            </span>
                            <span className="ml-auto pl-3 text-zinc-600 text-[10px] truncate max-w-[45%] inline-block align-bottom">
                              {item.command}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>
            )}

            {activeTab === "changelog" && (
              <div className="px-3 py-2 space-y-2">
                {changelog.slice(0, 20).map((entry, i) => (
                  <div key={i} className="flex gap-3 text-[11px]">
                    <span className="text-[var(--fintheon-accent)]/40 shrink-0 font-mono w-[88px]">
                      {entry.date.slice(0, 10)}
                    </span>
                    <span className="text-[var(--fintheon-muted)] shrink-0 font-mono w-[76px] text-[10px]">
                      {entry.agent}
                    </span>
                    <span className="text-[var(--fintheon-text)]/60 flex-1">
                      {entry.summary}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "errors" && <ErrorLogPanel />}
            {activeTab === "team" && <TeamPanel />}
            {activeTab === "harper-ops" && <HarperOpsPanel />}
          </div>
        </div>
      </div>

      {/* Toolbar strip */}
      <div className="h-7 flex items-center gap-3 px-3">
        {/* Panel toggle */}
        <button
          onClick={togglePanel}
          className="flex items-center gap-1 text-[10px] text-[var(--fintheon-accent)]/50 hover:text-[var(--fintheon-accent)] transition-colors"
          title={panelOpen ? "Close panel" : "Open panel"}
        >
          {panelOpen ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronUp className="w-3 h-3" />
          )}
          <span className="font-mono tracking-[0.12em]">
            Epoch {EPOCH_VERSION}
          </span>
        </button>

        <div className="w-px h-3.5 bg-[var(--fintheon-accent)]/10" />

        {/* Tab shortcuts */}
        <button
          onClick={() => openTab("terminal")}
          className={`flex items-center gap-1 text-[10px] transition-colors ${
            panelOpen && activeTab === "terminal"
              ? "text-[var(--fintheon-accent)]"
              : "text-zinc-600 hover:text-[var(--fintheon-accent)]"
          }`}
          title="Terminal"
        >
          <Terminal className="w-3 h-3" />
        </button>
        <button
          onClick={() => openTab("changelog")}
          className={`flex items-center gap-1 text-[10px] transition-colors ${
            panelOpen && activeTab === "changelog"
              ? "text-[var(--fintheon-accent)]"
              : "text-zinc-600 hover:text-[var(--fintheon-accent)]"
          }`}
          title="Changelog"
        >
          <FileText className="w-3 h-3" />
        </button>
        <button
          onClick={() => openTab("errors")}
          className={`relative flex items-center gap-1 text-[10px] transition-colors ${
            panelOpen && activeTab === "errors"
              ? "text-red-400"
              : errorCount > 0
                ? "text-red-400/60 hover:text-red-400"
                : "text-zinc-600 hover:text-zinc-400"
          }`}
          title="Error Log"
        >
          <AlertTriangle className="w-3 h-3" />
          {errorCount > 0 && (
            <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 rounded-full bg-red-500 text-[7px] text-white flex items-center justify-center leading-none">
              {errorCount > 9 ? "!" : errorCount}
            </span>
          )}
        </button>
        <button
          onClick={() => openTab("team")}
          className={`flex items-center text-[10px] transition-colors ${
            panelOpen && activeTab === "team"
              ? "text-[var(--fintheon-accent)]"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
          title="Team"
        >
          <Users className="w-3 h-3" />
        </button>
        <button
          onClick={() => openTab("harper-ops")}
          className={`relative flex items-center text-[10px] transition-colors ${
            panelOpen && activeTab === "harper-ops"
              ? "text-[var(--fintheon-accent)]"
              : "text-zinc-600 hover:text-zinc-400"
          }`}
          title="Harper Ops"
        >
          <Bot className="w-3 h-3" />
        </button>

        <div className="w-px h-3.5 bg-[var(--fintheon-accent)]/10" />

        {/* Quick CLI — always available in toolbar */}
        <div
          ref={cliContainerRef}
          className="relative flex items-center gap-1.5 flex-1 min-w-0"
        >
          <Terminal className="w-3 h-3 text-[var(--fintheon-accent)]/30 shrink-0" />
          <input
            value={cliInput}
            onChange={(e) => onCliInputChange(e.target.value)}
            onFocus={() =>
              cliInput.startsWith("/") && setSlashSuggestionsOpen(true)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && cliInput.trim()) {
                setPanelOpen(true);
                setActiveTab("terminal");
                handleCli(e);
              }
            }}
            className="flex-1 bg-transparent text-[11px] text-gray-500 placeholder-gray-700 focus:outline-none font-mono"
            placeholder="> or / for scripts"
            spellCheck={false}
          />
          {showSlashSuggestions && !panelOpen && (
            <div className="absolute left-0 right-0 top-full mt-0.5 z-50 max-h-48 overflow-y-auto rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] shadow-lg">
              {slashSuggestions.map((item, i) => (
                <button
                  key={item.slug}
                  type="button"
                  onClick={() => {
                    setCliInput(item.command);
                    setSlashSuggestionsOpen(false);
                    setPanelOpen(true);
                    setActiveTab("terminal");
                    inputRef.current?.focus();
                  }}
                  className={`w-full text-left px-3 py-1.5 text-[11px] font-mono transition-colors ${
                    i === slashSuggestionsIndex
                      ? "bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)]"
                      : "text-zinc-400 hover:bg-[var(--fintheon-accent)]/10 hover:text-zinc-300"
                  }`}
                >
                  <span className="text-[var(--fintheon-accent)]/70">
                    /{item.slug}
                  </span>
                  <span className="ml-2 text-zinc-500">{item.label}</span>
                  <span className="ml-auto pl-3 text-zinc-600 text-[10px] truncate max-w-[45%] inline-block align-bottom">
                    {item.command}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Iframe controls (when TopStepX active) */}
        {topStepXEnabled && (
          <>
            <div className="w-px h-3.5 bg-[var(--fintheon-accent)]/10" />
            <select
              value={primaryPlatform}
              onChange={(e) =>
                onPrimaryPlatformChange?.(e.target.value as TradingPlatform)
              }
              className="px-1.5 py-0.5 bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/15 rounded text-[10px] text-[var(--fintheon-accent)] focus:outline-none"
            >
              {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
              {proposerIframeSources.map((s) => (
                <option key={s.id} value={`custom:${s.id}`}>
                  {s.label}
                </option>
              ))}
            </select>
            {allowSplitView && (
              <>
                <button
                  type="button"
                  onClick={onSplitViewToggle}
                  className={`p-0.5 rounded transition-colors ${
                    splitViewEnabled
                      ? "text-[var(--fintheon-accent)] bg-[var(--fintheon-accent)]/10"
                      : "text-gray-600 hover:text-[var(--fintheon-accent)]"
                  }`}
                  title="Toggle split view"
                >
                  <SplitSquareVertical className="w-3 h-3" />
                </button>
                {splitViewEnabled && (
                  <select
                    value={secondaryPlatform}
                    onChange={(e) =>
                      onSecondaryPlatformChange?.(
                        e.target.value as TradingPlatform,
                      )
                    }
                    className="px-1.5 py-0.5 bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/15 rounded text-[10px] text-[var(--fintheon-accent)]/70 focus:outline-none"
                    title="Secondary frame"
                  >
                    {Object.entries(PLATFORM_LABELS)
                      .filter(([key]) => key !== primaryPlatform)
                      .map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    {proposerIframeSources
                      .filter((s) => `custom:${s.id}` !== primaryPlatform)
                      .map((s) => (
                        <option key={s.id} value={`custom:${s.id}`}>
                          {s.label}
                        </option>
                      ))}
                  </select>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() =>
                window.open(
                  PLATFORM_URLS[primaryPlatform],
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors"
              title="Open in browser"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={onPowerOff}
              className="p-0.5 rounded text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Power off iframe"
            >
              <Power className="w-3 h-3" />
            </button>
          </>
        )}

        {/* S14-T6: Peers toggle removed — team status is in footer Team tab */}

        {/* Update installing status */}
        {updateInstalling && (
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="h-1.5 w-1.5 rounded-full bg-[var(--fintheon-accent)] animate-pulse" />
            <span className="text-[9px] tracking-[0.15em] uppercase text-[var(--fintheon-accent)]/70 font-medium">
              Installing update...
            </span>
          </div>
        )}
        {updateInstalling && (
          <div className="w-px h-3.5 bg-[var(--fintheon-accent)]/10" />
        )}

        {/* Fetch status — shows during refresh or polling */}
        {fetchStatus && (
          <div className="flex items-center gap-1.5 shrink-0">
            {refreshing && (
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--fintheon-accent)] animate-pulse" />
            )}
            <span className="text-[9px] tracking-[0.15em] uppercase text-[var(--fintheon-accent)]/70 font-medium">
              {fetchStatus}
            </span>
          </div>
        )}
        {fetchStatus && (
          <div className="w-px h-3.5 bg-[var(--fintheon-accent)]/10" />
        )}

        {/* System status indicators — real-time from /api/diagnostics */}
        <div className="flex items-center gap-2.5 shrink-0">
          <StatusIndicator
            label="Gateway"
            status={
              gatewayStatus === "connected"
                ? "ok"
                : gatewayStatus === "connecting"
                  ? "degraded"
                  : "error"
            }
            detail={
              gatewayStatus === "connected"
                ? "Backend reachable"
                : gatewayStatus === "connecting"
                  ? "Connecting..."
                  : "Disconnected"
            }
          />
          {services.map((svc) => (
            <StatusIndicator
              key={svc.key}
              label={svc.name}
              status={svc.status}
              detail={svc.detail}
            />
          ))}
        </div>
        <div className="w-px h-3.5 bg-[var(--fintheon-accent)]/10" />
        {/* Overall system status */}
        <StatusIndicator
          label="fintheon"
          status={gatewayStatus !== "connected" ? "error" : systemOverall}
          detail={
            gatewayStatus !== "connected"
              ? "Backend offline"
              : systemOverall === "ok"
                ? "All systems nominal"
                : systemOverall === "degraded"
                  ? "Some services degraded"
                  : "Services unavailable"
          }
        />
      </div>
    </div>
  );
}
