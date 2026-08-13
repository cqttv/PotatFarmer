import { Actions } from "../plans.js";

export interface BalanceChange {
  delta: number;
  balanceAfter: number;
}

const BALANCE_REGEX = /\[([+-])([\d,]+)\s*⇒\s*(-?[\d,]+)\]/;

export function parseBalanceChange(text: string): BalanceChange | null {
  const match = text.match(BALANCE_REGEX);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const sign = match[1] === "+" ? 1 : -1;
  return {
    delta: sign * parseInt(match[2].replace(/,/g, ""), 10),
    balanceAfter: parseInt(match[3].replace(/,/g, ""), 10),
  };
}

export function eventCategory(command: string): string {
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

export function parseDelta(command: string, responseText: string): number {
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
