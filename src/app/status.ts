import { CAN_RUN_QUIZZES } from "../config.js";
import { Actions, type Command } from "../plans.js";

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

export type CooldownStatus = Partial<Record<StatusLabel, boolean>>;

const STATUS_LABELS: ReadonlySet<string> = new Set<StatusLabel>([
  "Potato",
  "Cooldown",
  "Steal",
  "Eat",
  "Quiz",
  "Shop-Quiz",
  "Shop-Cdr",
  "Shop-Fertilizer",
  "Shop-Guard",
]);

export function parseStatus(text: string): CooldownStatus {
  const status: CooldownStatus = {};
  for (const segment of text.split(" ● ")) {
    const separator = segment.indexOf(":");
    if (separator < 0) continue;
    const label = segment.slice(0, separator).trim();
    if (!STATUS_LABELS.has(label)) continue;
    const ready = segment
      .slice(separator + 1)
      .trim()
      .startsWith("✅");
    status[label as StatusLabel] = ready;
  }
  return status;
}

export function buildQueueFromStatus(status: CooldownStatus): Command[] {
  const queue: Command[] = [];
  const farmReady = status.Potato === true;
  const stealReady = status.Steal === true;
  const cdrReady = status.Cooldown === true;
  const farmCoolingDown = status.Potato === false;
  const stealCoolingDown = status.Steal === false;
  const cdrCoolingDown = status.Cooldown === false;

  if (farmCoolingDown && stealCoolingDown) {
    if (cdrReady) queue.push(Actions.CDR);
    else if (cdrCoolingDown && status["Shop-Cdr"] === true) {
      queue.push(Actions.SHOP_CDR);
    }
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
