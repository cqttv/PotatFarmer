import assert from "node:assert/strict";
import test from "node:test";

import { parseApiResponse } from "../src/api/response.js";

test("parseApiResponse normalizes single and array results", () => {
  assert.deepEqual(
    parseApiResponse({ statusCode: 200, data: { text: "done" } }),
    { statusCode: 200, data: { text: "done" } },
  );
  assert.deepEqual(
    parseApiResponse({
      statusCode: 400,
      data: [{ error: "nope" }],
      errors: [{ message: "bad" }],
    }),
    {
      statusCode: 400,
      data: [{ error: "nope" }],
      errors: [{ message: "bad" }],
    },
  );
});

test("parseApiResponse rejects malformed payloads", () => {
  assert.throws(() => parseApiResponse(null));
  assert.throws(() => parseApiResponse({ statusCode: "200", data: {} }));
  assert.throws(() => parseApiResponse({ statusCode: 200, data: [null] }));
  assert.throws(() =>
    parseApiResponse({ statusCode: 200, data: { text: 123 } }),
  );
  assert.throws(() =>
    parseApiResponse({ statusCode: 200, data: {}, errors: [{ message: 123 }] }),
  );
  assert.throws(() =>
    parseApiResponse({ statusCode: 200, data: {}, errors: "bad" }),
  );
});
