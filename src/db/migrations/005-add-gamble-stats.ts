import { columnsFor } from "./helpers.js";
import type { Migration } from "./types.js";

const GAMBLE_COLUMNS = ["gamble", "gambleAttempts", "gambleWins"] as const;

export const addGambleStats: Migration = {
  name: "add gamble statistics",
  up(db): void {
    for (const table of ["totals", "daily"] as const) {
      const columns = columnsFor(db, table);
      for (const column of GAMBLE_COLUMNS) {
        if (!columns.includes(column)) {
          db.exec(
            `ALTER TABLE ${table} ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`,
          );
        }
      }
    }
  },
};
