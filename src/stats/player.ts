import { log } from "../logger.js";
import { Rank, type RankValue } from "../plans.js";

import { parseRankResponse } from "./rank-parser.js";

export interface PlayerInfo {
  username: string;
  potatoes: number;
  prestige: number;
  harvests: number;
  steals: number;
  stolenFrom: number;
  farmSize: string;
  rank: RankValue;
  leaderboardRank: number;
  totalPlayers: number;
  lastCommand: string | null;
}

export const playerInfo: PlayerInfo = {
  username: "",
  potatoes: 0,
  prestige: 0,
  harvests: 0,
  steals: 0,
  stolenFrom: 0,
  farmSize: "",
  rank: Rank.BackyardGarden as RankValue,
  leaderboardRank: 0,
  totalPlayers: 0,
  lastCommand: null,
};

export function updateFromRank(text: string): void {
  Object.assign(playerInfo, parseRankResponse(text));
  log.debug("Player data updated from rank response", {
    username: playerInfo.username,
    potatoes: playerInfo.potatoes,
    prestige: playerInfo.prestige,
    rank: playerInfo.rank,
    leaderboardRank: playerInfo.leaderboardRank,
  });
}

export function setLastCommand(command: string): void {
  playerInfo.lastCommand = command;
}
