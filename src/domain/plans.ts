import { FIFTEEN_SECONDS_MS } from "@shared/config";
import type { CommandPlan } from "@domain/types";
import { Actions } from "@domain/actions";

export const FARM_PLAN: CommandPlan = {
  name: "Farming Plan",
  commands: [
    { command: Actions.SHOP_CDR, delay: FIFTEEN_SECONDS_MS },
    { command: Actions.CDR, delay: FIFTEEN_SECONDS_MS },
    { command: Actions.FARM, delay: FIFTEEN_SECONDS_MS },
    { command: Actions.STEAL, delay: FIFTEEN_SECONDS_MS },
    { command: Actions.TRAMPLE, delay: FIFTEEN_SECONDS_MS },
    { command: Actions.RANKUP, delay: FIFTEEN_SECONDS_MS },
    { command: Actions.PRESTIGE, delay: FIFTEEN_SECONDS_MS },
  ],
};
