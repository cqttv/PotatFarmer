import { log } from "../logger.js";
import { Rank, type RankValue } from "../plans.js";

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

const RANK_BY_NAME = new Map<string, RankValue>([
  ["Bankrupt", Rank.Bankrupt],
  ["Backyard Garden", Rank.BackyardGarden],
  ["Greenhouse", Rank.Greenhouse],
  ["Acre Farm", Rank.AcreFarm],
  ["10 Acre Farm", Rank.TenAcreFarm],
  ["Potato Plantation", Rank.PotatoPlantation],
  ["Industrial Potato Facility", Rank.Industrial],
]);

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
  const username = text.match(/(\w+)/)?.[1];
  const potatoes = text.match(/has (-?[\d,]+) potatoes/)?.[1];
  const prestige = text.match(/Prestige: (\d+)/)?.[1];
  const harvests = text.match(/Harvests: ([\d,]+)/)?.[1];
  const steals = text.match(/Stole ([\d,]+) times?/)?.[1];
  const stolenFrom = text.match(/Stolen from ([\d,]+) times?/)?.[1];
  const farmSize = text.match(/Farm: ([^●]+)/)?.[1];
  const rankMatch = text.match(/Ranked #(\d+)\/(\d+)/);

  if (username) playerInfo.username = username;
  if (potatoes) playerInfo.potatoes = parseInt(potatoes.replace(/,/g, ""), 10);
  if (prestige) playerInfo.prestige = parseInt(prestige, 10);
  if (harvests) playerInfo.harvests = parseInt(harvests.replace(/,/g, ""), 10);
  if (steals) playerInfo.steals = parseInt(steals.replace(/,/g, ""), 10);
  if (stolenFrom) {
    playerInfo.stolenFrom = parseInt(stolenFrom.replace(/,/g, ""), 10);
  }
  if (farmSize) {
    const trimmed = farmSize.trim();
    playerInfo.farmSize = trimmed;
    const rank = RANK_BY_NAME.get(trimmed);
    if (rank !== undefined) playerInfo.rank = rank;
  }
  if (rankMatch?.[1] && rankMatch[2]) {
    playerInfo.leaderboardRank = parseInt(rankMatch[1], 10);
    playerInfo.totalPlayers = parseInt(rankMatch[2], 10);
  }
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
