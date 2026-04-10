// [claude-code 2026-03-20] Structured JSON logger — replaces console.log('[Module]', ...)

type LogLevel = "info" | "warn" | "error";

interface Logger {
  info(msg: string, context?: Record<string, unknown>): void;
  warn(msg: string, context?: Record<string, unknown>): void;
  error(msg: string, context?: Record<string, unknown>): void;
}

function emit(
  level: LogLevel,
  module: string,
  msg: string,
  context?: Record<string, unknown>,
): void {
  const entry = {
    level,
    module,
    msg,
    ...context,
    ts: Date.now(),
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export function createLogger(module: string): Logger {
  return {
    info: (msg, ctx) => emit("info", module, msg, ctx),
    warn: (msg, ctx) => emit("warn", module, msg, ctx),
    error: (msg, ctx) => emit("error", module, msg, ctx),
  };
}
