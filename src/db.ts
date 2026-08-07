import { mkdirSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync,
} from "node:sqlite";

export interface StatsRow {
  farm: number;
  farmAttempts: number;
  farmSuccesses: number;
  steal: number;
  stealAttempts: number;
  stealSuccesses: number;
  rankups: number;
  prestiges: number;
  quizReward: number;
  quizAttempts: number;
  quizSuccesses: number;
  quizAnswerAttempts: number;
  quizCacheHits: number;
  quizApiCalls: number;
}

export interface BalanceEvent {
  id: number;
  executedAt: string;
  command: string;
  category: string;
  delta: number;
  balanceAfter: number;
  responseText: string;
}

export interface NewBalanceEvent {
  executedAt: string;
  command: string;
  category: string;
  delta: number;
  balanceAfter: number;
  responseText: string;
}

interface Queries {
  updateTotals: StatementSync;
  upsertDaily: StatementSync;
  getTotals: StatementSync;
  getDaily: StatementSync;
  getWeek: StatementSync;
  insertBalanceEvent: StatementSync;
  getBalanceEvents: StatementSync;
  getQuizAnswer: StatementSync;
  upsertQuizAnswer: StatementSync;
  deleteQuizAnswer: StatementSync;
}

export const ZERO_STATS: StatsRow = {
  farm: 0,
  farmAttempts: 0,
  farmSuccesses: 0,
  steal: 0,
  stealAttempts: 0,
  stealSuccesses: 0,
  rankups: 0,
  prestiges: 0,
  quizReward: 0,
  quizAttempts: 0,
  quizSuccesses: 0,
  quizAnswerAttempts: 0,
  quizCacheHits: 0,
  quizApiCalls: 0,
};

let db!: DatabaseSync;
let queries!: Queries;

export const cache: { totals: StatsRow; today: StatsRow; week: StatsRow } = {
  totals: { ...ZERO_STATS },
  today: { ...ZERO_STATS },
  week: { ...ZERO_STATS },
};
let lastRecordDate = "";

