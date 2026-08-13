import {
  CAN_RUN_QUIZZES,
  COMMAND_DELAY,
  CONSOLE_STATS_ENABLED,
  STATUS_INTERVAL,
  WEB_DASHBOARD_ENABLED,
} from "../config.js";
import { log } from "../logger.js";
import { Actions, type Command } from "../plans.js";
import { runQuizPlan } from "../quiz/runner.js";
import { displayStats } from "../stats/console.js";

import { CommandQueue, scheduleFollowUps } from "./command-queue.js";
import {
  executeCommand,
  refreshRank,
  type ExecutedCommand,
} from "./command-executor.js";
import { sleep } from "./sleep.js";
import { buildQueueFromStatus, parseStatus } from "./status.js";

async function runStatusCycle(): Promise<void> {
  const cycleStartedAt = Date.now();
  log.debug("Starting status cycle");
  const statusResult = await executeCommand(Actions.STATUS);
  if (!statusResult.succeeded || !statusResult.text) {
    log.warn("Status cycle stopped without a usable status response");
    return;
  }

  const status = parseStatus(statusResult.text);
  const queue = new CommandQueue(buildQueueFromStatus(status));
  log.info("Status queue built", { status, queue: queue.snapshot() });

  for (let command: Command | null; (command = queue.takeNext()) !== null; ) {
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

    scheduleFollowUps(queue, command, result);

    if (result.succeeded && command === Actions.PRESTIGE) {
      log.info("Status cycle ended after prestige", {
        durationMs: Date.now() - cycleStartedAt,
      });
      return;
    }
  }
  log.debug("Status cycle completed", {
    durationMs: Date.now() - cycleStartedAt,
    commandsProcessed: queue.processedCount,
  });
}

export async function runDisplay(): Promise<never> {
  for (;;) {
    displayStats();
    await sleep(1000);
  }
}

export async function run(): Promise<never> {
  log.info("PotatFarmer started", {
    statusIntervalMs: STATUS_INTERVAL,
    commandDelayMs: COMMAND_DELAY,
    quizzesEnabled: CAN_RUN_QUIZZES,
    webDashboardEnabled: WEB_DASHBOARD_ENABLED,
    consoleStatsEnabled: CONSOLE_STATS_ENABLED,
  });
  for (;;) {
    await refreshRank();
    await sleep(COMMAND_DELAY);
    await runStatusCycle();
    await sleep(STATUS_INTERVAL);
  }
}
