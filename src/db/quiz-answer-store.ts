import type { DatabaseSync } from "node:sqlite";

import { log } from "../logger.js";

export interface QuizAnswerStore {
  get: (question: string) => string | null;
  save: (question: string, answer: string) => void;
  delete: (question: string, answer: string) => void;
}

export function createQuizAnswerStore(db: DatabaseSync): QuizAnswerStore {
  const get = db.prepare("SELECT answer FROM quiz_answers WHERE question = ?");
  const save = db.prepare(`
    INSERT INTO quiz_answers (question, answer, createdAt, lastUsedAt, useCount)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT(question) DO UPDATE SET
      answer = excluded.answer,
      lastUsedAt = excluded.lastUsedAt,
      useCount = quiz_answers.useCount + 1
  `);
  const remove = db.prepare(
    "DELETE FROM quiz_answers WHERE question = ? AND answer = ?",
  );

  return {
    get(question): string | null {
      const row = get.get(question) as { answer: string } | undefined;
      return row?.answer ?? null;
    },
    save(question, answer): void {
      const now = new Date().toISOString();
      save.run(question, answer, now, now);
      log.debug("Quiz answer cached", { question, answer });
    },
    delete(question, answer): void {
      remove.run(question, answer);
      log.info("Invalid quiz answer removed from cache", { question, answer });
    },
  };
}
