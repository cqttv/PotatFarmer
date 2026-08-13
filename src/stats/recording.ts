import {
  addToStats,
  record,
  recordEvent,
  type StatsRow,
  ZERO_STATS,
} from "../db/index.js";
import { log } from "../logger.js";
import { Actions } from "../plans.js";

import {
  eventCategory,
  parseBalanceChange,
  parseDelta,
} from "./command-result.js";
import { playerInfo } from "./player.js";

export const sessionTotals: StatsRow = { ...ZERO_STATS };
export const sessionStart = Date.now();

const TRACKED_COMMANDS: ReadonlySet<string> = new Set([
  Actions.FARM,
  Actions.STEAL,
  Actions.RANKUP,
  Actions.PRESTIGE,
]);
const COOLDOWN_REGEX = /✋⏰|aren'?t ready|not ready/i;

export function recordQuizStats(
  increment: Partial<
    Pick<
      StatsRow,
      | "quizReward"
      | "quizAttempts"
      | "quizSuccesses"
      | "quizFailures"
      | "quizAnswerAttempts"
      | "quizIncorrectAnswers"
      | "quizCacheHits"
      | "quizApiCalls"
    >
  >,
): void {
  const stats = { ...ZERO_STATS, ...increment };
  record(stats);
  addToStats(sessionTotals, stats);
}

export function recordCommandResult(
  command: string,
  responseText: string | null,
  isError: boolean,
): boolean {
  if (command === Actions.STATUS || responseText === null) return false;
  if (COOLDOWN_REGEX.test(responseText)) {
    log.debug("Ignoring cooldown response for stats", { command });
    return false;
  }
  if (command === Actions.FARM && /♻⏰/.test(responseText)) {
    log.debug("Ignoring recycled farm response for stats", { command });
    return false;
  }

  const balanceChange = parseBalanceChange(responseText);
  // PotatBotat reports failed steals as API errors after applying their loss.
  // A full balance transition proves that the command changed game state.
  if (isError && balanceChange === null) return false;

  const delta = balanceChange?.delta ?? parseDelta(command, responseText);
  if (balanceChange) playerInfo.potatoes = balanceChange.balanceAfter;
  else if (command === Actions.EAT) playerInfo.potatoes += delta;

  recordEvent({
    executedAt: new Date().toISOString(),
    command,
    category: eventCategory(command),
    delta,
    balanceAfter: playerInfo.potatoes,
    responseText: responseText.slice(0, 500),
  });
  if (!TRACKED_COMMANDS.has(command)) return true;

  const increment: StatsRow = {
    ...ZERO_STATS,
    farm: command === Actions.FARM ? delta : 0,
    farmAttempts: command === Actions.FARM ? 1 : 0,
    farmSuccesses: command === Actions.FARM && delta > 0 ? 1 : 0,
    steal: command === Actions.STEAL ? delta : 0,
    stealAttempts: command === Actions.STEAL ? 1 : 0,
    stealSuccesses: command === Actions.STEAL && delta > 0 ? 1 : 0,
    rankups: command === Actions.RANKUP ? 1 : 0,
    prestiges: command === Actions.PRESTIGE ? 1 : 0,
  };
  record(increment);
  addToStats(sessionTotals, increment);
  log.debug("Command stats recorded", { command, isError, delta, increment });
  return true;
}
