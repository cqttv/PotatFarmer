export const Actions = {
  FARM: "p",
  CDR: "cdr",
  SHOP_CDR: "shop cdr",
  SHOP_GUARD: "shop guard",
  SHOP_FERTILIZER: "shop fertilizer",
  EAT: "eat",
  STEAL: "steal",
  RANKUP: "rankup",
  PRESTIGE: "prestige",
  RANK: "rank",
  QUIZ: "quiz",
  ANSWER: "a",
  SHOP_QUIZ: "shop quiz",
  STATUS: "status",
} as const;

export type Command = (typeof Actions)[keyof typeof Actions];

export const Rank = {
  Bankrupt: 0,
  BackyardGarden: 1,
  Greenhouse: 2,
  AcreFarm: 3,
  TenAcreFarm: 4,
  PotatoPlantation: 5,
  Industrial: 6,
} as const;

export type RankValue = (typeof Rank)[keyof typeof Rank];

// cdr has no server-side rejection if you can't afford it, cost is floor(15 * rank * (1 + prestige * 0.1))
function cdrCost(rank: RankValue, prestige: number): number {
  const effectiveRank = rank !== Rank.Bankrupt ? rank : 5;
  const prestigeMulti = prestige >= 1 ? 1 + prestige * 0.1 : 1;
  return Math.floor(15 * effectiveRank * prestigeMulti);
}

export function shouldRun(
  command: Command,
  {
    potatoes,
    rank,
    prestige,
  }: { potatoes: number; rank: RankValue; prestige: number },
): boolean {
  if (command === Actions.CDR) {
    // 100 potato buffer on top of the cost
    return potatoes >= cdrCost(rank, prestige) + 100;
  }
  return true;
}
