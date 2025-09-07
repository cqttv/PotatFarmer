import { FarmPlan } from "@domain/plans/farmPlan";
import { logger } from "@shared/utils/logger";
import { sleep } from "@shared/utils/sleep";
import { MINUTE_MS } from "@shared/configs/msDurations";
import { runPlan } from "@application/planRunner";

import "dotenv/config";

async function run(): Promise<void> {
  logger.info("Starting Potat Farmer...");
  for (;;) {
    await runPlan(FarmPlan);
    await sleep(MINUTE_MS);
  }
}

await run();
