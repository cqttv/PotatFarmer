import { cache, type StatsRow } from "../db/index.js";

import { playerInfo } from "./player.js";
import { sessionStart, sessionTotals } from "./recording.js";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
} as const;
const CLEAR_SEQUENCE = "\x1Bc";
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\x1b\[[0-9;]*m/g;
const LABEL_WIDTH = 20;
let renderWidth = 0;

function terminalWidth(): number {
  return Math.min((process.stdout.columns || 72) - 2, 90);
}

function formatNumber(value: number): string {
  return value.toLocaleString();
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

function tableRow(label: string, value: string, valueColor = ""): string {
  const labelCell = `  ${label}`.padEnd(LABEL_WIDTH);
  const valueSpace = renderWidth - LABEL_WIDTH;
  const visibleLength = value.replace(ANSI_ESCAPE, "").length;
  const padding = " ".repeat(Math.max(0, valueSpace - visibleLength));
  return `║${ANSI.dim}${labelCell}${ANSI.reset}${valueColor}${value}${ANSI.reset}${padding}║`;
}

function divider(): string {
  return `╠${"═".repeat(renderWidth)}╣`;
}

function sectionHeader(label: string): string {
  const inner = ` ${label} `;
  const fill = renderWidth - inner.length;
  const leftFill = Math.floor(fill / 2);
  const rightFill = fill - leftFill;
  return `╠${"═".repeat(leftFill)}${ANSI.cyan}${ANSI.bold}${inner}${ANSI.reset}${"═".repeat(rightFill)}╣`;
}

function formatDelta(value: number): string {
  if (value > 0) return `+${formatNumber(value)}`;
  if (value < 0) return `-${formatNumber(Math.abs(value))}`;
  return "";
}

function deltaColor(value: number): string {
  return value > 0 ? ANSI.green : value < 0 ? ANSI.red : "";
}

function successRate(successes: number, attempts: number): string {
  const percentage = Math.round((successes / attempts) * 100);
  return `${formatNumber(successes)} / ${formatNumber(attempts)}  (${percentage}%)`;
}

function commandStatRow(
  label: string,
  successes: number,
  attempts: number,
  delta = 0,
): string {
  const rate = successRate(successes, attempts);
  const formattedDelta = formatDelta(delta);
  const value = formattedDelta
    ? `${rate}   ${deltaColor(delta)}${formattedDelta}${ANSI.reset}`
    : rate;
  return tableRow(label, value);
}

function buildStatsRows(stats: StatsRow): string[] {
  const rows: string[] = [];
  if (stats.farmAttempts > 0) {
    rows.push(
      commandStatRow(
        "Farm:",
        stats.farmSuccesses,
        stats.farmAttempts,
        stats.farm,
      ),
    );
  }
  if (stats.stealAttempts > 0) {
    rows.push(
      commandStatRow(
        "Steal:",
        stats.stealSuccesses,
        stats.stealAttempts,
        stats.steal,
      ),
    );
  }
  if (stats.gambleAttempts > 0) {
    rows.push(
      commandStatRow(
        "Gamble:",
        stats.gambleWins,
        stats.gambleAttempts,
        stats.gamble,
      ),
    );
  }
  if (stats.rankups > 0) {
    rows.push(tableRow("Rank Ups:", formatNumber(stats.rankups), ANSI.cyan));
  }
  if (stats.prestiges > 0) {
    rows.push(tableRow("Prestiges:", formatNumber(stats.prestiges), ANSI.cyan));
  }
  if (stats.quizAttempts > 0) {
    rows.push(
      commandStatRow(
        "Quizzes:",
        stats.quizSuccesses,
        stats.quizAttempts,
        stats.quizReward,
      ),
      tableRow(
        "Quiz Outcomes:",
        `${formatNumber(stats.quizSuccesses)} correct, ${formatNumber(stats.quizFailures)} failed`,
      ),
    );
  }
  if (stats.quizAnswerAttempts > 0) {
    rows.push(
      tableRow(
        "Quiz Answers:",
        `${formatNumber(stats.quizAnswerAttempts)}  (${formatNumber(stats.quizIncorrectAnswers)} incorrect, ${formatNumber(stats.quizCacheHits)} cached, ${formatNumber(stats.quizApiCalls)} API)`,
      ),
    );
  }

  if (rows.length === 0) {
    rows.push(tableRow("", "–", ANSI.dim));
  } else {
    const total = stats.farm + stats.steal + stats.gamble + stats.quizReward;
    if (total !== 0) {
      rows.push(tableRow("Total:", formatDelta(total), deltaColor(total)));
    }
  }
  return rows;
}

export function displayStats(): void {
  renderWidth = terminalWidth();
  const width = renderWidth;
  const isLoaded = playerInfo.username !== "";
  const title = "POTAT FARMER";
  const leftPad = Math.floor((width - title.length) / 2);
  const rightPad = width - leftPad - title.length;
  const loadingText = "Loading...";

  const lines = [
    `╔${"═".repeat(width)}╗`,
    `║${" ".repeat(leftPad)}${ANSI.bold}${ANSI.yellow}${title}${ANSI.reset}${" ".repeat(rightPad)}║`,
    divider(),
    tableRow(
      "User:",
      isLoaded ? playerInfo.username : loadingText,
      isLoaded ? ANSI.bold : ANSI.dim,
    ),
    tableRow(
      "Potatoes:",
      isLoaded ? formatNumber(playerInfo.potatoes) : loadingText,
      playerInfo.potatoes < 0 ? ANSI.red : ANSI.green,
    ),
    tableRow(
      "Prestige:",
      isLoaded ? formatNumber(playerInfo.prestige) : loadingText,
    ),
    tableRow("Farm:", isLoaded ? playerInfo.farmSize : loadingText),
    tableRow(
      "Rank:",
      isLoaded
        ? `#${formatNumber(playerInfo.leaderboardRank)} / ${formatNumber(playerInfo.totalPlayers)}`
        : loadingText,
    ),
    tableRow(
      "Harvests:",
      isLoaded ? formatNumber(playerInfo.harvests) : loadingText,
    ),
    tableRow(
      "Steals:",
      isLoaded ? formatNumber(playerInfo.steals) : loadingText,
    ),
    tableRow(
      "Stolen From:",
      isLoaded ? formatNumber(playerInfo.stolenFrom) : loadingText,
    ),
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
    `╚${"═".repeat(width)}╝`,
  ];

  process.stdout.write(CLEAR_SEQUENCE + lines.join("\n") + "\n");
}
