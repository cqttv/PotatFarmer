import { FARM_PLAN } from "@domain/plans";
import { logger, sleep } from "@shared/utils";
import { MINUTE_MS } from "@shared/config";
import { runPlan } from "@application/planRunner";

import "dotenv/config";

async function run(): Promise<void> {
  logger.info("Starting Potat Farmer...");
  for (;;) {
    await runPlan(FARM_PLAN);
    await sleep(MINUTE_MS);
  }
}

await run();
