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

const SHOP_BUFFER = 100;

const SHOP_BASE_COSTS: Partial<Record<Command, number>> = {
  [Actions.SHOP_CDR]: 30,
  [Actions.SHOP_GUARD]: 100,
  [Actions.SHOP_FERTILIZER]: 30,
  [Actions.SHOP_QUIZ]: 125,
};

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
    return potatoes >= cdrCost(rank, prestige) + SHOP_BUFFER;
  }

  const shopBaseCost = SHOP_BASE_COSTS[command]; // eslint-disable-line security/detect-object-injection
  if (shopBaseCost !== undefined) {
    const shopCost = shopBaseCost * Math.max(1, rank);
    return potatoes >= shopCost + SHOP_BUFFER;
  }

  return true;
}
