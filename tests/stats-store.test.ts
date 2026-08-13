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
