import { CREATE_SCHEMA_SQL } from "../schema.js";

import { tableExists } from "./helpers.js";
import type { Migration } from "./types.js";

export const createSchema: Migration = {
  name: "create current schema",
  up(db): void {
    const hasLegacyEvents = tableExists(db, "balance_events");
    const hasEvents = tableExists(db, "events");
    if (hasLegacyEvents && !hasEvents) {
      db.exec("ALTER TABLE balance_events RENAME TO events");
    } else if (hasLegacyEvents) {
      db.exec(`
        INSERT INTO events
          (executedAt, command, category, delta, balanceAfter, responseText)
        SELECT executedAt, command, category, delta, balanceAfter, responseText
        FROM balance_events;
        DROP TABLE balance_events;
      `);
    }
    db.exec(CREATE_SCHEMA_SQL);
  },
};
