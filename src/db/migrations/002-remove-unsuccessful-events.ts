import { columnsFor } from "./helpers.js";
import type { Migration } from "./types.js";

export const removeUnsuccessfulEvents: Migration = {
  name: "remove unsuccessful command events",
  up(db): void {
    if (!columnsFor(db, "events").includes("succeeded")) return;
    db.exec(`
      UPDATE events
      SET category = 'quiz_failure'
      WHERE succeeded = 0
        AND category = 'quiz'
        AND responseText = 'Quiz attempt failed';
      DELETE FROM events
      WHERE succeeded = 0 AND category != 'quiz_failure';
      ALTER TABLE events DROP COLUMN succeeded;
    `);
  },
};
