import type { Server } from "node:http";

import { run, runDisplay } from "./app/runner.js";
import { CONSOLE_STATS_ENABLED, WEB_DASHBOARD_ENABLED } from "./config.js";
import { closeDb, initDb } from "./db/index.js";
import { startServer } from "./http/server.js";
import { log } from "./logger.js";

initDb();

let httpServer: Server | null = null;

function shutdown(): void {
  log.info("Shutting down");
  if (httpServer) httpServer.close();
  closeDb();
}

const handleExit = (): void => {
  shutdown();
  process.exit(0);
};

process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);
process.on("unhandledRejection", (error) => {
  log.error("Unhandled promise rejection", error);
});
process.on("uncaughtException", (error: Error) => {
  log.error("Uncaught exception", error);
  shutdown();
  process.exit(1);
});

if (WEB_DASHBOARD_ENABLED) httpServer = startServer();
if (CONSOLE_STATS_ENABLED) void runDisplay();
await run();
