import test from "node:test";
import assert from "node:assert/strict";
import {
  runIdempotentCommand,
  validateIdempotencyIdentifiers,
  validateStoredTransactionReplay,
} from "../api/_lib/idempotency";

type Row = Record<string, any>;

type Store = {
  rows: Row[];
  insertError: any;
  updateErrors: number;
  updateCalls: number;
  upsertCalls: number;
  upsertError: any;
};

function matches(row: Row, filters: Row) {
  return Object.entries(filters).every(([key, value]) =>
    String(row[key]) === String(value)
  );
}

class Query {
  store: Store;
  op: string;
  payload: any;
  filters: Row = {};
  limitN: number | null = null;

  constructor(store: Store, op: string, payload?: any) {
    this.store = store;
    this.op = op;
    this.payload = payload;
  }

  select() { return this; }
  eq(key: string, value: any) { this.filters[key] = value; return this; }
  limit(value: number) { this.limitN = value; return this; }
  then(resolve: any, reject: any) { return this.exec().then(resolve, reject); }

  async exec() {
    const store = this.store;

    if (this.op === "select") {
      return {
        data: store.rows
          .filter((row) => matches(row, this.filters))
          .slice(0, this.limitN ?? Infinity)
          .map((row) => ({ ...row })),
        error: null,
      };
    }

    if (this.op === "insert") {
      if (store.insertError) return { data: null, error: store.insertError };
      const payload = this.payload;
      const duplicate = store.rows.find(
        (row) =>
          row.user_id === payload.user_id &&
          row.route === payload.route &&
          row.idempotency_key === payload.idempotency_key
      );
      if (duplicate) {
        return {
          data: null,
          error: {
            code: "23505",
            message: "duplicate key value violates unique constraint",
          },
        };
      }
      store.rows.push({ ...payload });
      return { data: null, error: null };
    }

    if (this.op === "update") {
      store.updateCalls += 1;
      if (store.updateErrors > 0) {
        store.updateErrors -= 1;
        return {
          data: null,
          error: { code: "XX001", message: "transient update" },
        };
      }
      for (const row of store.rows.filter((row) => matches(row, this.filters))) {
        Object.assign(row, this.payload);
      }
      return { data: null, error: null };
    }

    if (this.op === "delete") {
      store.rows = store.rows.filter((row) => !matches(row, this.filters));
      return { data: null, error: null };
    }

    if (this.op === "upsert") {
      store.upsertCalls += 1;
      if (store.upsertError) return { data: null, error: store.upsertError };
      const payload = this.payload;
      const index = store.rows.findIndex(
        (row) =>
          row.user_id === payload.user_id &&
          row.route === payload.route &&
          row.idempotency_key === payload.idempotency_key
      );
      if (index >= 0) store.rows[index] = { ...store.rows[index], ...payload };
      else store.rows.push({ ...payload });
      return { data: null, error: null };
    }

    throw new Error(`Unknown operation: ${this.op}`);
  }
}

function fakeSupabase() {
  const store: Store = {
    rows: [],
    insertError: null,
    updateErrors: 0,
    updateCalls: 0,
    upsertCalls: 0,
    upsertError: null,
  };

  return {
    store,
    from() {
      return {
        select: () => new Query(store, "select"),
        insert: (payload: any) => new Query(store, "insert", payload),
        update: (payload: any) => new Query(store, "update", payload),
        delete: () => new Query(store, "delete"),
        upsert: (payload: any) => new Query(store, "upsert", payload),
      };
    },
  };
}

const base = {
  userId: "11111111-1111-1111-1111-111111111111",
  providerMessageId: "msg1",
  idempotencyKey: "nimble:msg1:create_transaction",
  route: "POST:create_transaction",
  requestBody: { amount: 10 },
};

test("idempotency stores response and replays without executing twice", async () => {
  const supabase = fakeSupabase();
  let calls = 0;

  const first = await runIdempotentCommand({
    ...base,
    supabase,
    execute: async () => {
      calls += 1;
      return { statusCode: 201, body: { ok: true, id: 1 } };
    },
  });

  const replay = await runIdempotentCommand({
    ...base,
    supabase,
    execute: async () => {
      calls += 1;
      return { statusCode: 201, body: { ok: true, id: 2 } };
    },
  });

  assert.equal(calls, 1);
  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.deepEqual(replay.body, { ok: true, id: 1 });
});

test("idempotency rejects same key with different payload", async () => {
  const supabase = fakeSupabase();

  await runIdempotentCommand({
    ...base,
    supabase,
    execute: async () => ({ statusCode: 201, body: { ok: true } }),
  });

  await assert.rejects(
    () =>
      runIdempotentCommand({
        ...base,
        supabase,
        requestBody: { amount: 11 },
        execute: async () => ({ statusCode: 201, body: { ok: true } }),
      }),
    (error: any) => error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH"
  );
});

