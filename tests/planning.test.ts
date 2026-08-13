import assert from "node:assert/strict";
import test from "node:test";

import { buildQueueFromStatus, parseStatus } from "../src/app/status.js";
import { Actions, Rank, shouldRun } from "../src/plans.js";

test("status parsing ignores unknown fields and builds the expected queue", () => {
  const status = parseStatus(
    "Potato: ❌ ● Cooldown: ✅ ● Steal: ❌ ● Eat: ✅ ● Shop-Guard: ✅ ● Unknown: ✅",
  );
  assert.deepEqual(status, {
    Potato: false,
    Cooldown: true,
    Steal: false,
    Eat: true,
    "Shop-Guard": true,
  });
  assert.deepEqual(buildQueueFromStatus(status), [
    Actions.CDR,
    Actions.SHOP_GUARD,
    Actions.EAT,
  ]);
});

test("plan guards reserve a buffer for cooldown and shop purchases", () => {
  const player = { potatoes: 129, rank: Rank.BackyardGarden, prestige: 0 };
  assert.equal(shouldRun(Actions.CDR, player), true);
  assert.equal(shouldRun(Actions.SHOP_CDR, player), false);
  assert.equal(shouldRun(Actions.SHOP_CDR, { ...player, potatoes: 130 }), true);
  assert.equal(shouldRun(Actions.FARM, { ...player, potatoes: 0 }), true);
});
