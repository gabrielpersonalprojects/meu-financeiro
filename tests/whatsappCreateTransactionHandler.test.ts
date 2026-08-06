import test from "node:test";
import assert from "node:assert/strict";

type Row = Record<string, any>;

class Query {
  private rows: Row[];
  private inserted: Row[] | null = null;

  constructor(private table: string, private store: Record<string, Row[]>, rows?: Row[]) {
    this.rows = (rows ?? store[table] ?? []).map((row) => ({ ...row }));
  }

  select() { return this; }
  not() { return this; }
  eq(field: string, value: unknown) {
    this.rows = this.rows.filter((row) => String(row[field]) === String(value));
    return this;
  }
  order() { return this; }
  insert(payload: Row | Row[]) {
    const items = (Array.isArray(payload) ? payload : [payload]).map((row, index) => ({
      id: row.id ?? `created-${this.store.transactions.length + index + 1}`,
      ...row,
    }));
    this.store[this.table].push(...items);
    this.rows = items;
    this.inserted = items;
    return this;
  }
  maybeSingle() {
    return Promise.resolve({ data: this.rows[0] ?? null, error: null });
  }
  single() {
    return Promise.resolve({ data: this.rows[0] ?? null, error: null });
  }
  then(resolve: any, reject: any) {
    return Promise.resolve({ data: this.rows, error: null }).then(resolve, reject);
  }
}

function createSupabase(options: { removeDestinationBeforeSecondValidation?: boolean } = {}) {
  const calls: string[] = [];
  let accountQueryCount = 0;
  const store: Record<string, Row[]> = {
    user_access: [{ user_id: "user-1", whatsapp_number: "5511999999999" }],
    accounts: [{
      id: "6d61847f-12dd-4167-8039-0a5a9fc8a49b",
      user_id: "user-1",
      name: "Conta Preview",
      banco: "Banco",
      perfil_conta: "pj",
      tipo_conta: "corrente",
    }, {
      id: "40fe8db6-35a4-4e5d-84aa-f92a2bba7c28",
      user_id: "user-1",
      name: "Conta Destino Canonica",
      banco: "Banco Destino",
      perfil_conta: "pj",
      tipo_conta: "poupanca",
    }, {
      id: "ab765f75-1261-4c9a-a11c-bc708e45ea58",
      user_id: "user-2",
      name: "Other account",
      banco: "Bank",
      perfil_conta: "pf",
    }],
    credit_cards: [],
    user_tags: [],
    user_categories: [
      { id: "delivery-real-id", user_id: "user-1", profile_id: "pf", tipo: "despesa", nome: "Delivery" },
    ],
    transactions: [],
  };
  return {
    store,
    calls,
    client: { from: (table: string) => {
      calls.push(table);
      if (table === "accounts") {
        accountQueryCount += 1;
        if (options.removeDestinationBeforeSecondValidation && accountQueryCount === 3) {
          store.accounts = store.accounts.filter(
            (account) => account.id !== "40fe8db6-35a4-4e5d-84aa-f92a2bba7c28"
          );
        }
      }
      return new Query(table, store);
    } },
  };
}

function response() {
  const res: any = {
    statusCode: 0,
    body: null,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { res.headers[name] = value; },
    status(code: number) { res.statusCode = code; return res; },
    json(body: any) { res.body = body; return res; },
  };
  return res;
}

function loadRealHandler(supabase: any) {
  const adminPath = require.resolve("../api/_lib/supabaseAdmin");
  const idempotencyPath = require.resolve("../api/_lib/idempotency");
  const handlerPath = require.resolve("../api/v1/whatsapp");
  const admin = require(adminPath);
  const idempotency = require(idempotencyPath);
  admin.getSupabaseAdmin = () => supabase;
  idempotency.requireIdempotencyKey = () => "preview-regression-key";
  idempotency.validateIdempotencyIdentifiers = () => undefined;
  idempotency.runIdempotentCommand = async ({ execute }: any) => ({
    ...(await execute()),
    replayed: false,
  });
  delete require.cache[handlerPath];
  return require(handlerPath);
}

const baseBody = {
  whatsapp_phone: "5511999999999",
  provider_message_id: "preview-message-001",
  confirmed: true,
  type: "despesa",
  category: "Alimentação",
  account_id: "6d61847f-12dd-4167-8039-0a5a9fc8a49b",
  description: "TESTE API - Alimentação",
  amount: 0.01,
  date: "2026-08-03",
  paid: false,
  payment_method: "pix",
  spending_type: "variavel",
};

