import { FIFTEEN_SECONDS_MS } from "@shared/configs/msDurations";
import { Actions } from "@domain/actions";
import type { CommandPlan } from "@domain/interfaces/commandPlan";

export const FarmPlan: CommandPlan = {
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
