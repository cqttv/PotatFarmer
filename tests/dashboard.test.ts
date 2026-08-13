import assert from "node:assert/strict";
import test from "node:test";
import { Script } from "node:vm";

import { DASHBOARD_HTML } from "../src/http/dashboard.js";

test("dashboard contains syntactically valid embedded JavaScript", () => {
  const script = DASHBOARD_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script, "dashboard script is missing");
  assert.doesNotThrow(() => {
    new Script(script, { filename: "dashboard.js" });
  });
});

test("dashboard element IDs are unique", () => {
  const ids = [...DASHBOARD_HTML.matchAll(/\sid="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(new Set(ids).size, ids.length);
});
