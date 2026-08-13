import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import {
  FILE_LOGGING_ENABLED,
  LOG_FILE,
  LOG_LEVEL,
  type LogLevel,
} from "./config.js";

type LogFields = Record<string, unknown>;

const LEVEL_VALUE: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

let fileLoggingAvailable = FILE_LOGGING_ENABLED;

if (fileLoggingAvailable) {
  try {
    // LOG_FILE is an intentionally user-configurable destination.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    mkdirSync(dirname(LOG_FILE), { recursive: true });
  } catch (error) {
    fileLoggingAvailable = false;
    process.stderr.write(
      `${JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        message: "Unable to initialize log file",
        logFile: LOG_FILE,
        ...errorFields(error),
      })}\n`,
    );
  }
}

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
  const line = `${JSON.stringify(entry)}\n`;
  process.stderr.write(line);
  if (fileLoggingAvailable) {
    try {
      // LOG_FILE is an intentionally user-configurable destination.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      appendFileSync(LOG_FILE, line, "utf8");
    } catch (error) {
      fileLoggingAvailable = false;
      process.stderr.write(
        `${JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "error",
          message: "Unable to write to log file; file logging disabled",
          logFile: LOG_FILE,
          ...errorFields(error),
        })}\n`,
      );
    }
  }
}

export interface Logger {
  debug: (message: string, fields?: LogFields) => void;
  info: (message: string, fields?: LogFields) => void;
  warn: (message: string, fields?: LogFields) => void;
  error: (message: string, error?: unknown, fields?: LogFields) => void;
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
