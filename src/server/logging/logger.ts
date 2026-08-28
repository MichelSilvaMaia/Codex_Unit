type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function write(level: LogLevel, message: string, context: LogContext = {}) {
  const entry = JSON.stringify({ level, message, ...context, timestamp: new Date().toISOString() });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
