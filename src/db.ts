import { mkdirSync } from "node:fs";
import {
  DatabaseSync,
  type SQLInputValue,
  type StatementSync,
} from "node:sqlite";

import { log } from "./logger.js";

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
  quizFailures: number;
  quizAnswerAttempts: number;
  quizIncorrectAnswers: number;
  quizCacheHits: number;
  quizApiCalls: number;
}

export interface EventSummary {
  id: number;
  executedAt: string;
  command: string;
  category: string;
  delta: number;
  balanceAfter: number;
}

export interface Event extends EventSummary {
  responseText: string;
}

export interface NewEvent {
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
  insertEvent: StatementSync;
  getEvents: StatementSync;
  getEvent: StatementSync;
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
  quizFailures: 0,
  quizAnswerAttempts: 0,
  quizIncorrectAnswers: 0,
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
  const startedAt = Date.now();
  mkdirSync("data", { recursive: true });
  db = new DatabaseSync("data/stats.db");
  const today = todayStr();

  db.exec("PRAGMA journal_mode = WAL");

  const legacyEvents = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'balance_events'",
    )
    .get();
  const currentEvents = db
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'events'",
    )
    .get();
  if (legacyEvents && !currentEvents) {
    db.exec("ALTER TABLE balance_events RENAME TO events");
    log.info("Migrated balance events to general event history");
  } else if (legacyEvents && currentEvents) {
    db.exec(`
      INSERT INTO events (executedAt, command, category, delta, balanceAfter, responseText)
      SELECT executedAt, command, category, delta, balanceAfter, responseText
      FROM balance_events;
      DROP TABLE balance_events;
    `);
    log.info("Merged legacy balance events into general event history");
  }

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
      quizFailures     INTEGER NOT NULL DEFAULT 0,
      quizAnswerAttempts INTEGER NOT NULL DEFAULT 0,
      quizIncorrectAnswers INTEGER NOT NULL DEFAULT 0,
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
      quizFailures     INTEGER NOT NULL DEFAULT 0,
      quizAnswerAttempts INTEGER NOT NULL DEFAULT 0,
      quizIncorrectAnswers INTEGER NOT NULL DEFAULT 0,
      quizCacheHits    INTEGER NOT NULL DEFAULT 0,
      quizApiCalls  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS events (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      executedAt       TEXT    NOT NULL,
      command          TEXT    NOT NULL,
      category         TEXT    NOT NULL,
      delta            INTEGER NOT NULL,
      balanceAfter     INTEGER NOT NULL,
      responseText     TEXT    NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_events_executedAt
      ON events (executedAt);
    CREATE INDEX IF NOT EXISTS idx_events_category_executedAt
      ON events (category, executedAt);

    CREATE TABLE IF NOT EXISTS quiz_answers (
      question         TEXT PRIMARY KEY,
      answer           TEXT NOT NULL,
      createdAt        TEXT NOT NULL,
      lastUsedAt       TEXT NOT NULL,
      useCount         INTEGER NOT NULL DEFAULT 1
    );
  `);

  const eventColumns = db
    .prepare("PRAGMA table_info(events)")
    .all()
    .map((row) => (row as { name: string }).name);
  if (eventColumns.includes("succeeded")) {
    db.exec(`
      UPDATE events
      SET category = 'quiz_failure'
      WHERE succeeded = 0
        AND category = 'quiz'
        AND responseText = 'Quiz attempt failed';
      DELETE FROM events
      WHERE succeeded = 0 AND category != 'quiz_failure';
    `);
    db.exec("ALTER TABLE events DROP COLUMN succeeded");
    log.info("Removed command failures from event history");
  }
  db.exec(`
    UPDATE events SET category = 'spending' WHERE category = 'shop_cdr';
    DELETE FROM events WHERE command = 'status';
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
      "quizFailures",
      "quizAnswerAttempts",
      "quizIncorrectAnswers",
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
        quizFailures     = quizFailures     + @quizFailures,
        quizAnswerAttempts = quizAnswerAttempts + @quizAnswerAttempts,
        quizIncorrectAnswers = quizIncorrectAnswers + @quizIncorrectAnswers,
        quizCacheHits    = quizCacheHits    + @quizCacheHits,
        quizApiCalls  = quizApiCalls  + @quizApiCalls
      WHERE id = 1
    `),
    upsertDaily: db.prepare(`
      INSERT INTO daily (date, farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges, quizReward, quizAttempts, quizSuccesses, quizFailures, quizAnswerAttempts, quizIncorrectAnswers, quizCacheHits, quizApiCalls)
      VALUES (@date, @farm, @farmAttempts, @farmSuccesses, @steal, @stealAttempts, @stealSuccesses, @rankups, @prestiges, @quizReward, @quizAttempts, @quizSuccesses, @quizFailures, @quizAnswerAttempts, @quizIncorrectAnswers, @quizCacheHits, @quizApiCalls)
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
        quizFailures     = quizFailures     + excluded.quizFailures,
        quizAnswerAttempts = quizAnswerAttempts + excluded.quizAnswerAttempts,
        quizIncorrectAnswers = quizIncorrectAnswers + excluded.quizIncorrectAnswers,
        quizCacheHits    = quizCacheHits    + excluded.quizCacheHits,
        quizApiCalls  = quizApiCalls  + excluded.quizApiCalls
    `),
    getTotals: db.prepare(
      "SELECT farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges, quizReward, quizAttempts, quizSuccesses, quizFailures, quizAnswerAttempts, quizIncorrectAnswers, quizCacheHits, quizApiCalls FROM totals WHERE id = 1",
    ),
    getDaily: db.prepare(
      "SELECT farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges, quizReward, quizAttempts, quizSuccesses, quizFailures, quizAnswerAttempts, quizIncorrectAnswers, quizCacheHits, quizApiCalls FROM daily WHERE date = ?",
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
        COALESCE(SUM(quizFailures), 0)     AS quizFailures,
        COALESCE(SUM(quizAnswerAttempts), 0) AS quizAnswerAttempts,
        COALESCE(SUM(quizIncorrectAnswers), 0) AS quizIncorrectAnswers,
        COALESCE(SUM(quizCacheHits), 0)    AS quizCacheHits,
        COALESCE(SUM(quizApiCalls), 0)  AS quizApiCalls
      FROM daily WHERE date >= ?
    `),
    insertEvent: db.prepare(`
      INSERT INTO events (executedAt, command, category, delta, balanceAfter, responseText)
      VALUES (@executedAt, @command, @category, @delta, @balanceAfter, @responseText)
    `),
    getEvents: db.prepare(`
      SELECT id, executedAt, command, category, delta, balanceAfter
      FROM events
      WHERE executedAt >= ? AND executedAt <= ?
      ORDER BY executedAt ASC, id ASC
    `),
    getEvent: db.prepare(`
      SELECT id, executedAt, command, category, delta, balanceAfter, responseText
      FROM events
      WHERE id = ?
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
  log.info("Database initialized", {
    path: "data/stats.db",
    durationMs: Date.now() - startedAt,
  });
}

export function closeDb(): void {
  db.close();
  log.info("Database closed");
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

export function recordEvent(event: NewEvent): void {
  queries.insertEvent.run(event as unknown as Record<string, SQLInputValue>);
  log.debug("Event recorded", {
    command: event.command,
    category: event.category,
    delta: event.delta,
    balanceAfter: event.balanceAfter,
  });
}

export function getEvents(from: string, to: string): EventSummary[] {
  return queries.getEvents.all(from, to) as unknown as EventSummary[];
}

export function getEvent(id: number): Event | null {
  return (queries.getEvent.get(id) as unknown as Event | undefined) ?? null;
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
  log.debug("Quiz answer cached", { question, answer });
}

export function deleteQuizAnswer(question: string, answer: string): void {
  queries.deleteQuizAnswer.run(question, answer);
  log.info("Invalid quiz answer removed from cache", { question, answer });
}
