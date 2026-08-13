import assert from "node:assert/strict";
import test from "node:test";

import { executeCommand } from "../src/app/command-executor.js";
import { closeDb, getEvents, initDb } from "../src/db/index.js";
import { Actions, Rank } from "../src/plans.js";
import { playerInfo } from "../src/stats/player.js";

const originalFetch = globalThis.fetch;

test("executeCommand records a rejected steal that changed the balance", async (t) => {
  initDb(":memory:");
  t.after(() => {
    globalThis.fetch = originalFetch;
    closeDb();
  });
  Object.assign(playerInfo, {
    potatoes: 100,
    rank: Rank.BackyardGarden,
    prestige: 0,
    lastCommand: null,
  });
  const responseText = "❌ farmer [-12 ⇒ 88] ⏰ 90 minutes";
  globalThis.fetch = (): ReturnType<typeof fetch> =>
    Promise.resolve({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          statusCode: 400,
          data: [],
          errors: [{ message: responseText }],
        }),
    } as Awaited<ReturnType<typeof fetch>>);

  assert.deepEqual(await executeCommand(Actions.STEAL), {
    succeeded: false,
    text: responseText,
    rankupReady: false,
    prestigeReady: false,
  });
  assert.equal(playerInfo.potatoes, 88);
  assert.equal(playerInfo.lastCommand, "#steal");
  assert.deepEqual(
    getEvents("2026-01-01T00:00:00.000Z", "2027-01-01T00:00:00.000Z").map(
      ({ command, delta, balanceAfter }) => ({
        command,
        delta,
        balanceAfter,
      }),
    ),
    [{ command: Actions.STEAL, delta: -12, balanceAfter: 88 }],
  );
});