export function addToStats(target: StatsRow, source: StatsRow): void {
  for (const key of Object.keys(source) as (keyof StatsRow)[]) {
    // eslint-disable-next-line security/detect-object-injection
    target[key] += source[key];
  }
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function weekStartStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

export function initDb(): void {
  mkdirSync("data", { recursive: true });
  db = new DatabaseSync("data/stats.db");
  const today = todayStr();

  db.exec("PRAGMA journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS totals (
      id               INTEGER PRIMARY KEY CHECK (id = 1),
      farm             INTEGER NOT NULL DEFAULT 0,
      farmAttempts     INTEGER NOT NULL DEFAULT 0,
      farmSuccesses    INTEGER NOT NULL DEFAULT 0,
      steal            INTEGER NOT NULL DEFAULT 0,
      stealAttempts    INTEGER NOT NULL DEFAULT 0,
      stealSuccesses   INTEGER NOT NULL DEFAULT 0,
      rankups          INTEGER NOT NULL DEFAULT 0,
      prestiges        INTEGER NOT NULL DEFAULT 0,
      quizReward       INTEGER NOT NULL DEFAULT 0,
      quizAttempts     INTEGER NOT NULL DEFAULT 0,
      quizSuccesses    INTEGER NOT NULL DEFAULT 0,
      quizAnswerAttempts INTEGER NOT NULL DEFAULT 0,
      quizCacheHits    INTEGER NOT NULL DEFAULT 0,
      quizApiCalls  INTEGER NOT NULL DEFAULT 0
    );
    INSERT OR IGNORE INTO totals (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS daily (
      date             TEXT    NOT NULL PRIMARY KEY,
      farm             INTEGER NOT NULL DEFAULT 0,
      farmAttempts     INTEGER NOT NULL DEFAULT 0,
      farmSuccesses    INTEGER NOT NULL DEFAULT 0,
      steal            INTEGER NOT NULL DEFAULT 0,
      stealAttempts    INTEGER NOT NULL DEFAULT 0,
      stealSuccesses   INTEGER NOT NULL DEFAULT 0,
      rankups          INTEGER NOT NULL DEFAULT 0,
      prestiges        INTEGER NOT NULL DEFAULT 0,
      quizReward       INTEGER NOT NULL DEFAULT 0,
      quizAttempts     INTEGER NOT NULL DEFAULT 0,
      quizSuccesses    INTEGER NOT NULL DEFAULT 0,
      quizAnswerAttempts INTEGER NOT NULL DEFAULT 0,
      quizCacheHits    INTEGER NOT NULL DEFAULT 0,
      quizApiCalls  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS balance_events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      executedAt       TEXT    NOT NULL,
      command          TEXT    NOT NULL,
      category         TEXT    NOT NULL,
      delta            INTEGER NOT NULL,
      balanceAfter     INTEGER NOT NULL,
      responseText     TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_balance_events_executedAt
      ON balance_events (executedAt);
    CREATE INDEX IF NOT EXISTS idx_balance_events_category_executedAt
      ON balance_events (category, executedAt);

    CREATE TABLE IF NOT EXISTS quiz_answers (
      question         TEXT PRIMARY KEY,
      answer           TEXT NOT NULL,
      createdAt        TEXT NOT NULL,
      lastUsedAt       TEXT NOT NULL,
      useCount         INTEGER NOT NULL DEFAULT 1
    );
  `);

  for (const table of ["totals", "daily"]) {
    let columns = db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((row) => (row as { name: string }).name);
    if (
      columns.includes("quizOpenAICalls") &&
      !columns.includes("quizApiCalls")
    ) {
      db.exec(
        `ALTER TABLE ${table} RENAME COLUMN quizOpenAICalls TO quizApiCalls`,
      );
      columns = columns.map((column) =>
        column === "quizOpenAICalls" ? "quizApiCalls" : column,
      );
    }
    for (const column of [
      "quizReward",
      "quizAttempts",
      "quizSuccesses",
      "quizAnswerAttempts",
      "quizCacheHits",
      "quizApiCalls",
    ]) {
      if (!columns.includes(column))
        db.exec(
          `ALTER TABLE ${table} ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`,
        );
    }
  }

  queries = {
    updateTotals: db.prepare(`
      UPDATE totals SET
        farm             = farm             + @farm,
        farmAttempts     = farmAttempts     + @farmAttempts,
        farmSuccesses    = farmSuccesses    + @farmSuccesses,
        steal            = steal            + @steal,
        stealAttempts    = stealAttempts    + @stealAttempts,
        stealSuccesses   = stealSuccesses   + @stealSuccesses,
        rankups          = rankups          + @rankups,
        prestiges        = prestiges        + @prestiges,
        quizReward       = quizReward       + @quizReward,
        quizAttempts     = quizAttempts     + @quizAttempts,
        quizSuccesses    = quizSuccesses    + @quizSuccesses,
        quizAnswerAttempts = quizAnswerAttempts + @quizAnswerAttempts,
        quizCacheHits    = quizCacheHits    + @quizCacheHits,
        quizApiCalls  = quizApiCalls  + @quizApiCalls
      WHERE id = 1
    `),
    upsertDaily: db.prepare(`
      INSERT INTO daily (date, farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges, quizReward, quizAttempts, quizSuccesses, quizAnswerAttempts, quizCacheHits, quizApiCalls)
      VALUES (@date, @farm, @farmAttempts, @farmSuccesses, @steal, @stealAttempts, @stealSuccesses, @rankups, @prestiges, @quizReward, @quizAttempts, @quizSuccesses, @quizAnswerAttempts, @quizCacheHits, @quizApiCalls)
      ON CONFLICT(date) DO UPDATE SET
        farm             = farm             + excluded.farm,
        farmAttempts     = farmAttempts     + excluded.farmAttempts,
        farmSuccesses    = farmSuccesses    + excluded.farmSuccesses,
        steal            = steal            + excluded.steal,
        stealAttempts    = stealAttempts    + excluded.stealAttempts,
        stealSuccesses   = stealSuccesses   + excluded.stealSuccesses,
        rankups          = rankups          + excluded.rankups,
        prestiges        = prestiges        + excluded.prestiges,
        quizReward       = quizReward       + excluded.quizReward,
        quizAttempts     = quizAttempts     + excluded.quizAttempts,
        quizSuccesses    = quizSuccesses    + excluded.quizSuccesses,
        quizAnswerAttempts = quizAnswerAttempts + excluded.quizAnswerAttempts,
        quizCacheHits    = quizCacheHits    + excluded.quizCacheHits,
        quizApiCalls  = quizApiCalls  + excluded.quizApiCalls
    `),
    getTotals: db.prepare(
      "SELECT farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges, quizReward, quizAttempts, quizSuccesses, quizAnswerAttempts, quizCacheHits, quizApiCalls FROM totals WHERE id = 1",
    ),
    getDaily: db.prepare(
      "SELECT farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges, quizReward, quizAttempts, quizSuccesses, quizAnswerAttempts, quizCacheHits, quizApiCalls FROM daily WHERE date = ?",
    ),
    getWeek: db.prepare(`
      SELECT
        COALESCE(SUM(farm), 0)             AS farm,
        COALESCE(SUM(farmAttempts), 0)     AS farmAttempts,
        COALESCE(SUM(farmSuccesses), 0)    AS farmSuccesses,
        COALESCE(SUM(steal), 0)            AS steal,
        COALESCE(SUM(stealAttempts), 0)    AS stealAttempts,
        COALESCE(SUM(stealSuccesses), 0)   AS stealSuccesses,
        COALESCE(SUM(rankups), 0)          AS rankups,
        COALESCE(SUM(prestiges), 0)        AS prestiges,
        COALESCE(SUM(quizReward), 0)       AS quizReward,
        COALESCE(SUM(quizAttempts), 0)     AS quizAttempts,
        COALESCE(SUM(quizSuccesses), 0)    AS quizSuccesses,
        COALESCE(SUM(quizAnswerAttempts), 0) AS quizAnswerAttempts,
        COALESCE(SUM(quizCacheHits), 0)    AS quizCacheHits,
        COALESCE(SUM(quizApiCalls), 0)  AS quizApiCalls
      FROM daily WHERE date >= ?
    `),
    insertBalanceEvent: db.prepare(`
      INSERT INTO balance_events (executedAt, command, category, delta, balanceAfter, responseText)
      VALUES (@executedAt, @command, @category, @delta, @balanceAfter, @responseText)
    `),
    getBalanceEvents: db.prepare(`
      SELECT id, executedAt, command, category, delta, balanceAfter, responseText
      FROM balance_events
      WHERE executedAt >= ? AND executedAt <= ?
      ORDER BY executedAt ASC, id ASC
    `),
    getQuizAnswer: db.prepare(
      "SELECT answer FROM quiz_answers WHERE question = ?",
    ),
    upsertQuizAnswer: db.prepare(`
      INSERT INTO quiz_answers (question, answer, createdAt, lastUsedAt, useCount)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(question) DO UPDATE SET
        answer = excluded.answer,
        lastUsedAt = excluded.lastUsedAt,
        useCount = quiz_answers.useCount + 1
    `),
    deleteQuizAnswer: db.prepare(
      "DELETE FROM quiz_answers WHERE question = ? AND answer = ?",
    ),
  };

  cache.totals = (queries.getTotals.get() as unknown as
    | StatsRow
    | undefined) ?? {
    ...ZERO_STATS,
  };
  cache.today = (queries.getDaily.get(today) as unknown as
    | StatsRow
    | undefined) ?? {
    ...ZERO_STATS,
  };
  cache.week = (queries.getWeek.get(weekStartStr()) as unknown as
    | StatsRow
    | undefined) ?? {
    ...ZERO_STATS,
  };
  lastRecordDate = today;
}

export function closeDb(): void {
  db.close();
}

export function record(d: StatsRow): void {
  const date = todayStr();
  queries.updateTotals.run(d as unknown as Record<string, SQLInputValue>);
  queries.upsertDaily.run({
    ...d,
    date,
  } as unknown as Record<string, SQLInputValue>);
  if (date !== lastRecordDate) {
    lastRecordDate = date;
    cache.today = { ...ZERO_STATS };
    cache.week = (queries.getWeek.get(weekStartStr()) as unknown as
      | StatsRow
      | undefined) ?? {
      ...ZERO_STATS,
    };
  }
  addToStats(cache.totals, d);
  addToStats(cache.today, d);
  addToStats(cache.week, d);
}

export function recordBalanceChange(event: NewBalanceEvent): void {
  queries.insertBalanceEvent.run(
    event as unknown as Record<string, SQLInputValue>,
  );
}

export function getBalanceEvents(from: string, to: string): BalanceEvent[] {
  return queries.getBalanceEvents.all(from, to) as unknown as BalanceEvent[];
}

export function getQuizAnswer(question: string): string | null {
  const row = queries.getQuizAnswer.get(question) as
    | { answer: string }
    | undefined;
  return row?.answer ?? null;
}

export function saveQuizAnswer(question: string, answer: string): void {
  const now = new Date().toISOString();
  queries.upsertQuizAnswer.run(question, answer, now, now);
}

export function deleteQuizAnswer(question: string, answer: string): void {
  queries.deleteQuizAnswer.run(question, answer);
}
