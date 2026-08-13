import assert from "node:assert/strict";
import test from "node:test";

import {
  cache,
  closeDb,
  getEvents,
  initDb,
  ZERO_STATS,
} from "../src/db/index.js";
import { Actions } from "../src/plans.js";
import {
  eventCategory,
  parseBalanceChange,
  parseDelta,
} from "../src/stats/command-result.js";
import { playerInfo } from "../src/stats/player.js";
import { recordCommandResult, sessionTotals } from "../src/stats/recording.js";

test("balance parsing handles gains, losses, commas, and negative balances", () => {
  assert.deepEqual(parseBalanceChange("Harvested [+1,250 ⇒ 9,999]"), {
    delta: 1250,
    balanceAfter: 9999,
  });
  assert.deepEqual(parseBalanceChange("Stole [-500 ⇒ -25]"), {
    delta: -500,
    balanceAfter: -25,
  });
  assert.equal(parseBalanceChange("no balance here"), null);
});

test("delta parsing supports both known response formats", () => {
  assert.equal(parseDelta(Actions.FARM, "Result [+42]"), 42);
  assert.equal(parseDelta(Actions.STEAL, "Result - 1,234 🥔"), -1234);
  assert.equal(parseDelta(Actions.EAT, "Result [-5]"), -5);
});

test("event categories cover farming, progression, and spending commands", () => {
  assert.equal(eventCategory(Actions.FARM), "harvest");
  assert.equal(eventCategory(Actions.STEAL), "steal");
  assert.equal(eventCategory(Actions.RANKUP), "rankup");
  assert.equal(eventCategory(Actions.PRESTIGE), "prestige");
  assert.equal(eventCategory(Actions.CDR), "spending");
  assert.equal(eventCategory(Actions.SHOP_GUARD), "spending");
  assert.equal(eventCategory(Actions.QUIZ), "other");
});

test("command recording updates balance, events, and every aggregate horizon", (t) => {
  initDb(":memory:");
  t.after(() => {
    closeDb();
  });
  Object.assign(sessionTotals, ZERO_STATS);
  playerInfo.potatoes = 100;

  recordCommandResult(
    Actions.FARM,
    "🥔[+25 ⇒ 125] ⏰ 28 minutes 🚨Ready to rankup!🚨",
    false,
  );
  recordCommandResult(
    Actions.SHOP_GUARD,
    "Guard purchased! [-100 ⇒ 25]",
    false,
  );

  assert.equal(playerInfo.potatoes, 25);
  assert.deepEqual(
    getEvents("2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z").map(
      ({ command, category, delta, balanceAfter }) => ({
        command,
        category,
        delta,
        balanceAfter,
      }),
    ),
    [
      {
        command: Actions.FARM,
        category: "harvest",
        delta: 25,
        balanceAfter: 125,
      },
      {
        command: Actions.SHOP_GUARD,
        category: "spending",
        delta: -100,
        balanceAfter: 25,
      },
    ],
  );
  for (const stats of [cache.totals, cache.today, cache.week, sessionTotals]) {
    assert.equal(stats.farm, 25);
    assert.equal(stats.farmAttempts, 1);
    assert.equal(stats.farmSuccesses, 1);
  }
});

test("command recording preserves applied steal losses from API errors", (t) => {
  initDb(":memory:");
  t.after(() => {
    closeDb();
  });
  Object.assign(sessionTotals, ZERO_STATS);
  playerInfo.potatoes = 100;

  recordCommandResult(
    Actions.STEAL,
    "❌ farmer [-12 ⇒ 88] ⏰ 90 minutes",
    true,
  );

  assert.equal(playerInfo.potatoes, 88);
  assert.deepEqual(
    getEvents("2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z").map(
      ({ command, category, delta, balanceAfter }) => ({
        command,
        category,
        delta,
        balanceAfter,
      }),
    ),
    [
      {
        command: Actions.STEAL,
        category: "steal",
        delta: -12,
        balanceAfter: 88,
      },
    ],
  );
  for (const stats of [cache.totals, cache.today, cache.week, sessionTotals]) {
    assert.equal(stats.steal, -12);
    assert.equal(stats.stealAttempts, 1);
    assert.equal(stats.stealSuccesses, 0);
  }
});

test("command recording applies relative eat costs to balance and spending", (t) => {
  initDb(":memory:");
  t.after(() => {
    closeDb();
  });
  Object.assign(sessionTotals, ZERO_STATS);
  playerInfo.potatoes = 100;

  recordCommandResult(Actions.EAT, "Meal prepared [-5]", false);

  assert.equal(playerInfo.potatoes, 95);
  assert.deepEqual(
    getEvents("2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z").map(
      ({ command, category, delta, balanceAfter }) => ({
        command,
        category,
        delta,
        balanceAfter,
      }),
    ),
    [
      {
        command: Actions.EAT,
        category: "spending",
        delta: -5,
        balanceAfter: 95,
      },
    ],
  );
});

test("command recording ignores unapplied API errors, cooldowns, and recycled harvests", (t) => {
  initDb(":memory:");
  t.after(() => {
    closeDb();
  });
  Object.assign(sessionTotals, ZERO_STATS);
  playerInfo.potatoes = 100;

  recordCommandResult(Actions.FARM, "✋⏰ ⇒ 15 minutes", false);
  recordCommandResult(Actions.FARM, "Crops ruined [+0 ⇒ 100] ♻⏰", false);
  recordCommandResult(Actions.STEAL, "Invalid target", true);
  recordCommandResult(Actions.STATUS, "Potato: ✅", false);

  assert.deepEqual(
    getEvents("2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z"),
    [],
  );
  assert.deepEqual({ ...cache.totals }, ZERO_STATS);
  assert.deepEqual(sessionTotals, ZERO_STATS);
  assert.equal(playerInfo.potatoes, 100);
});
