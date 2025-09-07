export const BEARER_TOKEN =
  process.env["BEARER_TOKEN"] ??
  ((): string => {
    throw new Error("Missing BEARER_TOKEN env var");
  })();
export const API_URL =
  process.env["API_URL"] ?? "https://api.potat.app/execute";
export const BOT_PREFIX = process.env["BOT_PREFIX"] ?? "#";
export const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";

export const FIFTEEN_SECONDS_MS = 15 * 1000;
export const THIRTY_SECONDS_MS = 30 * 1000;
export const MINUTE_MS = 60 * 1000;
export const HOUR_MS = 60 * MINUTE_MS;
