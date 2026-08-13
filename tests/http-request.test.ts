import assert from "node:assert/strict";
import test from "node:test";

import { parseEventRange } from "../src/http/request.js";

const NOW = Date.parse("2026-08-12T12:00:00.000Z");

test("parseEventRange supplies a stable default one-day window", () => {
  assert.deepEqual(parseEventRange(new URLSearchParams(), NOW), {
    from: "2026-08-11T12:00:00.000Z",
    to: "2026-08-12T12:00:00.000Z",
  });
});

test("parseEventRange normalizes valid dates", () => {
  const query = new URLSearchParams({
    from: "2026-08-01T08:30:00-04:00",
    to: "2026-08-02T08:30:00-04:00",
  });
  assert.deepEqual(parseEventRange(query, NOW), {
    from: "2026-08-01T12:30:00.000Z",
    to: "2026-08-02T12:30:00.000Z",
  });
});

test("parseEventRange falls back when a date is invalid", () => {
  assert.deepEqual(
    parseEventRange(new URLSearchParams({ from: "tomorrowish" }), NOW),
    {
      from: "2026-08-11T12:00:00.000Z",
      to: "2026-08-12T12:00:00.000Z",
    },
  );
});

test("parseEventRange falls back independently for blank and invalid bounds", () => {
  assert.deepEqual(
    parseEventRange(
      new URLSearchParams({
        from: " ",
        to: "not-a-date",
      }),
      NOW,
    ),
    {
      from: "2026-08-11T12:00:00.000Z",
      to: "2026-08-12T12:00:00.000Z",
    },
  );
  assert.deepEqual(
    parseEventRange(
      new URLSearchParams({
        from: "2026-08-01T00:00:00Z",
        to: "not-a-date",
      }),
      NOW,
    ),
    {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-12T12:00:00.000Z",
    },
  );
});
