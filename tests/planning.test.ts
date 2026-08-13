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

test("status planning farms and steals independently when either is ready", () => {
  assert.deepEqual(
    buildQueueFromStatus({
      Potato: true,
      Steal: false,
      Cooldown: true,
    }),
    [Actions.FARM],
  );
  assert.deepEqual(
    buildQueueFromStatus({
      Potato: false,
      Steal: true,
      Cooldown: true,
    }),
    [Actions.STEAL],
  );
});

test("status planning only resets cooldowns when both harvest actions are blocked", () => {
  assert.deepEqual(
    buildQueueFromStatus({
      Potato: false,
      Steal: false,
      Cooldown: false,
      "Shop-Cdr": true,
    }),
    [Actions.SHOP_CDR],
  );
  assert.deepEqual(
    buildQueueFromStatus({
      Potato: false,
      Steal: false,
      Cooldown: false,
      "Shop-Cdr": false,
    }),
    [],
  );
  assert.deepEqual(
    buildQueueFromStatus({
      Potato: true,
      Steal: false,
      Cooldown: true,
      "Shop-Cdr": true,
    }),
    [Actions.FARM],
  );
});

test("plan guards use PotatBotat rank scaling at exact affordability boundaries", () => {
  const cases = [
    { command: Actions.CDR, rank: Rank.Bankrupt, prestige: 0, threshold: 175 },
    {
      command: Actions.CDR,
      rank: Rank.TenAcreFarm,
      prestige: 2,
      threshold: 172,
    },
    {
      command: Actions.SHOP_FERTILIZER,
      rank: Rank.Bankrupt,
      prestige: 0,
      threshold: 130,
    },
    {
      command: Actions.SHOP_GUARD,
      rank: Rank.Greenhouse,
      prestige: 0,
      threshold: 300,
    },
    {
      command: Actions.SHOP_QUIZ,
      rank: Rank.Industrial,
      prestige: 0,
      threshold: 850,
    },
  ] as const;

  for (const { command, rank, prestige, threshold } of cases) {
    assert.equal(
      shouldRun(command, { potatoes: threshold - 1, rank, prestige }),
      false,
      `${command} should be blocked one potato below ${threshold}`,
    );
    assert.equal(
      shouldRun(command, { potatoes: threshold, rank, prestige }),
      true,
      `${command} should run at ${threshold}`,
    );
  }
});
