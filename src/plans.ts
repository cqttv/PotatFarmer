export const Actions = {
  FARM: "p",
  CDR: "cdr",
  SHOP_CDR: "shop cdr",
  SHOP_GUARD: "shop guard",
  SHOP_FERTILIZER: "shop fertilizer",
  EAT: "eat",
  STEAL: "steal",
  GAMBLE: "gamble",
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

const RANKUP_COSTS: Partial<Record<RankValue, number>> = {
  [Rank.Bankrupt]: 200,
  [Rank.BackyardGarden]: 1_000,
  [Rank.Greenhouse]: 5_000,
  [Rank.AcreFarm]: 10_000,
  [Rank.TenAcreFarm]: 25_000,
  [Rank.PotatoPlantation]: 50_000,
};

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

export interface ProgressionReadiness {
  rankupReady: boolean;
  prestigeReady: boolean;
}

export function progressionReadiness({
  potatoes,
  rank,
  prestige,
}: {
  potatoes: number;
  rank: RankValue;
  prestige: number;
}): ProgressionReadiness {
  const rankupCost = RANKUP_COSTS[rank]; // eslint-disable-line security/detect-object-injection
  return {
    rankupReady: rankupCost !== undefined && potatoes >= rankupCost,
    prestigeReady:
      rank === Rank.Industrial && potatoes >= 100_000 + 20_000 * prestige,
  };
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
    const followUpCost =
      command === Actions.SHOP_CDR ? cdrCost(rank, prestige) : 0;
    return potatoes >= shopCost + followUpCost + SHOP_BUFFER;
  }

  return true;
}
