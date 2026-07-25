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
export const COMMAND_DELAY = parseEnvNumber(
  process.env["COMMAND_DELAY"],
  15000,
);
export const PLAN_DELAY = parseEnvNumber(process.env["PLAN_DELAY"], 60000);

function parseEnvNumber(raw: string | undefined, defaultValue: number): number {
  if (raw === undefined) return defaultValue;

  const trimmed = raw.trim();
  if (trimmed === "") return defaultValue;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}
