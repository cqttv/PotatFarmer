import { Actions, Rank, type RankValue } from "./plans.js";
import { record, recordBalanceChange, cache, ZERO_STATS, type StatsRow } from "./db.js";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;

function getTermWidth(): number {
  return Math.min((process.stdout.columns || 72) - 2, 90);
}

interface PlayerInfo {
  username: string;
  potatoes: number;
  prestige: number;
  harvests: number;
  steals: number;
  stolenFrom: number;
  farmSize: string;
  rank: RankValue;
  leaderboardRank: number;
  totalPlayers: number;
  lastCommand: string | null;
}

const RANK_BY_NAME = new Map<string, RankValue>([
  ["Bankrupt", Rank.Bankrupt],
  ["Backyard Garden", Rank.BackyardGarden],
  ["Greenhouse", Rank.Greenhouse],
  ["Acre Farm", Rank.AcreFarm],
  ["10 Acre Farm", Rank.TenAcreFarm],
  ["Potato Plantation", Rank.PotatoPlantation],
  ["Industrial Potato Facility", Rank.Industrial],
]);

export const playerInfo: PlayerInfo = {
  username: "",
  potatoes: 0,
  prestige: 0,
  harvests: 0,
  steals: 0,
  stolenFrom: 0,
  farmSize: "",
  rank: Rank.BackyardGarden as RankValue,
  leaderboardRank: 0,
  totalPlayers: 0,
  lastCommand: null,
};

