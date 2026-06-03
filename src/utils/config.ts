export const BEARER_TOKEN =
  process.env["BEARER_TOKEN"] ??
  ((): string => {
    throw new Error("Missing BEARER_TOKEN env var");
  })();
export const API_URL = process.env["API_URL"] ?? "https://api.potat.app/execute";
export const BOT_PREFIX = process.env["BOT_PREFIX"] ?? "#";
export const WEB_PORT = parseInt(process.env["WEB_PORT"] ?? "3000", 10);
export const WEB_DASHBOARD_ENABLED = process.env["WEB_DASHBOARD_ENABLED"] !== "false";
