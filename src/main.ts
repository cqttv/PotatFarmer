import type { Server } from "node:http";

import { sendCommand, fetchRank } from "./api.js";
import {
  WEB_DASHBOARD_ENABLED,
  CONSOLE_STATS_ENABLED,
  BOT_PREFIX,
  PLAN_DELAY,
  CAN_RUN_QUIZZES,
} from "./config.js";
import { initDb, closeDb } from "./db.js";
import { startServer } from "./http.js";
import {
  Actions,
  LevelsPlan,
  ShoppingPlan,
  FarmPlan,
  QuizShoppingPlan,
  shouldRun,
  type CommandPlan,
} from "./plans.js";
import { runQuizPlan } from "./quiz.js";
import {
  displayStats,
  playerInfo,
  recordCommandResult,
  setLastCommand,
  updateFromRank,
} from "./stats.js";

initDb();

let httpServer: Server | null = null;

function shutdown(): void {
  if (httpServer) httpServer.close();
  closeDb();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const handleExit = (): void => {
  shutdown();
  process.exit(0);
};
process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);
process.on("unhandledRejection", (err) => {
  process.stderr.write(`unhandledRejection: ${String(err)}\n`);
});
process.on("uncaughtException", (err: Error) => {
  process.stderr.write(`uncaughtException: ${err.message}\n`);
  shutdown();
  process.exit(1);
});

async function refreshRank(): Promise<void> {
  const text = await fetchRank();
  if (text) updateFromRank(text);
}

async function runPlan(plan: CommandPlan): Promise<void> {
  for (const step of plan) {
    if (!shouldRun(step.command, playerInfo)) {
      await sleep(step.delay);
      continue;
    }
    try {
      const result = await sendCommand(step.command);
      if (result.text !== null) setLastCommand(`${BOT_PREFIX}${step.command}`);
      recordCommandResult(step.command, result.text, result.isError);

      // Prestige zeros your balance, re-fetch immediately
      if (
        step.command === Actions.PRESTIGE &&
        !result.isError &&
        result.text !== null
      ) {
        await refreshRank();
      }
    } catch (err) {
      process.stderr.write(`command "${step.command}": ${String(err)}\n`);
    }
    await sleep(step.delay);
  }
}

async function runDisplay(): Promise<never> {
  for (;;) {
    displayStats();
    await sleep(1000);
  }
}

async function run(): Promise<never> {
  await refreshRank();
  for (;;) {
    await runPlan(LevelsPlan);
    await runPlan(ShoppingPlan);
    await runPlan(FarmPlan);
    if (CAN_RUN_QUIZZES) {
      const quizResult = await runQuizPlan();
      if (quizResult === "completed") await runPlan(QuizShoppingPlan);
    }
    await refreshRank();
    await sleep(PLAN_DELAY);
  }
}

if (WEB_DASHBOARD_ENABLED) httpServer = startServer();
if (CONSOLE_STATS_ENABLED) void runDisplay();
await run();
