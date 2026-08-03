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

function createSupabase() {
  const store: Record<string, Row[]> = {
    user_access: [{ user_id: "user-1", whatsapp_number: "5511999999999" }],
    accounts: [{
      id: "6d61847f-12dd-4167-8039-0a5a9fc8a49b",
      user_id: "user-1",
      name: "Conta Preview",
      banco: "Banco",
      perfil_conta: "pj",
    }],
    user_categories: [
      { id: "delivery-real-id", user_id: "user-1", profile_id: "pf", tipo: "despesa", nome: "Delivery" },
    ],
    transactions: [],
  };
  return {
    store,
    client: { from: (table: string) => new Query(table, store) },
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

test("handler real aceita categoria nativa do contexto e persiste o nome canônico", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  process.env.VERCEL_ENV = "preview";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: any[]) => logs.push(args.map(String).join(" "));
  let res: any;
  try {
    res = await invoke(handler, baseBody);
  } finally {
    console.log = originalLog;
    delete process.env.VERCEL_ENV;
  }
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.equal(db.store.transactions.length, 1);
  assert.equal(db.store.transactions[0].categoria, "Alimentação");
  assert.notEqual(db.store.transactions[0].categoria, "native:despesa:alimentacao");
  assert.equal(db.store.user_categories.some((row) => row.nome === "Alimentação"), false);
  for (const stage of [
    "create_transaction:before-category-validation",
    "validateCategoryIfProvided:entry",
    "resolveAvailableCategories:entry",
    "resolveAvailableCategories:native-loaded",
    "resolveCategoryByName:result",
  ]) {
    assert.ok(logs.some((line) => line.includes(`\"stage\":\"${stage}\"`)), stage);
  }
  const joinedLogs = logs.join("\n");
  assert.doesNotMatch(joinedLogs, /5511999999999|integration-token|6d61847f/);
  assert.match(joinedLogs, /\"matchedCategory\":\{\"id\":\"native:despesa:alimentacao\"/);
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
