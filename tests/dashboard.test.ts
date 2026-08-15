import assert from "node:assert/strict";
import test from "node:test";

import { DASHBOARD_HTML } from "../src/http/dashboard.js";

test("dashboard element IDs are unique", () => {
  const ids = [...DASHBOARD_HTML.matchAll(/\sid="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(ids).size, ids.length);
});