async function invoke(handler: any, body: Row) {
  const req: any = {
    method: "POST",
    query: { action: "create_transaction" },
    headers: { authorization: "Bearer integration-token", "x-idempotency-key": "preview-regression-key" },
    body,
  };
  const res = response();
  await handler(req, res);
  return res;
}

async function invokeAction(handler: any, action: string, body: Row) {
  const headers: Record<string, string> = {
    authorization: "Bearer integration-token",
  };
  if (action !== "validate_transfer_accounts") {
    headers["x-idempotency-key"] = `test-${action}-${body.provider_message_id || "write"}`;
  }
  const req: any = {
    method: "POST",
    query: { action },
    headers,
    body,
  };
  const res = response();
  await handler(req, res);
  return res;
}

test("handler real aceita categoria nativa do contexto e persiste o nome canônico", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invoke(handler, baseBody);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.equal(db.store.transactions.length, 1);
  assert.equal(db.store.transactions[0].categoria, "Alimentação");
  assert.notEqual(db.store.transactions[0].categoria, "native:despesa:alimentacao");
  assert.equal(db.store.user_categories.some((row) => row.nome === "Alimentação"), false);
});

test("handler real aceita personalizada histórica e rejeita inexistente ou receita em despesa", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const custom = await invoke(handler, { ...baseBody, provider_message_id: "preview-message-002", category: " delivery " });
  assert.equal(custom.statusCode, 201);
  assert.equal(db.store.transactions[0].categoria, "Delivery");

  const missing = await invoke(handler, { ...baseBody, provider_message_id: "preview-message-003", category: "Inexistente" });
  assert.equal(missing.statusCode, 400);
  assert.equal(missing.body.error.code, "CATEGORY_NOT_FOUND");

  const wrongType = await invoke(handler, { ...baseBody, provider_message_id: "preview-message-004", category: "Salário" });
  assert.equal(wrongType.statusCode, 400);
  assert.equal(wrongType.body.error.code, "CATEGORY_NOT_FOUND");
});

test("real handler rejects non-UUID account_id before querying accounts", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";

  for (const [accountId, label] of [
    ["account_nu", "alias"],
    ["Nu Teste", "account name"],
    ["6d61847f-12dd-4167-8039", "malformed UUID"],
  ]) {
    const db = createSupabase();
    const handler = loadRealHandler(db.client);
    const res = await invoke(handler, {
      ...baseBody,
      provider_message_id: `invalid-${label}`,
      account_id: accountId,
      account_name: "Nu Teste",
    });

    assert.equal(res.statusCode, 400, label);
    assert.equal(res.body.error.code, "ACCOUNT_ID_INVALID", label);
    assert.equal(res.body.error.message, "account_id must be a valid account UUID returned by context.");
    assert.equal(db.calls.includes("accounts"), false, label);
    assert.equal(db.store.transactions.length, 0, label);
  }
});

test("real handler rejects empty account_id without HTTP 500", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invoke(handler, {
    ...baseBody,
    provider_message_id: "empty-account-id",
    account_id: "  ",
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "ACCOUNT_ID_REQUIRED");
  assert.equal(db.calls.includes("accounts"), false);
});

test("missing or foreign account UUID returns ACCOUNT_NOT_FOUND", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";

  for (const accountId of [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "ab765f75-1261-4c9a-a11c-bc708e45ea58",
  ]) {
    const db = createSupabase();
    const handler = loadRealHandler(db.client);
    const res = await invoke(handler, {
      ...baseBody,
      provider_message_id: `not-owned-${accountId}`,
      account_id: accountId,
    });

    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, "ACCOUNT_NOT_FOUND");
    assert.equal(db.store.transactions.length, 0);
  }
});

test("context keeps returning the official account UUID", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const req: any = {
    method: "GET",
    query: { action: "context", whatsapp_phone: "5511999999999" },
    headers: { authorization: "Bearer integration-token" },
  };
  const res = response();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.accounts.map((account: Row) => account.id), [
    "6d61847f-12dd-4167-8039-0a5a9fc8a49b",
    "40fe8db6-35a4-4e5d-84aa-f92a2bba7c28",
  ]);
});

