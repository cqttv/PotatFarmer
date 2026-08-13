import assert from "node:assert/strict";
import test from "node:test";

import { CommandError, sendCommand } from "../src/api/client.js";

const originalFetch = globalThis.fetch;

function mockResponse(
  json: unknown,
  { ok = true, status = 200 } = {},
): ReturnType<typeof fetch> {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(json),
  } as Awaited<ReturnType<typeof fetch>>);
}

test("sendCommand sends the PotatBotat command and preserves text/error semantics", async (t) => {
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const requests: {
    url: Parameters<typeof fetch>[0];
    init: Parameters<typeof fetch>[1];
  }[] = [];
  const payloads = [
    { statusCode: 200, data: { text: "harvested" } },
    { statusCode: 200, data: [{ error: "not ready" }] },
    { statusCode: 200, data: [] },
  ];
  globalThis.fetch = (url, init): ReturnType<typeof fetch> => {
    requests.push({ url, init });
    return mockResponse(payloads.shift());
  };

  assert.deepEqual(await sendCommand("p"), {
    text: "harvested",
    isError: false,
  });
  assert.deepEqual(await sendCommand("cdr"), {
    text: "not ready",
    isError: true,
  });
  assert.deepEqual(await sendCommand("status"), {
    text: null,
    isError: false,
  });
  assert.deepEqual(
    requests.map(({ url, init }) => ({
      url,
      method: init?.method,
      body: init?.body,
    })),
    [
      {
        url: "https://api.potat.app/execute",
        method: "POST",
        body: JSON.stringify({ text: "#p" }),
      },
      {
        url: "https://api.potat.app/execute",
        method: "POST",
        body: JSON.stringify({ text: "#cdr" }),
      },
      {
        url: "https://api.potat.app/execute",
        method: "POST",
        body: JSON.stringify({ text: "#status" }),
      },
    ],
  );
});

test("sendCommand rejects HTTP and API failures with the API status and messages", async (t) => {
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (): ReturnType<typeof fetch> =>
    mockResponse(
      {
        statusCode: 429,
        data: {},
        errors: [{ message: "daily limit" }, { message: "try later" }],
      },
      { ok: false, status: 503 },
    );

  await assert.rejects(
    sendCommand("p"),
    (error: unknown) =>
      error instanceof CommandError &&
      error.status === 429 &&
      error.message === "daily limit; try later" &&
      error.responseText === "daily limit; try later",
  );
});
