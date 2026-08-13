import assert from "node:assert/strict";
import test from "node:test";

import { Rank } from "../src/plans.js";
import { parseRankResponse } from "../src/stats/rank-parser.js";

test("parseRankResponse extracts formatted and negative values", () => {
  const response =
    "potato_user has -1,234 potatoes ● Prestige: 7 ● Harvests: 12,345 ● Stole 99 times ● Stolen from 8 times ● Farm: 10 Acre Farm ● Ranked #42/9,999";
  assert.deepEqual(parseRankResponse(response), {
    username: "potato_user",
    potatoes: -1234,
    prestige: 7,
    harvests: 12345,
    steals: 99,
    stolenFrom: 8,
    farmSize: "10 Acre Farm",
    rank: Rank.TenAcreFarm,
    leaderboardRank: 42,
    totalPlayers: 9999,
  });
});

test("parseRankResponse only returns fields present in partial responses", () => {
  assert.deepEqual(parseRankResponse("alice has 5 potatoes"), {
    username: "alice",
    potatoes: 5,
  });
});
