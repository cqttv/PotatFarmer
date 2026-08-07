import { LOG_LEVEL, type LogLevel } from "./config.js";

type LogFields = Record<string, unknown>;

const LEVEL_VALUE: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function errorFields(error: unknown): LogFields {
  if (!(error instanceof Error)) return { error: String(error) };
  return {
    error: error.message,
    errorName: error.name,
    ...(error.stack ? { stack: error.stack } : {}),
  };
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  // Both keys are constrained to LogLevel values.
  // eslint-disable-next-line security/detect-object-injection
  if (LEVEL_VALUE[level] < LEVEL_VALUE[LOG_LEVEL]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields,
  };
  process.stderr.write(`${JSON.stringify(entry)}\n`);
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, error?: unknown, fields?: LogFields): void;
}

export const log: Logger = {
  debug: (message, fields) => {
    write("debug", message, fields);
  },
  info: (message, fields) => {
    write("info", message, fields);
  },
  warn: (message, fields) => {
    write("warn", message, fields);
  },
  error: (message, error, fields) => {
    write("error", message, { ...fields, ...errorFields(error) });
  },
};

export function formatLogText(
  value: string | null,
  maxLength = 300,
): string | null {
  if (value === null) return null;
  const singleLine = value.replace(/\s+/g, " ").trim();
  return singleLine.length <= maxLength
    ? singleLine
    : `${singleLine.slice(0, maxLength)}…`;
}
