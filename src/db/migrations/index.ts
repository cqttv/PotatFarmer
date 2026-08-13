import type { DatabaseSync } from "node:sqlite";

import { log } from "../../logger.js";

import { createSchema } from "./001-create-schema.js";
import { removeUnsuccessfulEvents } from "./002-remove-unsuccessful-events.js";
import { normalizeEvents } from "./003-normalize-events.js";
import { addQuizStats } from "./004-add-quiz-stats.js";
import type { Migration } from "./types.js";

const MIGRATIONS: readonly Migration[] = [
  createSchema,
  removeUnsuccessfulEvents,
  normalizeEvents,
  addQuizStats,
];

export function runMigrations(db: DatabaseSync): void {
  const row = db.prepare("PRAGMA user_version").get() as
    | { user_version: number }
    | undefined;
  const currentVersion = row?.user_version ?? 0;
  if (currentVersion > MIGRATIONS.length) {
    throw new Error(
      `Database version ${currentVersion} is newer than supported version ${MIGRATIONS.length}`,
    );
  }

  for (const [index, migration] of MIGRATIONS.entries()) {
    if (index < currentVersion) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      migration.up(db);
      db.exec(`PRAGMA user_version = ${index + 1}`);
      db.exec("COMMIT");
      log.info("Database migration applied", {
        version: index + 1,
        name: migration.name,
      });
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
}
