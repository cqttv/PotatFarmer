import {
  type DatabaseSync,
  type SQLInputValue,
  type StatementSync,
} from "node:sqlite";

import type { StatsRow } from "./types.js";

export const STATS_KEYS = [
  "farm",
  "farmAttempts",
  "farmSuccesses",
  "steal",
  "stealAttempts",
  "stealSuccesses",
  "rankups",
  "prestiges",
  "quizReward",
  "quizAttempts",
  "quizSuccesses",
  "quizFailures",
  "quizAnswerAttempts",
  "quizIncorrectAnswers",
  "quizCacheHits",
  "quizApiCalls",
] as const satisfies readonly (keyof StatsRow)[];

export const ZERO_STATS: StatsRow = Object.fromEntries(
  STATS_KEYS.map((key) => [key, 0]),
) as unknown as StatsRow;

export interface StatsCache {
  totals: StatsRow;
  today: StatsRow;
  week: StatsRow;
}

interface StatsQueries {
  updateTotals: StatementSync;
  upsertDaily: StatementSync;
  getTotals: StatementSync;
  getDaily: StatementSync;
  getWeek: StatementSync;
}

export interface StatsStore {
  loadCache: () => void;
  record: (stats: StatsRow) => void;
}

function todayString(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function weekStartString(now: Date): string {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - 6);
  return date.toISOString().slice(0, 10);
}

export function addToStats(target: StatsRow, source: StatsRow): void {
  for (const key of STATS_KEYS) {
    // eslint-disable-next-line security/detect-object-injection
    target[key] += source[key];
  }
}

function prepareQueries(db: DatabaseSync): StatsQueries {
  const columns = STATS_KEYS.join(", ");
  const parameters = STATS_KEYS.map((key) => `@${key}`).join(", ");
  const increments = STATS_KEYS.map((key) => `${key} = ${key} + @${key}`).join(
    ", ",
  );
  const dailyIncrements = STATS_KEYS.map(
    (key) => `${key} = ${key} + excluded.${key}`,
  ).join(", ");
  const weeklyColumns = STATS_KEYS.map(
    (key) => `COALESCE(SUM(${key}), 0) AS ${key}`,
  ).join(", ");

  return {
    updateTotals: db.prepare(`UPDATE totals SET ${increments} WHERE id = 1`),
    upsertDaily: db.prepare(`
      INSERT INTO daily (date, ${columns}) VALUES (@date, ${parameters})
      ON CONFLICT(date) DO UPDATE SET ${dailyIncrements}
    `),
    getTotals: db.prepare(`SELECT ${columns} FROM totals WHERE id = 1`),
    getDaily: db.prepare(`SELECT ${columns} FROM daily WHERE date = ?`),
    getWeek: db.prepare(`SELECT ${weeklyColumns} FROM daily WHERE date >= ?`),
  };
}

function readStats(
  statement: StatementSync,
  ...args: SQLInputValue[]
): StatsRow {
  return (
    (statement.get(...args) as unknown as StatsRow | undefined) ?? {
      ...ZERO_STATS,
    }
  );
}

export function createStatsStore(
  db: DatabaseSync,
  cache: StatsCache,
  now: () => Date = () => new Date(),
): StatsStore {
  const queries = prepareQueries(db);
  let lastRecordDate = "";

  return {
    loadCache(): void {
      const currentDate = now();
      const today = todayString(currentDate);
      cache.totals = readStats(queries.getTotals);
      cache.today = readStats(queries.getDaily, today);
      cache.week = readStats(queries.getWeek, weekStartString(currentDate));
      lastRecordDate = today;
    },
    record(stats): void {
      const currentDate = now();
      const date = todayString(currentDate);
      const rolledOver = date !== lastRecordDate;
      queries.updateTotals.run(
        stats as unknown as Record<string, SQLInputValue>,
      );
      queries.upsertDaily.run({
        ...stats,
        date,
      } as unknown as Record<string, SQLInputValue>);

      if (rolledOver) {
        lastRecordDate = date;
        cache.today = { ...ZERO_STATS };
        cache.week = readStats(queries.getWeek, weekStartString(currentDate));
      }
      addToStats(cache.totals, stats);
      addToStats(cache.today, stats);
      if (!rolledOver) addToStats(cache.week, stats);
    },
  };
}
