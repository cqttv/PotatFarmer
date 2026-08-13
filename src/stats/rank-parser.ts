import { Rank, type RankValue } from "../plans.js";

export interface ParsedPlayerInfo {
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

export function parseRankResponse(text: string): Partial<ParsedPlayerInfo> {
  const parsed: Partial<ParsedPlayerInfo> = {};
  const username = text.match(/(\w+)/)?.[1];
  const potatoes = text.match(/has (-?[\d,]+) potatoes/)?.[1];
  const prestige = text.match(/Prestige: (\d+)/)?.[1];
  const harvests = text.match(/Harvests: ([\d,]+)/)?.[1];
  const steals = text.match(/Stole ([\d,]+) times?/)?.[1];
  const stolenFrom = text.match(/Stolen from ([\d,]+) times?/)?.[1];
  const farmSize = text.match(/Farm: ([^●]+)/)?.[1];
  const rankMatch = text.match(/Ranked #([\d,]+)\/([\d,]+)/);

  if (username) parsed.username = username;
  if (potatoes) parsed.potatoes = parseInt(potatoes.replace(/,/g, ""), 10);
  if (prestige) parsed.prestige = parseInt(prestige, 10);
  if (harvests) parsed.harvests = parseInt(harvests.replace(/,/g, ""), 10);
  if (steals) parsed.steals = parseInt(steals.replace(/,/g, ""), 10);
  if (stolenFrom) {
    parsed.stolenFrom = parseInt(stolenFrom.replace(/,/g, ""), 10);
  }
  if (farmSize) {
    const trimmed = farmSize.trim();
    parsed.farmSize = trimmed;
    const rank = RANK_BY_NAME.get(trimmed);
    if (rank !== undefined) parsed.rank = rank;
  }
  if (rankMatch?.[1] && rankMatch[2]) {
    parsed.leaderboardRank = parseInt(rankMatch[1].replace(/,/g, ""), 10);
    parsed.totalPlayers = parseInt(rankMatch[2].replace(/,/g, ""), 10);
  }
  return parsed;
}