test("PostgreSQL 22P02 is never exposed to the client", () => {
  const { sendError } = require("../api/_lib/http");
  const res = response();
  const databaseError: any = new Error("invalid input syntax for type uuid");
  databaseError.code = "22P02";

  sendError(res, databaseError);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error.code, "INTERNAL_ERROR");
  assert.notEqual(res.body.error.code, "22P02");
  assert.equal(res.body.error.message, "Internal server error");
});

const transferValidationBody = {
  whatsapp_phone: "5511999999999",
  from_account_id: "6d61847f-12dd-4167-8039-0a5a9fc8a49b",
  to_account_id: "40fe8db6-35a4-4e5d-84aa-f92a2bba7c28",
};

test("validate_transfer_accounts returns canonical accounts without creating transactions", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invokeAction(handler, "validate_transfer_accounts", transferValidationBody);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.valid, true);
  assert.deepEqual(res.body.from_account, {
    id: transferValidationBody.from_account_id,
    name: "Conta Preview",
    bank: "Banco",
    account_type: "corrente",
    profile_type: "PJ",
  });
  assert.deepEqual(res.body.to_account, {
    id: transferValidationBody.to_account_id,
    name: "Conta Destino Canonica",
    bank: "Banco Destino",
    account_type: "poupanca",
    profile_type: "PJ",
  });
  assert.equal(db.store.transactions.length, 0);
});

test("validate_transfer_accounts rejects malformed, missing, unknown, foreign and same accounts", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const cases = [
    [{ ...transferValidationBody, from_account_id: undefined }, 400, "FROM_ACCOUNT_ID_REQUIRED"],
    [{ ...transferValidationBody, to_account_id: undefined }, 400, "TO_ACCOUNT_ID_REQUIRED"],
    [{ ...transferValidationBody, from_account_id: "account_nu" }, 400, "ACCOUNT_ID_INVALID"],
    [{ ...transferValidationBody, to_account_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, 404, "ACCOUNT_NOT_FOUND"],
    [{ ...transferValidationBody, to_account_id: "ab765f75-1261-4c9a-a11c-bc708e45ea58" }, 404, "ACCOUNT_NOT_FOUND"],
    [{ ...transferValidationBody, to_account_id: transferValidationBody.from_account_id }, 400, "TRANSFER_ACCOUNTS_SAME"],
  ] as const;

  for (const [body, statusCode, code] of cases) {
    const db = createSupabase();
    const handler = loadRealHandler(db.client);
    const res = await invokeAction(handler, "validate_transfer_accounts", body);
    assert.equal(res.statusCode, statusCode, code);
    assert.equal(res.body.error.code, code);
    assert.equal(db.store.transactions.length, 0);
  }
});

test("create_transfer revalidates accounts before writing and returns canonical names", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invokeAction(handler, "create_transfer", {
    ...transferValidationBody,
    provider_message_id: "transfer-revalidation-001",
    confirmed: true,
    create_new_confirmed: true,
    description: "Transferencia de teste",
    amount: 10,
    date: "2026-08-06",
    paid: true,
    deadline_mode: "single",
  });

  assert.equal(res.statusCode, 201);
  assert.equal(db.calls.filter((table) => table === "accounts").length, 4);
  assert.equal(db.store.transactions.length, 2);
  assert.equal(res.body.from_account.id, transferValidationBody.from_account_id);
  assert.equal(res.body.from_account.name, "Conta Preview");
  assert.equal(res.body.to_account.id, transferValidationBody.to_account_id);
  assert.equal(res.body.to_account.name, "Conta Destino Canonica");
});

test("create_transfer aborts if an account is no longer valid before persistence", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase({ removeDestinationBeforeSecondValidation: true });
  const handler = loadRealHandler(db.client);
  const res = await invokeAction(handler, "create_transfer", {
    ...transferValidationBody,
    provider_message_id: "transfer-revalidation-removed-account",
    confirmed: true,
    create_new_confirmed: true,
    description: "Transferencia bloqueada",
    amount: 10,
    date: "2026-08-06",
    paid: true,
    deadline_mode: "single",
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "ACCOUNT_NOT_FOUND");
  assert.equal(db.calls.filter((table) => table === "accounts").length, 4);
  assert.equal(db.store.transactions.length, 0);
});
