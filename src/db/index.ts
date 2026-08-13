import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { log } from "../logger.js";

import { createEventStore, type EventStore } from "./event-store.js";
import { runMigrations } from "./migrations/index.js";
import {
  createQuizAnswerStore,
  type QuizAnswerStore,
} from "./quiz-answer-store.js";
import {
  createStatsStore,
  type StatsCache,
  type StatsStore,
  ZERO_STATS,
} from "./stats-store.js";
import type { Event, EventSummary, NewEvent, StatsRow } from "./types.js";

export { addToStats, ZERO_STATS } from "./stats-store.js";
export type { Event, EventSummary, NewEvent, StatsRow } from "./types.js";

const DEFAULT_DATABASE_PATH = "data/stats.db";

interface Stores {
  stats: StatsStore;
  events: EventStore;
  quizAnswers: QuizAnswerStore;
}

let database: DatabaseSync | null = null;
let stores: Stores | null = null;

export const cache: StatsCache = {
  totals: { ...ZERO_STATS },
  today: { ...ZERO_STATS },
  week: { ...ZERO_STATS },
};

function requireStores(): Stores {
  if (!stores) throw new Error("Database has not been initialized");
  return stores;
}

export function initDb(path = DEFAULT_DATABASE_PATH): void {
  if (database) return;
  const startedAt = Date.now();
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  mkdirSync(dirname(path), { recursive: true });
  const nextDatabase = new DatabaseSync(path);

  try {
    nextDatabase.exec("PRAGMA journal_mode = WAL");
    runMigrations(nextDatabase);
    const stats = createStatsStore(nextDatabase, cache);
    stores = {
      stats,
      events: createEventStore(nextDatabase),
      quizAnswers: createQuizAnswerStore(nextDatabase),
    };
    stats.loadCache();
    database = nextDatabase;
  } catch (error) {
    nextDatabase.close();
    throw error;
  }

  log.info("Database initialized", {
    path,
    durationMs: Date.now() - startedAt,
  });
}

export function closeDb(): void {
  if (!database) return;
  database.close();
  database = null;
  stores = null;
  log.info("Database closed");
}

export function record(stats: StatsRow): void {
  requireStores().stats.record(stats);
}

export function recordEvent(event: NewEvent): void {
  requireStores().events.record(event);
}

export function getEvents(from: string, to: string): EventSummary[] {
  return requireStores().events.list(from, to);
}

export function getEvent(id: number): Event | null {
  return requireStores().events.get(id);
}

export function getQuizAnswer(question: string): string | null {
  return requireStores().quizAnswers.get(question);
}

export function saveQuizAnswer(question: string, answer: string): void {
  requireStores().quizAnswers.save(question, answer);
}

export function deleteQuizAnswer(question: string, answer: string): void {
  requireStores().quizAnswers.delete(question, answer);
}
