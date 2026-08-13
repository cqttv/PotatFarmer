import assert from "node:assert/strict";
import test from "node:test";

import { Actions } from "../src/plans.js";
import {
  eventCategory,
  parseBalanceChange,
  parseDelta,
} from "../src/stats/command-result.js";

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
  assert.equal(parseDelta(Actions.EAT, "Result [-100]"), 0);
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
