import { mkdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";

export interface StatsRow {
  farm: number;
  farmAttempts: number;
  farmSuccesses: number;
  steal: number;
  stealAttempts: number;
  stealSuccesses: number;
  rankups: number;
  prestiges: number;
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

export const ZERO_STATS: StatsRow = {
  farm: 0,
  farmAttempts: 0,
  farmSuccesses: 0,
  steal: 0,
  stealAttempts: 0,
  stealSuccesses: 0,
  rankups: 0,
  prestiges: 0,
};

let db!: DatabaseSync;

let updateTotals!: StatementSync;
let upsertDaily!: StatementSync;
let getTotalsStmt!: StatementSync;
let getDailyStmt!: StatementSync;
let getWeekStmt!: StatementSync;
let insertBalanceEventStmt!: StatementSync;
let getBalanceEventsStmt!: StatementSync;

export const cache: { totals: StatsRow; today: StatsRow; week: StatsRow } = {
  totals: { ...ZERO_STATS },
  today: { ...ZERO_STATS },
  week: { ...ZERO_STATS },
};
let lastRecordDate = "";

function addToStats(target: StatsRow, source: StatsRow): void {
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
      prestiges        INTEGER NOT NULL DEFAULT 0
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
      prestiges        INTEGER NOT NULL DEFAULT 0
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
  `);

  updateTotals = db.prepare(`
    UPDATE totals SET
      farm             = farm             + @farm,
      farmAttempts     = farmAttempts     + @farmAttempts,
      farmSuccesses    = farmSuccesses    + @farmSuccesses,
      steal            = steal            + @steal,
      stealAttempts    = stealAttempts    + @stealAttempts,
      stealSuccesses   = stealSuccesses   + @stealSuccesses,
      rankups          = rankups          + @rankups,
      prestiges        = prestiges        + @prestiges
    WHERE id = 1
  `);

  upsertDaily = db.prepare(`
    INSERT INTO daily (date, farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges)
    VALUES (@date, @farm, @farmAttempts, @farmSuccesses, @steal, @stealAttempts, @stealSuccesses, @rankups, @prestiges)
    ON CONFLICT(date) DO UPDATE SET
      farm             = farm             + excluded.farm,
      farmAttempts     = farmAttempts     + excluded.farmAttempts,
      farmSuccesses    = farmSuccesses    + excluded.farmSuccesses,
      steal            = steal            + excluded.steal,
      stealAttempts    = stealAttempts    + excluded.stealAttempts,
      stealSuccesses   = stealSuccesses   + excluded.stealSuccesses,
      rankups          = rankups          + excluded.rankups,
      prestiges        = prestiges        + excluded.prestiges
  `);

  getTotalsStmt = db.prepare("SELECT farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges FROM totals WHERE id = 1");
  getDailyStmt = db.prepare("SELECT farm, farmAttempts, farmSuccesses, steal, stealAttempts, stealSuccesses, rankups, prestiges FROM daily WHERE date = ?");
  getWeekStmt = db.prepare(`
    SELECT
      COALESCE(SUM(farm), 0)             AS farm,
      COALESCE(SUM(farmAttempts), 0)     AS farmAttempts,
      COALESCE(SUM(farmSuccesses), 0)    AS farmSuccesses,
      COALESCE(SUM(steal), 0)            AS steal,
      COALESCE(SUM(stealAttempts), 0)    AS stealAttempts,
      COALESCE(SUM(stealSuccesses), 0)   AS stealSuccesses,
      COALESCE(SUM(rankups), 0)          AS rankups,
      COALESCE(SUM(prestiges), 0)        AS prestiges
    FROM daily WHERE date >= ?
  `);
  insertBalanceEventStmt = db.prepare(`
    INSERT INTO balance_events (executedAt, command, category, delta, balanceAfter, responseText)
    VALUES (@executedAt, @command, @category, @delta, @balanceAfter, @responseText)
  `);
  getBalanceEventsStmt = db.prepare(`
    SELECT id, executedAt, command, category, delta, balanceAfter, responseText
    FROM balance_events
    WHERE executedAt >= ? AND executedAt <= ?
    ORDER BY executedAt ASC, id ASC
  `);

  cache.totals = (getTotalsStmt.get() as unknown as StatsRow | undefined) ?? {
    ...ZERO_STATS,
  };
  cache.today = (getDailyStmt.get(todayStr()) as unknown as StatsRow | undefined) ?? {
    ...ZERO_STATS,
  };
  cache.week = (getWeekStmt.get(weekStartStr()) as unknown as StatsRow | undefined) ?? {
    ...ZERO_STATS,
  };
  lastRecordDate = todayStr();
}

export function closeDb(): void {
  db.close();
}

export function record(d: StatsRow): void {
  const date = todayStr();
  updateTotals.run(d as unknown as Record<string, SQLInputValue>);
  upsertDaily.run({ ...d, date } as unknown as Record<string, SQLInputValue>);
  if (date !== lastRecordDate) {
    lastRecordDate = date;
    cache.today = { ...ZERO_STATS };
    cache.week = (getWeekStmt.get(weekStartStr()) as unknown as StatsRow | undefined) ?? {
      ...ZERO_STATS,
    };
  }
  addToStats(cache.totals, d);
  addToStats(cache.today, d);
  addToStats(cache.week, d);
}

export function recordBalanceChange(event: NewBalanceEvent): void {
  insertBalanceEventStmt.run(event as unknown as Record<string, SQLInputValue>);
}

export function getBalanceEvents(from: string, to: string): BalanceEvent[] {
  return getBalanceEventsStmt.all(from, to) as unknown as BalanceEvent[];
}
