import type { Server } from "node:http";

import { sendCommand, fetchRank } from "./api.js";
import {
  WEB_DASHBOARD_ENABLED,
  CONSOLE_STATS_ENABLED,
  BOT_PREFIX,
  COMMAND_DELAY,
  STATUS_INTERVAL,
  CAN_RUN_QUIZZES,
} from "./config.js";
import { initDb, closeDb } from "./db.js";
import { startServer } from "./http.js";
import { Actions, shouldRun, type Command } from "./plans.js";
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

type StatusLabel =
  | "Potato"
  | "Cooldown"
  | "Steal"
  | "Eat"
  | "Quiz"
  | "Shop-Quiz"
  | "Shop-Cdr"
  | "Shop-Fertilizer"
  | "Shop-Guard";
type CooldownStatus = Partial<Record<StatusLabel, boolean>>;

function parseStatus(text: string): CooldownStatus {
  const status: CooldownStatus = {};
  for (const segment of text.split(" ● ")) {
    const separator = segment.indexOf(":");
    if (separator < 0) continue;
    const label = segment.slice(0, separator).trim();
    const ready = segment
      .slice(separator + 1)
      .trim()
      .startsWith("✅");
    switch (label) {
      case "Potato":
        status.Potato = ready;
        break;
      case "Cooldown":
        status.Cooldown = ready;
        break;
      case "Steal":
        status.Steal = ready;
        break;
      case "Eat":
        status.Eat = ready;
        break;
      case "Quiz":
        status.Quiz = ready;
        break;
      case "Shop-Quiz":
        status["Shop-Quiz"] = ready;
        break;
      case "Shop-Cdr":
        status["Shop-Cdr"] = ready;
        break;
      case "Shop-Fertilizer":
        status["Shop-Fertilizer"] = ready;
        break;
      case "Shop-Guard":
        status["Shop-Guard"] = ready;
        break;
    }
  }
  return status;
}

function hasReadyMarker(
  text: string | null,
  marker: "rankup" | "prestige",
): boolean {
  return text?.toLowerCase().includes(`ready to ${marker}`) ?? false;
}

interface ExecutedCommand {
  succeeded: boolean;
  text: string | null;
  rankupReady: boolean;
  prestigeReady: boolean;
}

async function executeCommand(command: Command): Promise<ExecutedCommand> {
  if (!shouldRun(command, playerInfo)) {
    return {
      succeeded: false,
      text: null,
      rankupReady: false,
      prestigeReady: false,
    };
  }

  try {
    const result = await sendCommand(command);
    if (result.text !== null) setLastCommand(`${BOT_PREFIX}${command}`);
    recordCommandResult(command, result.text, result.isError);
    if (
      (command === Actions.RANKUP || command === Actions.PRESTIGE) &&
      !result.isError
    )
      await refreshRank();
    return {
      succeeded: !result.isError && result.text !== null,
      text: result.text,
      rankupReady: hasReadyMarker(result.text, "rankup"),
      prestigeReady: hasReadyMarker(result.text, "prestige"),
    };
  } catch (err) {
    process.stderr.write(`command "${command}": ${String(err)}\n`);
    return {
      succeeded: false,
      text: null,
      rankupReady: false,
      prestigeReady: false,
    };
  }
}

function buildQueueFromStatus(status: CooldownStatus): Command[] {
  const queue: Command[] = [];
  const farmReady = status.Potato === true;
  const stealReady = status.Steal === true;
  const cdrReady = status.Cooldown === true;
  const farmCoolingDown = status.Potato === false;
  const stealCoolingDown = status.Steal === false;
  const cdrCoolingDown = status.Cooldown === false;

  if (farmCoolingDown && stealCoolingDown) {
    if (cdrReady) queue.push(Actions.CDR);
    else if (cdrCoolingDown && status["Shop-Cdr"] === true)
      queue.push(Actions.SHOP_CDR);
  }

  if (status["Shop-Guard"] === true) queue.push(Actions.SHOP_GUARD);
  if (status["Shop-Fertilizer"] === true) queue.push(Actions.SHOP_FERTILIZER);
  if (status.Eat === true) queue.push(Actions.EAT);
  if (!(farmCoolingDown && stealCoolingDown)) {
    if (farmReady) queue.push(Actions.FARM);
    if (stealReady) queue.push(Actions.STEAL);
  }

  if (CAN_RUN_QUIZZES) {
    if (status.Quiz === true) queue.push(Actions.QUIZ);
    else if (status["Shop-Quiz"] === true) queue.push(Actions.SHOP_QUIZ);
  }
  return queue;
}

async function runStatusCycle(): Promise<void> {
  const statusResult = await executeCommand(Actions.STATUS);
  if (!statusResult.succeeded || !statusResult.text) return;

  const queue = buildQueueFromStatus(parseStatus(statusResult.text));
  const queued = new Set<Command>(queue);

  const enqueue = (command: Command, next = false): void => {
    if (!queued.has(command)) {
      queued.add(command);
      if (next) queue.splice(index + 1, 0, command);
      else queue.push(command);
    }
  };

  let index = 0;
  for (; index < queue.length; index += 1) {
    const command = queue.at(index);
    if (!command) continue;
    await sleep(COMMAND_DELAY);

    let result: ExecutedCommand;
    if (command === Actions.QUIZ) {
      const quizResult = await runQuizPlan();
      result = {
        succeeded: quizResult === "completed",
        text: null,
        rankupReady: false,
        prestigeReady: false,
      };
    } else {
      result = await executeCommand(command);
    }

    if (result.prestigeReady) enqueue(Actions.PRESTIGE, true);
    else if (result.rankupReady) enqueue(Actions.RANKUP, true);

    if (result.succeeded && command === Actions.SHOP_CDR)
      enqueue(Actions.CDR, true);
    if (result.succeeded && command === Actions.CDR) {
      enqueue(Actions.FARM);
      enqueue(Actions.STEAL);
    }
    if (result.succeeded && command === Actions.SHOP_QUIZ)
      enqueue(Actions.QUIZ, true);

    // Prestige resets all relevant cooldowns, so discard the stale queue.
    if (result.succeeded && command === Actions.PRESTIGE) return;
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
    await runStatusCycle();
    await sleep(STATUS_INTERVAL);
  }
}

if (WEB_DASHBOARD_ENABLED) httpServer = startServer();
if (CONSOLE_STATS_ENABLED) void runDisplay();
await run();
