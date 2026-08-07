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
import { formatLogText, log } from "./logger.js";
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
  log.info("Shutting down");
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
  log.error("Unhandled promise rejection", err);
});
process.on("uncaughtException", (err: Error) => {
  log.error("Uncaught exception", err);
  shutdown();
  process.exit(1);
});

async function refreshRank(): Promise<void> {
  const text = await fetchRank();
  if (text) {
    updateFromRank(text);
    log.debug("Player rank refreshed", {
      rank: playerInfo.rank,
      prestige: playerInfo.prestige,
      potatoes: playerInfo.potatoes,
    });
  }
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
    log.info("Command skipped by plan guard", {
      command,
      potatoes: playerInfo.potatoes,
      rank: playerInfo.rank,
      prestige: playerInfo.prestige,
    });
    return {
      succeeded: false,
      text: null,
      rankupReady: false,
      prestigeReady: false,
    };
  }

  try {
    const startedAt = Date.now();
    const result = await sendCommand(command);
    if (result.text !== null && command !== Actions.STATUS) {
      setLastCommand(`${BOT_PREFIX}${command}`);
    }
    recordCommandResult(command, result.text, result.isError);
    if (
      (command === Actions.RANKUP || command === Actions.PRESTIGE) &&
      !result.isError
    )
      await refreshRank();
    const executed = {
      succeeded: !result.isError && result.text !== null,
      text: result.text,
      rankupReady: hasReadyMarker(result.text, "rankup"),
      prestigeReady: hasReadyMarker(result.text, "prestige"),
    };
    log.info("Command executed", {
      command,
      succeeded: executed.succeeded,
      isError: result.isError,
      durationMs: Date.now() - startedAt,
      response: formatLogText(result.text),
    });
    return executed;
  } catch (err) {
    log.error("Command execution failed", err, { command });
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
  const cycleStartedAt = Date.now();
  log.debug("Starting status cycle");
  const statusResult = await executeCommand(Actions.STATUS);
  if (!statusResult.succeeded || !statusResult.text) {
    log.warn("Status cycle stopped without a usable status response");
    return;
  }

  const status = parseStatus(statusResult.text);
  const queue = buildQueueFromStatus(status);
  log.info("Status queue built", { status, queue });
  const queued = new Set<Command>(queue);

  const enqueue = (command: Command, next = false): void => {
    if (!queued.has(command)) {
      queued.add(command);
      if (next) queue.splice(index + 1, 0, command);
      else queue.push(command);
      log.debug("Command added to active queue", { command, next, queue });
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
      log.info("Quiz plan finished", { result: quizResult });
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
    if (result.succeeded && command === Actions.PRESTIGE) {
      log.info("Status cycle ended after prestige", {
        durationMs: Date.now() - cycleStartedAt,
      });
      return;
    }
  }
  log.debug("Status cycle completed", {
    durationMs: Date.now() - cycleStartedAt,
    commandsProcessed: queue.length,
  });
}

async function runDisplay(): Promise<never> {
  for (;;) {
    displayStats();
    await sleep(1000);
  }
}

async function run(): Promise<never> {
  log.info("PotatFarmer started", {
    statusIntervalMs: STATUS_INTERVAL,
    commandDelayMs: COMMAND_DELAY,
    quizzesEnabled: CAN_RUN_QUIZZES,
    webDashboardEnabled: WEB_DASHBOARD_ENABLED,
    consoleStatsEnabled: CONSOLE_STATS_ENABLED,
  });
  await refreshRank();
  for (;;) {
    await runStatusCycle();
    await sleep(STATUS_INTERVAL);
  }
}

if (WEB_DASHBOARD_ENABLED) httpServer = startServer();
if (CONSOLE_STATS_ENABLED) void runDisplay();
await run();
