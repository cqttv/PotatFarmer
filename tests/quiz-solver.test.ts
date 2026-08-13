import assert from "node:assert/strict";
import test from "node:test";

import { answerQuizQuestion } from "../src/quiz/solver.js";

const originalFetch = globalThis.fetch;

function mockResponse(
  json: unknown,
  { ok = true, status = 200, text = "" } = {},
): ReturnType<typeof fetch> {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(json),
    text: () => Promise.resolve(text),
  } as Awaited<ReturnType<typeof fetch>>);
}

test("quiz solver sends rejected answers and accepts a numeric-only response", async (t) => {
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestedUrl: Parameters<typeof fetch>[0] | undefined;
  let requestedInit: Parameters<typeof fetch>[1];
  globalThis.fetch = (input, init): ReturnType<typeof fetch> => {
    requestedUrl = input;
    requestedInit = init;
    return mockResponse({
      choices: [{ message: { content: "  -12.5  " } }],
    });
  };

  assert.equal(
    await answerQuizQuestion("What is 5 - 17.5?", ["12.5", "-13"]),
    "-12.5",
  );
  assert.equal(requestedUrl, "https://api.openai.com/v1/chat/completions");
  assert.ok(requestedInit);
  assert.equal(requestedInit.method, "POST");

  assert.deepEqual(requestedInit.headers, {
    Authorization: "Bearer ",
    "Content-Type": "application/json",
  });
  const requestBody = requestedInit.body;
  assert.ok(typeof requestBody === "string");
  const body = JSON.parse(requestBody) as {
    messages: { role: string; content: string }[];
    max_completion_tokens: number;
    reasoning_effort: string;
    service_tier: string;
    store: boolean;
  };
  assert.match(body.messages[1]?.content ?? "", /12\.5, -13/);
  assert.equal(body.max_completion_tokens, 100);
  assert.equal(body.reasoning_effort, "minimal");
  assert.equal(body.service_tier, "flex");
  assert.equal(body.store, false);
});

test("quiz solver rejects formatted, missing, and unsuccessful responses", async (t) => {
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  for (const content of ["The answer is 42", "**42**", "1,000", "4."]) {
    globalThis.fetch = (): ReturnType<typeof fetch> =>
      mockResponse({ choices: [{ message: { content } }] });
    assert.equal(await answerQuizQuestion("question", []), null, content);
  }

  globalThis.fetch = (): ReturnType<typeof fetch> =>
    mockResponse({ choices: [] });
  assert.equal(await answerQuizQuestion("question", []), null);

  globalThis.fetch = (): ReturnType<typeof fetch> =>
    mockResponse({}, { ok: false, status: 429, text: "rate limited" });
  assert.equal(await answerQuizQuestion("question", []), null);

  globalThis.fetch = (): ReturnType<typeof fetch> =>
    Promise.reject(new Error("network unavailable"));
  assert.equal(await answerQuizQuestion("question", []), null);
});
