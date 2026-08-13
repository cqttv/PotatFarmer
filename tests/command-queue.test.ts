import assert from "node:assert/strict";
import test from "node:test";

import { CommandQueue, scheduleFollowUps } from "../src/app/command-queue.js";
import { Actions } from "../src/plans.js";

test("command queue preserves order and de-duplicates commands", () => {
  const queue = new CommandQueue([Actions.FARM, Actions.STEAL, Actions.FARM]);
  assert.equal(queue.takeNext(), Actions.FARM);
  queue.enqueueNext(Actions.EAT, Actions.STEAL);
  queue.enqueueLast(Actions.SHOP_GUARD, Actions.EAT);
  assert.deepEqual(queue.snapshot(), [
    Actions.FARM,
    Actions.EAT,
    Actions.STEAL,
    Actions.SHOP_GUARD,
  ]);
  assert.equal(queue.takeNext(), Actions.EAT);
  assert.equal(queue.takeNext(), Actions.STEAL);
  assert.equal(queue.takeNext(), Actions.SHOP_GUARD);
  assert.equal(queue.takeNext(), null);
});

test("rank and prestige follow-ups keep priority over action cascades", () => {
  const rankQueue = new CommandQueue([Actions.SHOP_CDR]);
  assert.equal(rankQueue.takeNext(), Actions.SHOP_CDR);
  scheduleFollowUps(rankQueue, Actions.SHOP_CDR, {
    succeeded: true,
    rankupReady: true,
    prestigeReady: false,
  });
  assert.deepEqual(rankQueue.snapshot(), [
    Actions.SHOP_CDR,
    Actions.RANKUP,
    Actions.CDR,
  ]);

  const prestigeQueue = new CommandQueue([Actions.SHOP_QUIZ]);
  assert.equal(prestigeQueue.takeNext(), Actions.SHOP_QUIZ);
  scheduleFollowUps(prestigeQueue, Actions.SHOP_QUIZ, {
    succeeded: true,
    rankupReady: true,
    prestigeReady: true,
  });
  assert.deepEqual(prestigeQueue.snapshot(), [
    Actions.SHOP_QUIZ,
    Actions.PRESTIGE,
    Actions.QUIZ,
  ]);
});

test("cooldown reduction appends newly available farm actions once", () => {
  const queue = new CommandQueue([Actions.CDR, Actions.FARM]);
  assert.equal(queue.takeNext(), Actions.CDR);
  scheduleFollowUps(queue, Actions.CDR, {
    succeeded: true,
    rankupReady: false,
    prestigeReady: false,
  });
  assert.deepEqual(queue.snapshot(), [
    Actions.CDR,
    Actions.FARM,
    Actions.STEAL,
  ]);
});
