import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { runMigrations } from "../src/db/migrations/index.js";
import {
  createStatsStore,
  type StatsCache,
  ZERO_STATS,
} from "../src/db/stats-store.js";

function newCache(): StatsCache {
  return {
    totals: { ...ZERO_STATS },
    today: { ...ZERO_STATS },
    week: { ...ZERO_STATS },
  };
}

test("stats cache does not double-count the first record after UTC rollover", () => {
  const database = new DatabaseSync(":memory:");
  runMigrations(database);
  let currentDate = new Date("2026-08-12T23:59:59.000Z");
  const cache = newCache();
  const store = createStatsStore(database, cache, () => currentDate);
  store.loadCache();

  store.record({ ...ZERO_STATS, farm: 10, farmAttempts: 1 });
  currentDate = new Date("2026-08-13T00:00:01.000Z");
  store.record({ ...ZERO_STATS, farm: 20, farmAttempts: 1 });

  assert.equal(cache.totals.farm, 30);
  assert.equal(cache.today.farm, 20);
  assert.equal(cache.week.farm, 30);
  database.close();
});

test("stats cache loads persisted totals, today, and the inclusive seven-day window", () => {
  const database = new DatabaseSync(":memory:");
  runMigrations(database);
  const insertDaily = database.prepare(`
    INSERT INTO daily (date, farm, farmAttempts)
    VALUES (?, ?, ?)
  `);
  insertDaily.run("2026-08-05", 80, 8);
  insertDaily.run("2026-08-07", 70, 7);
  insertDaily.run("2026-08-12", 20, 2);
  database
    .prepare("UPDATE totals SET farm = ?, farmAttempts = ? WHERE id = 1")
    .run(170, 17);

  const cache = newCache();
  const store = createStatsStore(
    database,
    cache,
    () => new Date("2026-08-12T12:00:00.000Z"),
  );
  store.loadCache();

  assert.equal(cache.totals.farm, 170);
  assert.equal(cache.totals.farmAttempts, 17);
  assert.equal(cache.today.farm, 20);
  assert.equal(cache.week.farm, 90);
  assert.equal(cache.week.farmAttempts, 9);
  database.close();
});

test("recording updates every cache horizon and persists daily aggregates", () => {
  const database = new DatabaseSync(":memory:");
  runMigrations(database);
  const cache = newCache();
  const store = createStatsStore(
    database,
    cache,
    () => new Date("2026-08-12T12:00:00.000Z"),
  );
  store.loadCache();

  store.record({
    ...ZERO_STATS,
    steal: -12,
    stealAttempts: 1,
    quizApiCalls: 2,
  });

  for (const horizon of [cache.totals, cache.today, cache.week]) {
    assert.equal(horizon.steal, -12);
    assert.equal(horizon.stealAttempts, 1);
    assert.equal(horizon.quizApiCalls, 2);
  }
  const daily = database
    .prepare(
      "SELECT steal, stealAttempts, quizApiCalls FROM daily WHERE date = ?",
    )
    .get("2026-08-12") as {
    steal: number;
    stealAttempts: number;
    quizApiCalls: number;
  };
  assert.deepEqual(
    { ...daily },
    {
      steal: -12,
      stealAttempts: 1,
      quizApiCalls: 2,
    },
  );
  database.close();
});
