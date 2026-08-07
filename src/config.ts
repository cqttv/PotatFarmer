export const BEARER_TOKEN =
  process.env["BEARER_TOKEN"] ??
  ((): string => {
    throw new Error("Missing BEARER_TOKEN env var");
  })();
export const API_URL =
  process.env["API_URL"] ?? "https://api.potat.app/execute";
export const BOT_PREFIX = process.env["BOT_PREFIX"] ?? "#";
export const WEB_DASHBOARD_ENABLED =
  process.env["WEB_DASHBOARD_ENABLED"] !== "false";
export const CONSOLE_STATS_ENABLED =
  process.env["CONSOLE_STATS_ENABLED"] !== "false";
export const WEB_PORT = parseEnvNumber(process.env["WEB_PORT"], 3000);
export const COMMAND_DELAY = parseEnvNumber(process.env["COMMAND_DELAY"], 1000);
export const STATUS_INTERVAL = parseEnvNumber(
  process.env["STATUS_INTERVAL"] ?? process.env["PLAN_DELAY"],
  30000,
);
export const QUIZ_ENABLED = process.env["QUIZ_ENABLED"] !== "false";
export const AI_API_KEY = process.env["AI_API_KEY"]?.trim() ?? "";
export type AIProvider = "openai" | "gemini" | "deepseek";
export const API_PROVIDER = parseAIProvider(process.env["API_PROVIDER"]);
export const CAN_RUN_QUIZZES = QUIZ_ENABLED && AI_API_KEY !== "";
export type LogLevel = "debug" | "info" | "warn" | "error";
export const LOG_LEVEL = parseLogLevel(process.env["LOG_LEVEL"]);
export const LOG_FILE = process.env["LOG_FILE"]?.trim() || "logs/potatfarmer.log";

function parseLogLevel(raw: string | undefined): LogLevel {
  const level = raw?.trim().toLowerCase() ?? "debug";
  if (
    level === "debug" ||
    level === "info" ||
    level === "warn" ||
    level === "error"
  )
    return level;
  throw new Error(
    `Unsupported LOG_LEVEL ${JSON.stringify(raw)}; expected debug, info, warn, or error`,
  );
}

function parseAIProvider(raw: string | undefined): AIProvider {
  const provider = raw?.trim().toLowerCase() ?? "openai";
  if (provider === "openai" || provider === "gemini" || provider === "deepseek")
    return provider;
  throw new Error(
    `Unsupported API_PROVIDER ${JSON.stringify(raw)}; expected openai, gemini, or deepseek`,
  );
}

function parseEnvNumber(raw: string | undefined, defaultValue: number): number {
  if (raw === undefined) return defaultValue;

  const trimmed = raw.trim();
  if (trimmed === "") return defaultValue;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}
