import { columnsFor } from "./helpers.js";
import type { Migration } from "./types.js";

const QUIZ_COLUMNS = [
  "quizReward",
  "quizAttempts",
  "quizSuccesses",
  "quizFailures",
  "quizAnswerAttempts",
  "quizIncorrectAnswers",
  "quizCacheHits",
  "quizApiCalls",
] as const;

export const addQuizStats: Migration = {
  name: "add quiz statistics",
  up(db): void {
    for (const table of ["totals", "daily"] as const) {
      let columns = columnsFor(db, table);
      if (
        columns.includes("quizOpenAICalls") &&
        !columns.includes("quizApiCalls")
      ) {
        db.exec(
          `ALTER TABLE ${table} RENAME COLUMN quizOpenAICalls TO quizApiCalls`,
        );
        columns = columns.map((column) =>
          column === "quizOpenAICalls" ? "quizApiCalls" : column,
        );
      }
      for (const column of QUIZ_COLUMNS) {
        if (!columns.includes(column)) {
          db.exec(
            `ALTER TABLE ${table} ADD COLUMN ${column} INTEGER NOT NULL DEFAULT 0`,
          );
        }
      }
    }
  },
};
