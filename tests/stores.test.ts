import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { createEventStore } from "../src/db/event-store.js";
import { runMigrations } from "../src/db/migrations/index.js";
import { createQuizAnswerStore } from "../src/db/quiz-answer-store.js";

test("event store records summaries and retrieves full event details", () => {
  const database = new DatabaseSync(":memory:");
  runMigrations(database);
  const events = createEventStore(database);
  events.record({
    executedAt: "2026-08-12T12:00:00.000Z",
    command: "p",
    category: "harvest",
    delta: 50,
    balanceAfter: 150,
    responseText: "Harvested potatoes",
  });

  assert.deepEqual(
    events
      .list("2026-08-12T00:00:00.000Z", "2026-08-13T00:00:00.000Z")
      .map((event) => ({ ...event })),
    [
      {
        id: 1,
        executedAt: "2026-08-12T12:00:00.000Z",
        command: "p",
        category: "harvest",
        delta: 50,
        balanceAfter: 150,
      },
    ],
  );
  assert.deepEqual(events.get(1) ? { ...events.get(1) } : null, {
    id: 1,
    executedAt: "2026-08-12T12:00:00.000Z",
    command: "p",
    category: "harvest",
    delta: 50,
    balanceAfter: 150,
    responseText: "Harvested potatoes",
  });
  assert.equal(events.get(999), null);
  database.close();
});

test("quiz answer store updates and conditionally removes cached answers", () => {
  const database = new DatabaseSync(":memory:");
  runMigrations(database);
  const answers = createQuizAnswerStore(database);

  assert.equal(answers.get("2 + 2"), null);
  answers.save("2 + 2", "4");
  answers.save("2 + 2", "four");
  assert.equal(answers.get("2 + 2"), "four");
  const usage = database
    .prepare("SELECT useCount FROM quiz_answers WHERE question = ?")
    .get("2 + 2") as { useCount: number };
  assert.equal(usage.useCount, 2);
  answers.delete("2 + 2", "4");
  assert.equal(answers.get("2 + 2"), "four");
  answers.delete("2 + 2", "four");
  assert.equal(answers.get("2 + 2"), null);
  database.close();
});
