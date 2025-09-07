import type { CommandPlan } from "@domain/types";
import { logger, sleep } from "@shared/utils";
import { sendCommand } from "@infrastructure/api";

export async function runPlan(plan: CommandPlan): Promise<void> {
  logger.info(`Running plan: ${plan.name}`);
  for (const { command, delay } of plan.commands) {
    try {
      logger.debug(`Executing command: ${command}`);
      await sendCommand(command);
    } catch (err) {
      logger.error(`Command "${command}": ${String(err)}`);
    }
    await sleep(delay);
  }
}
