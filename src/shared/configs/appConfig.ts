export const BEARER_TOKEN =
  process.env["BEARER_TOKEN"] ??
  ((): string => {
    throw new Error("Missing BEARER_TOKEN env var");
  })();
export const API_URL =
  process.env["API_URL"] ?? "https://api.potat.app/execute";
export const BOT_PREFIX = process.env["BOT_PREFIX"] ?? "#";
export const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";
