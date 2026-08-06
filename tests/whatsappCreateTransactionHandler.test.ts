import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

function createSupabase(options: {
  removeDestinationBeforeSecondValidation?: boolean;
  removeAccountBeforeSecondValidation?: boolean;
  removeCreditCardBeforeSecondValidation?: boolean;
} = {}) {
  const calls: string[] = [];
  let accountQueryCount = 0;
  let creditCardQueryCount = 0;
  const store: Record<string, Row[]> = {
    user_access: [{ user_id: "user-1", whatsapp_number: "5511999999999" }],
    accounts: [{
      id: "6d61847f-12dd-4167-8039-0a5a9fc8a49b",
      user_id: "user-1",
      name: "Mercado Pago",
      banco: "Mercado Pago",
      perfil_conta: "pj",
      tipo_conta: "corrente",
    }, {
      id: "c95693a1-4394-4c89-9391-fcc4c66caffd",
      user_id: "user-1",
      name: "Nu Teste",
      banco: "Nubank",
      perfil_conta: "pj",
      tipo_conta: "poupanca",
    }, {
      id: "ab765f75-1261-4c9a-a11c-bc708e45ea58",
      user_id: "user-2",
      name: "Other account",
      banco: "Bank",
      perfil_conta: "pf",
    }],
    credit_cards: [{
      id: "11111111-1111-4111-8111-111111111111",
      user_id: "user-1",
      nome: "Cartao Canonico",
      bank_text: "Emissor Teste",
      categoria: "PF",
      perfil_conta: "pf",
      dia_fechamento: 28,
      dia_vencimento: 7,
      is_active: true,
    }, {
      id: "22222222-2222-4222-8222-222222222222",
      user_id: "user-1",
      nome: "Cartao Inativo",
      is_active: false,
    }, {
      id: "33333333-3333-4333-8333-333333333333",
      user_id: "user-2",
      nome: "Cartao Alheio",
      is_active: true,
    }],
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
        if (options.removeAccountBeforeSecondValidation && accountQueryCount === 2) {
          store.accounts = store.accounts.filter(
            (account) => account.id !== "6d61847f-12dd-4167-8039-0a5a9fc8a49b"
          );
        }
        if (options.removeDestinationBeforeSecondValidation && accountQueryCount === 3) {
          store.accounts = store.accounts.filter(
            (account) => account.id !== "c95693a1-4394-4c89-9391-fcc4c66caffd"
          );
        }
      }
      if (table === "credit_cards") {
        creditCardQueryCount += 1;
        if (options.removeCreditCardBeforeSecondValidation && creditCardQueryCount === 2) {
          store.credit_cards = store.credit_cards.filter(
            (card) => card.id !== "11111111-1111-4111-8111-111111111111"
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
  if (!action.startsWith("validate_")) {
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
    "c95693a1-4394-4c89-9391-fcc4c66caffd",
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
  to_account_id: "c95693a1-4394-4c89-9391-fcc4c66caffd",
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
    name: "Mercado Pago",
    bank: "Mercado Pago",
    account_type: "corrente",
    profile_type: "PJ",
  });
  assert.deepEqual(res.body.to_account, {
    id: transferValidationBody.to_account_id,
    name: "Nu Teste",
    bank: "Nubank",
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
    [{ ...transferValidationBody, from_account_name: "Nu Teste" }, 400, "TRANSFER_ACCOUNT_ID_NAME_MISMATCH"],
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
  assert.equal(res.body.from_account.name, "Mercado Pago");
  assert.equal(res.body.to_account.id, transferValidationBody.to_account_id);
  assert.equal(res.body.to_account.name, "Nu Teste");
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

test("regression: Mercado Pago name cannot be combined with Nu Teste UUID", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invoke(handler, {
    ...baseBody,
    provider_message_id: "mercado-pago-nu-mismatch",
    account_id: "c95693a1-4394-4c89-9391-fcc4c66caffd",
    account_name: "Mercado Pago",
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "ACCOUNT_ID_NAME_MISMATCH");
  assert.equal(db.store.transactions.length, 0);
});

test("Mercado Pago UUID without supplied name resolves, persists and returns Mercado Pago", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invoke(handler, {
    ...baseBody,
    provider_message_id: "mercado-pago-canonical",
    account_id: "6d61847f-12dd-4167-8039-0a5a9fc8a49b",
  });

  assert.equal(res.statusCode, 201);
  assert.equal(db.store.transactions[0].conta_id, "6d61847f-12dd-4167-8039-0a5a9fc8a49b");
  assert.equal(res.body.account.id, "6d61847f-12dd-4167-8039-0a5a9fc8a49b");
  assert.equal(res.body.account.name, "Mercado Pago");
});

test("bank transaction aborts if canonical account disappears before insert", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase({ removeAccountBeforeSecondValidation: true });
  const handler = loadRealHandler(db.client);
  const res = await invoke(handler, {
    ...baseBody,
    provider_message_id: "removed-account-before-insert",
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "ACCOUNT_NOT_FOUND");
  assert.equal(db.store.transactions.length, 0);
});

test("validate_transaction_target validates canonical account without persistence", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invokeAction(handler, "validate_transaction_target", {
    whatsapp_phone: "5511999999999",
    target_type: "account",
    account_id: "6d61847f-12dd-4167-8039-0a5a9fc8a49b",
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.account.name, "Mercado Pago");
  assert.equal(db.store.transactions.length, 0);
});

const creditCardId = "11111111-1111-4111-8111-111111111111";

test("validate_transaction_target covers credit card validation and canonical response", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const cases = [
    [{ target_type: "credit_card" }, 400, "CREDIT_CARD_ID_REQUIRED"],
    [{ target_type: "credit_card", credit_card_id: "card_alias" }, 400, "CREDIT_CARD_ID_INVALID"],
    [{ target_type: "credit_card", credit_card_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, 404, "CREDIT_CARD_NOT_FOUND"],
    [{ target_type: "credit_card", credit_card_id: "33333333-3333-4333-8333-333333333333" }, 404, "CREDIT_CARD_NOT_FOUND"],
    [{ target_type: "credit_card", credit_card_id: "22222222-2222-4222-8222-222222222222" }, 400, "CREDIT_CARD_INACTIVE"],
    [{ target_type: "credit_card", credit_card_id: creditCardId, credit_card_name: "Outro Cartao" }, 400, "CREDIT_CARD_ID_NAME_MISMATCH"],
  ];

  for (const [partialBody, statusCode, code] of cases) {
    const db = createSupabase();
    const handler = loadRealHandler(db.client);
    const res = await invokeAction(handler, "validate_transaction_target", {
      whatsapp_phone: "5511999999999",
      ...(partialBody as Row),
    });
    assert.equal(res.statusCode, statusCode, String(code));
    assert.equal(res.body.error.code, code);
    assert.equal(db.store.transactions.length, 0);
  }

  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const valid = await invokeAction(handler, "validate_transaction_target", {
    whatsapp_phone: "5511999999999",
    target_type: "credit_card",
    credit_card_id: creditCardId,
  });
  assert.equal(valid.statusCode, 200);
  assert.equal(valid.body.credit_card.name, "Cartao Canonico");
  assert.equal(valid.body.credit_card.issuer, "Emissor Teste");
  assert.equal(db.store.transactions.length, 0);
});

test("credit card purchase revalidates and returns the canonical card", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invokeAction(handler, "create_credit_card_purchase", {
    whatsapp_phone: "5511999999999",
    provider_message_id: "canonical-card-purchase",
    confirmed: true,
    description: "Compra teste",
    amount: 25,
    date: "2026-08-06",
    credit_card_id: creditCardId,
    category: "Alimentacao",
    spending_type: "variavel",
  });

  assert.equal(res.statusCode, 201);
  assert.equal(db.calls.filter((table) => table === "credit_cards").length, 2);
  assert.equal(db.store.transactions[0].cartao_id, creditCardId);
  assert.equal(res.body.credit_card.id, creditCardId);
  assert.equal(res.body.credit_card.name, "Cartao Canonico");
});

test("credit card purchase aborts when card disappears before persistence", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase({ removeCreditCardBeforeSecondValidation: true });
  const handler = loadRealHandler(db.client);
  const res = await invokeAction(handler, "create_credit_card_purchase", {
    whatsapp_phone: "5511999999999",
    provider_message_id: "removed-card-purchase",
    confirmed: true,
    description: "Compra bloqueada",
    amount: 25,
    date: "2026-08-06",
    credit_card_id: creditCardId,
    spending_type: "variavel",
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error.code, "CREDIT_CARD_NOT_FOUND");
  assert.equal(db.store.transactions.length, 0);
});

test("credit card purchase never persists when supplied name belongs to another card", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invokeAction(handler, "create_credit_card_purchase", {
    whatsapp_phone: "5511999999999",
    provider_message_id: "card-name-mismatch",
    confirmed: true,
    description: "Compra divergente",
    amount: 25,
    date: "2026-08-06",
    credit_card_id: creditCardId,
    credit_card_name: "Outro Cartao",
    spending_type: "variavel",
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "CREDIT_CARD_ID_NAME_MISMATCH");
  assert.equal(db.store.transactions.length, 0);
});

test("bank installments and fixed occurrences keep the revalidated canonical account", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const cases = [
    ["create_installments", { installments: 3 }],
    ["create_fixed", { deadline_mode: "com_prazo", end_date: "2026-10-06" }],
  ] as const;

  for (const [action, extra] of cases) {
    const db = createSupabase();
    const handler = loadRealHandler(db.client);
    const res = await invokeAction(handler, action, {
      ...baseBody,
      provider_message_id: `canonical-${action}`,
      account_name: "Mercado Pago",
      ...extra,
    });
    assert.equal(res.statusCode, 201, action);
    assert.equal(db.calls.filter((table) => table === "accounts").length, 2, action);
    assert.equal(res.body.account.name, "Mercado Pago", action);
    assert.ok(db.store.transactions.length > 1, action);
    assert.ok(db.store.transactions.every((row) => row.conta_id === baseBody.account_id), action);
  }
});

test("credit card installments keep one canonical card UUID in every installment", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const res = await invokeAction(handler, "create_credit_card_installments", {
    whatsapp_phone: "5511999999999",
    provider_message_id: "canonical-card-installments",
    confirmed: true,
    description: "Compra parcelada",
    amount: 90,
    date: "2026-08-06",
    installments: 3,
    credit_card_id: creditCardId,
    credit_card_name: "Cartao Canonico",
  });

  assert.equal(res.statusCode, 201);
  assert.equal(db.calls.filter((table) => table === "credit_cards").length, 2);
  assert.equal(res.body.credit_card.name, "Cartao Canonico");
  assert.equal(db.store.transactions.length, 3);
  assert.ok(db.store.transactions.every((row) => row.cartao_id === creditCardId));
});

test("validate_invoice_payment_targets returns canonical card, invoice ref and account", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const db = createSupabase();
  const handler = loadRealHandler(db.client);
  const cicloKey = `${creditCardId}__2026-07-29__2026-08-28`;
  const res = await invokeAction(handler, "validate_invoice_payment_targets", {
    whatsapp_phone: "5511999999999",
    credit_card_id: creditCardId,
    ciclo_key: cicloKey,
    account_id: baseBody.account_id,
    credit_card_name: "Cartao Canonico",
    payment_account_name: "Mercado Pago",
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.credit_card.name, "Cartao Canonico");
  assert.equal(res.body.payment_account.name, "Mercado Pago");
  assert.equal(res.body.invoice_ref.ciclo_key, cicloKey);
  assert.equal(db.store.transactions.length, 0);
});

test("invoice target validation rejects foreign entities and divergent names", async () => {
  process.env.SUPPLIER_API_TOKEN = "integration-token";
  const cicloKey = `${creditCardId}__2026-07-29__2026-08-28`;
  const cases = [
    [{ credit_card_id: "33333333-3333-4333-8333-333333333333" }, 404, "CREDIT_CARD_NOT_FOUND"],
    [{ account_id: "ab765f75-1261-4c9a-a11c-bc708e45ea58" }, 404, "ACCOUNT_NOT_FOUND"],
    [{ credit_card_name: "Cartao Errado" }, 400, "CREDIT_CARD_ID_NAME_MISMATCH"],
    [{ payment_account_name: "Nu Teste" }, 400, "ACCOUNT_ID_NAME_MISMATCH"],
  ] as const;

  for (const [override, statusCode, code] of cases) {
    const db = createSupabase();
    const handler = loadRealHandler(db.client);
    const res = await invokeAction(handler, "validate_invoice_payment_targets", {
      whatsapp_phone: "5511999999999",
      credit_card_id: creditCardId,
      ciclo_key: cicloKey,
      account_id: baseBody.account_id,
      ...override,
    });
    assert.equal(res.statusCode, statusCode, code);
    assert.equal(res.body.error.code, code);
    assert.equal(db.store.transactions.length, 0);
  }
});

test("pay_credit_card_invoice source revalidates both targets and returns canonical objects", () => {
  const source = readFileSync("api/v1/whatsapp.js", "utf8");
  const start = source.indexOf("async function handlePayCreditCardInvoice");
  const end = source.indexOf("module.exports =", start);
  const handlerSource = source.slice(start, end);

  assert.equal(
    (handlerSource.match(/requireValidInvoicePaymentTargets\(/g) || []).length,
    2
  );
  assert.match(handlerSource, /credit_card:\s*mapCanonicalCreditCard\(card\)/);
  assert.match(handlerSource, /payment_account:\s*mapCanonicalAccount\(account\)/);
  assert.ok(handlerSource.lastIndexOf("requireValidInvoicePaymentTargets(") < handlerSource.indexOf('.from("transactions")'));
});
