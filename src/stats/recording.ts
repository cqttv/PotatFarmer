import {
  addToStats,
  record,
  recordEvent,
  type StatsRow,
  ZERO_STATS,
} from "../db/index.js";
import { log } from "../logger.js";
import { Actions } from "../plans.js";

import { playerInfo } from "./player.js";

interface BalanceChange {
  delta: number;
  balanceAfter: number;
}

export const sessionTotals: StatsRow = { ...ZERO_STATS };
export const sessionStart = Date.now();

const TRACKED_COMMANDS: ReadonlySet<string> = new Set([
  Actions.FARM,
  Actions.STEAL,
  Actions.RANKUP,
  Actions.PRESTIGE,
]);
const BALANCE_REGEX = /\[([+-])([\d,]+)\s*⇒\s*(-?[\d,]+)\]/;
const COOLDOWN_REGEX = /✋⏰|aren'?t ready|not ready/i;

function parseBalanceChange(text: string): BalanceChange | null {
  const match = text.match(BALANCE_REGEX);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const sign = match[1] === "+" ? 1 : -1;
  return {
    delta: sign * parseInt(match[2].replace(/,/g, ""), 10),
    balanceAfter: parseInt(match[3].replace(/,/g, ""), 10),
  };
}

function eventCategory(command: string): string {
  if (command === Actions.STEAL) return "steal";
  if (command === Actions.FARM) return "harvest";
  if (command === Actions.RANKUP) return "rankup";
  if (command === Actions.PRESTIGE) return "prestige";
  if (
    command === Actions.CDR ||
    command === Actions.EAT ||
    command.startsWith("shop ")
  ) {
    return "spending";
  }
  return "other";
}

function parseDelta(command: string, responseText: string): number {
  if (command !== Actions.FARM && command !== Actions.STEAL) return 0;

  const bracketMatch = responseText.match(/\[([+-])([\d,]+)/);
  if (bracketMatch?.[1] && bracketMatch[2]) {
    return (
      (bracketMatch[1] === "+" ? 1 : -1) *
      parseInt(bracketMatch[2].replace(/,/g, ""), 10)
    );
  }

  const potatoMatch = responseText.match(/([+-])\s*([\d,]+)\s*🥔/);
  if (potatoMatch?.[1] && potatoMatch[2]) {
    return (
      (potatoMatch[1] === "+" ? 1 : -1) *
      parseInt(potatoMatch[2].replace(/,/g, ""), 10)
    );
  }
  return 0;
}

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
): void {
  if (command === Actions.STATUS || responseText === null || isError) return;
  if (COOLDOWN_REGEX.test(responseText)) {
    log.debug("Ignoring cooldown response for stats", { command });
    return;
  }
  if (command === Actions.FARM && /♻⏰/.test(responseText)) {
    log.debug("Ignoring recycled farm response for stats", { command });
    return;
  }

  const balanceChange = parseBalanceChange(responseText);
  if (balanceChange) playerInfo.potatoes = balanceChange.balanceAfter;
  const delta = balanceChange?.delta ?? parseDelta(command, responseText);

  recordEvent({
    executedAt: new Date().toISOString(),
    command,
    category: eventCategory(command),
    delta,
    balanceAfter: balanceChange?.balanceAfter ?? playerInfo.potatoes,
    responseText: responseText.slice(0, 500),
  });
  if (!TRACKED_COMMANDS.has(command)) return;

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
}
