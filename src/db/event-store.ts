import { type DatabaseSync, type SQLInputValue } from "node:sqlite";

import { log } from "../logger.js";

import type { Event, EventSummary, NewEvent } from "./types.js";

export interface EventStore {
  record: (event: NewEvent) => void;
  list: (from: string, to: string) => EventSummary[];
  get: (id: number) => Event | null;
}

export function createEventStore(db: DatabaseSync): EventStore {
  const insert = db.prepare(`
    INSERT INTO events
      (executedAt, command, category, delta, balanceAfter, responseText)
    VALUES (@executedAt, @command, @category, @delta, @balanceAfter, @responseText)
  `);
  const list = db.prepare(`
    SELECT id, executedAt, command, category, delta, balanceAfter
    FROM events
    WHERE executedAt >= ? AND executedAt <= ?
    ORDER BY executedAt ASC, id ASC
  `);
  const get = db.prepare(`
    SELECT id, executedAt, command, category, delta, balanceAfter, responseText
    FROM events
    WHERE id = ?
  `);

  return {
    record(event): void {
      insert.run(event as unknown as Record<string, SQLInputValue>);
      log.debug("Event recorded", {
        command: event.command,
        category: event.category,
        delta: event.delta,
        balanceAfter: event.balanceAfter,
      });
    },
    list(from, to): EventSummary[] {
      return list.all(from, to) as unknown as EventSummary[];
    },
    get(id): Event | null {
      return (get.get(id) as unknown as Event | undefined) ?? null;
    },
  };
}