export function updateFromRank(text: string): void {
  const username = text.match(/@(\w+)/)?.[1];
  const potatoes = text.match(/has (-?[\d,]+) potatoes/)?.[1];
  const prestige = text.match(/Prestige: (\d+)/)?.[1];
  const harvests = text.match(/Harvests: ([\d,]+)/)?.[1];
  const steals = text.match(/Stole ([\d,]+) times?/)?.[1];
  const stolenFrom = text.match(/Stolen from ([\d,]+) times?/)?.[1];
  const farmSize = text.match(/Farm: ([^●]+)/)?.[1];
  const rankMatch = text.match(/Ranked #(\d+)\/(\d+)/);

  if (username) playerInfo.username = username;
  if (potatoes) playerInfo.potatoes = parseInt(potatoes.replace(/,/g, ""), 10);
  if (prestige) playerInfo.prestige = parseInt(prestige, 10);
  if (harvests) playerInfo.harvests = parseInt(harvests.replace(/,/g, ""), 10);
  if (steals) playerInfo.steals = parseInt(steals.replace(/,/g, ""), 10);
  if (stolenFrom) playerInfo.stolenFrom = parseInt(stolenFrom.replace(/,/g, ""), 10);
  if (farmSize) {
    const trimmed = farmSize.trim();
    playerInfo.farmSize = trimmed;
    const rank = RANK_BY_NAME.get(trimmed);
    if (rank !== undefined) playerInfo.rank = rank;
  }
  if (rankMatch?.[1] && rankMatch[2]) {
    playerInfo.leaderboardRank = parseInt(rankMatch[1], 10);
    playerInfo.totalPlayers = parseInt(rankMatch[2], 10);
  }
}

// Matches the "[+N ⇒ total]" pattern in farm/steal/cdr/shop replies.
const BALANCE_REGEX = /\[([+-])([\d,]+)\s*⇒\s*(-?[\d,]+)\]/;

interface BalanceChange {
  delta: number;
  balanceAfter: number;
}

function parseBalanceChange(text: string): BalanceChange | null {
  const match = text.match(BALANCE_REGEX);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const sign = match[1] === "+" ? 1 : -1;
  return {
    delta: sign * parseInt(match[2].replace(/,/g, ""), 10),
    balanceAfter: parseInt(match[3].replace(/,/g, ""), 10),
  };
}

/** Pulls the running potato total out of a bot reply if one is present. */
export function updateBalanceFromResponse(text: string): void {
  const change = parseBalanceChange(text);
  if (!change) return;
  playerInfo.potatoes = change.balanceAfter;
}

export function setLastCommand(command: string): void {
  playerInfo.lastCommand = command;
}

const CLEAR_SEQ = "\x1Bc";

export const sessionTotals: StatsRow = { ...ZERO_STATS };
export const sessionStart = Date.now();

const TRACKED_COMMANDS: ReadonlySet<string> = new Set([Actions.FARM, Actions.STEAL, Actions.RANKUP, Actions.PRESTIGE]);

function balanceCategory(command: string): string {
  const normalized = command.toLowerCase();
  if (command === Actions.STEAL) return "steal";
  if (command === Actions.FARM) return "harvest";
  if (command === Actions.CDR || normalized.includes("cooldown") || command.startsWith("shop ")) return "shop_cdr";
  return "other";
}

function parseDelta(command: string, responseText: string, isError: boolean): number {
  if (isError) return 0;
  if (command !== Actions.FARM && command !== Actions.STEAL) return 0;

  const bracketMatch = responseText.match(/\[([+-])([\d,]+)/);
  if (bracketMatch?.[1] && bracketMatch[2]) {
    return (bracketMatch[1] === "+" ? 1 : -1) * parseInt(bracketMatch[2].replace(/,/g, ""), 10);
  }

  const potatoMatch = responseText.match(/([+-])\s*([\d,]+)\s*🥔/);
  if (potatoMatch?.[1] && potatoMatch[2]) {
    return (potatoMatch[1] === "+" ? 1 : -1) * parseInt(potatoMatch[2].replace(/,/g, ""), 10);
  }

  return 0;
}

const COOLDOWN_REGEX = /✋⏰|aren'?t ready|not ready/i;

export function recordCommandResult(command: string, responseText: string | null, isError: boolean): void {
  if (responseText === null) return;
  const balanceChange = parseBalanceChange(responseText);
  if (balanceChange) {
    playerInfo.potatoes = balanceChange.balanceAfter;
    recordBalanceChange({
      executedAt: new Date().toISOString(),
      command,
      category: balanceCategory(command),
      delta: balanceChange.delta,
      balanceAfter: balanceChange.balanceAfter,
      responseText: responseText.slice(0, 500),
    });
  }
  if (COOLDOWN_REGEX.test(responseText)) return;
  if (command === Actions.FARM && /♻⏰/.test(responseText)) return;
  if (!TRACKED_COMMANDS.has(command)) return;

  const delta = balanceChange?.delta ?? parseDelta(command, responseText, isError);

  const increment: StatsRow = {
    farm: command === Actions.FARM ? delta : 0,
    farmAttempts: command === Actions.FARM ? 1 : 0,
    farmSuccesses: command === Actions.FARM && delta > 0 ? 1 : 0,
    steal: command === Actions.STEAL ? delta : 0,
    stealAttempts: command === Actions.STEAL ? 1 : 0,
    stealSuccesses: command === Actions.STEAL && delta > 0 ? 1 : 0,
    rankups: command === Actions.RANKUP && !isError ? 1 : 0,
    prestiges: command === Actions.PRESTIGE && !isError ? 1 : 0,
  };

  record(increment);

  for (const key of Object.keys(increment) as (keyof StatsRow)[]) {
    // eslint-disable-next-line security/detect-object-injection
    sessionTotals[key] += increment[key];
  }
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\x1b\[[0-9;]*m/g;

const LABEL_WIDTH = 20;
let renderW = 0;

function tableRow(label: string, value: string, valueColor = ""): string {
  const labelCell = `  ${label}`.padEnd(LABEL_WIDTH);
  const valueSpace = renderW - LABEL_WIDTH;
  const visibleLength = value.replace(ANSI_ESCAPE, "").length;
  const padding = " ".repeat(Math.max(0, valueSpace - visibleLength));
  return `║${ANSI.dim}${labelCell}${ANSI.reset}${valueColor}${value}${ANSI.reset}${padding}║`;
}

function divider(): string {
  return `╠${"═".repeat(renderW)}╣`;
}

function sectionHeader(label: string): string {
  const inner = ` ${label} `;
  const fill = renderW - inner.length;
  const leftFill = Math.floor(fill / 2);
  const rightFill = fill - leftFill;
  return `╠${"═".repeat(leftFill)}${ANSI.cyan}${ANSI.bold}${inner}${ANSI.reset}${"═".repeat(rightFill)}╣`;
}

function formatDelta(n: number): string {
  if (n > 0) return `+${formatNumber(n)}`;
  if (n < 0) return `-${formatNumber(Math.abs(n))}`;
  return "";
}

function deltaColor(n: number): string {
  return n > 0 ? ANSI.green : n < 0 ? ANSI.red : "";
}

function successRate(successes: number, attempts: number): string {
  const pct = Math.round((successes / attempts) * 100);
  return `${formatNumber(successes)} / ${formatNumber(attempts)}  (${pct}%)`;
}

function commandStatRow(label: string, successes: number, attempts: number, delta = 0): string {
  const rate = successRate(successes, attempts);
  const d = formatDelta(delta);
  const value = d ? `${rate}   ${deltaColor(delta)}${d}${ANSI.reset}` : rate;
  return tableRow(label, value);
}

function buildStatsRows(stats: StatsRow): string[] {
  const rows: string[] = [];

  if (stats.farmAttempts > 0) rows.push(commandStatRow("Farm:", stats.farmSuccesses, stats.farmAttempts, stats.farm));
  if (stats.stealAttempts > 0) rows.push(commandStatRow("Steal:", stats.stealSuccesses, stats.stealAttempts, stats.steal));
  if (stats.rankups > 0) rows.push(tableRow("Rank Ups:", formatNumber(stats.rankups), ANSI.cyan));
  if (stats.prestiges > 0) rows.push(tableRow("Prestiges:", formatNumber(stats.prestiges), ANSI.cyan));

  if (rows.length === 0) {
    rows.push(tableRow("", "–", ANSI.dim));
  } else {
    const total = stats.farm + stats.steal;
    if (total !== 0) rows.push(tableRow("Total:", formatDelta(total), deltaColor(total)));
  }

  return rows;
}

export function displayStats(): void {
  renderW = getTermWidth();
  const W = renderW;
  const isLoaded = playerInfo.username !== "";
  const title = "POTAT FARMER";
  const leftPad = Math.floor((W - title.length) / 2);
  const rightPad = W - leftPad - title.length;

  const lines = [
    `╔${"═".repeat(W)}╗`,
    `║${" ".repeat(leftPad)}${ANSI.bold}${ANSI.yellow}${title}${ANSI.reset}${" ".repeat(rightPad)}║`,
    divider(),
    tableRow("User:", isLoaded ? playerInfo.username : "Loading...", isLoaded ? ANSI.bold : ANSI.dim),
    tableRow("Potatoes:", isLoaded ? formatNumber(playerInfo.potatoes) : "Loading...", playerInfo.potatoes < 0 ? ANSI.red : ANSI.green),
    tableRow("Prestige:", isLoaded ? formatNumber(playerInfo.prestige) : "Loading..."),
    tableRow("Farm:", isLoaded ? playerInfo.farmSize : "Loading..."),
    tableRow("Rank:", isLoaded ? `#${formatNumber(playerInfo.leaderboardRank)} / ${formatNumber(playerInfo.totalPlayers)}` : "Loading..."),
    tableRow("Harvests:", isLoaded ? formatNumber(playerInfo.harvests) : "Loading..."),
    tableRow("Steals:", isLoaded ? formatNumber(playerInfo.steals) : "Loading..."),
    tableRow("Stolen From:", isLoaded ? formatNumber(playerInfo.stolenFrom) : "Loading..."),
    sectionHeader(`Session  ${formatDuration(Date.now() - sessionStart)}`),
    ...buildStatsRows(sessionTotals),
    sectionHeader("Today"),
    ...buildStatsRows(cache.today),
    sectionHeader("Last 7 Days"),
    ...buildStatsRows(cache.week),
    sectionHeader("All Time"),
    ...buildStatsRows(cache.totals),
    divider(),
    tableRow("Last Command:", playerInfo.lastCommand ?? "–", ANSI.yellow),
    `╚${"═".repeat(W)}╝`,
  ];

  process.stdout.write(CLEAR_SEQ + lines.join("\n") + "\n");
}