test("concurrent retry does not execute the financial mutation twice", async () => {
  const supabase = fakeSupabase();
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });

  const first = runIdempotentCommand({
    ...base,
    supabase,
    execute: async () => {
      calls += 1;
      await gate;
      return { statusCode: 201, body: { ok: true, id: 1 } };
    },
  });

  await new Promise((resolve) => setImmediate(resolve));

  await assert.rejects(
    () =>
      runIdempotentCommand({
        ...base,
        supabase,
        execute: async () => {
          calls += 1;
          return { statusCode: 201, body: { ok: true, id: 2 } };
        },
      }),
    (error: any) => error.code === "IDEMPOTENCY_IN_PROGRESS"
  );

  assert.equal(calls, 1);
  release();
  await first;
  assert.equal(calls, 1);
});

test("reservation failure occurs before any financial mutation", async () => {
  const supabase = fakeSupabase();
  supabase.store.insertError = { code: "XX000", message: "db unavailable" };
  let calls = 0;

  await assert.rejects(
    () =>
      runIdempotentCommand({
        ...base,
        supabase,
        execute: async () => {
          calls += 1;
          return { statusCode: 201, body: { ok: true } };
        },
      }),
    (error: any) => error.code === "IDEMPOTENCY_STORE_UNAVAILABLE"
  );

  assert.equal(calls, 0);
});

test("final response persistence retries without re-executing mutation", async () => {
  const supabase = fakeSupabase();
  supabase.store.updateErrors = 2;
  let calls = 0;

  const result = await runIdempotentCommand({
    ...base,
    supabase,
    execute: async () => {
      calls += 1;
      return { statusCode: 201, body: { ok: true, id: 1 } };
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.statusCode, 201);
  assert.equal(supabase.store.updateCalls, 2);
  assert.equal(supabase.store.upsertCalls, 1);
});


test("weak confirmation text cannot be used as provider message id or idempotency key", () => {
  assert.throws(
    () =>
      validateIdempotencyIdentifiers({
        providerMessageId: "Sim",
        idempotencyKey: "Sim",
        action: "create_transfer",
      }),
    (error: any) => error.code === "PROVIDER_MESSAGE_ID_INVALID"
  );

  assert.throws(
    () =>
      validateIdempotencyIdentifiers({
        providerMessageId: "wamid.HBgLMESSAGE123456789",
        idempotencyKey: "Pode",
        action: "create_transfer",
      }),
    (error: any) => error.code === "IDEMPOTENCY_KEY_INVALID"
  );
});

test("real provider message ids and strong idempotency keys are accepted", () => {
  const providerMessageId = "wamid.HBgLMESSAGE123456789";
  const idempotencyKey = `nimble:${providerMessageId}:create_transfer`;

  assert.deepEqual(
    validateIdempotencyIdentifiers({
      providerMessageId,
      idempotencyKey,
      action: "create_transfer",
    }),
    { providerMessageId, idempotencyKey }
  );
});

test("replay validator can block a stale stored success without re-executing", async () => {
  const supabase = fakeSupabase();
  let calls = 0;

  await runIdempotentCommand({
    ...base,
    supabase,
    execute: async () => {
      calls += 1;
      return {
        statusCode: 201,
        body: { ok: true, transactions: [{ id: "deleted-transaction" }] },
      };
    },
  });

  await assert.rejects(
    () =>
      runIdempotentCommand({
        ...base,
        supabase,
        execute: async () => {
          calls += 1;
          return { statusCode: 201, body: { ok: true } };
        },
        validateReplay: (async () => {
          const error: any = new Error("missing resource");
          error.code = "IDEMPOTENCY_REPLAY_RESOURCE_MISSING";
          throw error;
        }) as any,
      }),
    (error: any) => error.code === "IDEMPOTENCY_REPLAY_RESOURCE_MISSING"
  );

  assert.equal(calls, 1);
});


test("stored transfer replay succeeds only while all transaction ids still exist", async () => {
  const existingIds = new Set(["tx-out", "tx-in"]);
  const supabase = {
    from(table: string) {
      assert.equal(table, "transactions");
      return {
        select() { return this; },
        eq() { return this; },
        async in(_column: string, ids: string[]) {
          return {
            data: ids.filter((id) => existingIds.has(id)).map((id) => ({ id })),
            error: null,
          };
        },
      };
    },
  };

  const result = await validateStoredTransactionReplay({
    supabase,
    userId: base.userId,
    operation: "create_transfer",
    responseBody: {
      transactions: [{ id: "tx-out" }, { id: "tx-in" }],
    },
  });

  assert.deepEqual(result.transactionIds, ["tx-out", "tx-in"]);
});

test("stored transfer replay returns 409 when any transaction was deleted", async () => {
  const supabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        async in() {
          return { data: [{ id: "tx-out" }], error: null };
        },
      };
    },
  };

  await assert.rejects(
    () =>
      validateStoredTransactionReplay({
        supabase,
        userId: base.userId,
        operation: "create_transfer",
        responseBody: {
          transactions: [{ id: "tx-out" }, { id: "tx-in" }],
        },
      }),
    (error: any) =>
      error.code === "IDEMPOTENCY_REPLAY_RESOURCE_MISSING" &&
      error.statusCode === 409 &&
      error.details?.missing_transaction_ids?.[0] === "tx-in"
  );
});
