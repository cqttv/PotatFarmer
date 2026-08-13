import type { DatabaseSync } from "node:sqlite";

export interface Migration {
  name: string;
  up: (db: DatabaseSync) => void;
}
