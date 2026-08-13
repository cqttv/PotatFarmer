import type { Migration } from "./types.js";

export const normalizeEvents: Migration = {
  name: "normalize event history",
  up(db): void {
    db.exec(`
      UPDATE events SET category = 'spending' WHERE category = 'shop_cdr';
      DELETE FROM events WHERE command = 'status';
    `);
  },
};
