import assert from "node:assert/strict";
import test from "node:test";

const handler = require("../api/cron/renew-recurring");

function responseMock() {
  return {
    statusCode: 0,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.body = body;
      return this;
    },
  };
}

test("recurring cron returns 401 when CRON_SECRET is not configured", async () => {
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    const res = responseMock();
    await handler({ method: "GET", headers: {} }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, "INVALID_CRON_TOKEN");
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test("recurring cron returns 401 for an invalid bearer token without echoing secrets", async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "expected-secret";
  try {
    const res = responseMock();
    await handler(
      { method: "GET", headers: { authorization: "Bearer received-secret" } },
      res
    );
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error.code, "INVALID_CRON_TOKEN");
    assert.doesNotMatch(JSON.stringify(res.body), /expected-secret|received-secret/);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
