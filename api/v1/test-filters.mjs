import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import vm from "node:vm";

class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function parseIsoDate(value, code = "INVALID_DATE", fieldName = "date") {
  const date = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, code, `${fieldName} must be a valid YYYY-MM-DD date.`);
  }
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ApiError(400, code, `${fieldName} must be a valid YYYY-MM-DD date.`);
  }
  return date;
}

class Query {
  constructor(rows) {
    this.rows = rows.map((row) => ({ ...row }));
  }

  select() {
    return this;
  }

  eq(field, value) {
    this.rows = this.rows.filter((row) => String(row?.[field]) === String(value));
    return this;
  }

  in(field, values) {
    const allowed = new Set(values.map(String));
    this.rows = this.rows.filter((row) => allowed.has(String(row?.[field])));
    return this;
  }

  order(field, { ascending = true } = {}) {
    this.rows.sort((left, right) => {
      const result = String(left?.[field] ?? "").localeCompare(
        String(right?.[field] ?? "")
      );
      return ascending ? result : -result;
    });
    return this;
  }

  range(from, to) {
    return Promise.resolve({
      data: this.rows.slice(from, to + 1),
      error: null,
    });
  }

  then(resolve, reject) {
    return Promise.resolve({ data: this.rows, error: null }).then(resolve, reject);
  }
}

function makeSupabase(fixtures) {
  return {
    from(table) {
      return new Query(fixtures[table] || []);
    },
  };
}

function requireString(value, code, message) {
  const clean = String(value ?? "").trim();
  if (!clean) throw new ApiError(400, code, message);
  return clean;
}

const transactionsCommonStub = {
  addMonthsLikeUi: (date) => date,
  buildFixedSummary: () => "",
  buildInstallmentsSummary: () => "",
  buildSemPrazoMeta: () => ({}),
  buildTransactionSummary: () => "",
  countMonthsInclusive: () => 1,
  getAccountProfileId: (account) =>
    String(account?.perfil_conta ?? "").toLowerCase() === "pj" ? "pj" : "pf",
  isFutureDate: () => false,
  mapTransactionResponse: (row) => row,
  MAX_FIXED_MONTHS: 120,
  normalizeDeadlineMode: (value) => value,
  normalizePaymentMethod: (value) => value,
  normalizeSpendingType: (value) => value,
  normalizeTransactionType: (value) => value,
  parseBoolean: (value) => Boolean(value),
  parseInstallments: (value) => Number(value),
  parseIsoDate,
  parsePositiveAmount: (value) => Math.abs(Number(value)),
  requireOwnedAccount: async () => ({}),
  SEM_PRAZO_MONTHS: 12,
  requireOwnedCommonTransaction: async () => ({}),
  validateCategoryIfProvided: async ({ category }) => category || "",
};

const code = fs.readFileSync(new URL("./whatsapp.js", import.meta.url), "utf8");
const module = { exports: {} };
const context = {
  Buffer,
  console,
  crypto,
  Date,
  Intl,
  Math,
  module,
  exports: module.exports,
  process: { env: {} },
  require(id) {
    if (id === "crypto") return crypto;
    if (id === "../_lib/http") {
      return {
        ApiError,
        json(res, statusCode, body) {
          res.statusCode = statusCode;
          res.body = body;
        },
        parseJson: async (req) => req.body || {},
        requireMethod(req, method) {
          if (req.method !== method) {
            throw new ApiError(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
          }
        },
        requireString,
        withApi: (handler) => handler,
      };
    }
    if (id === "../_lib/whatsappAuth") {
      return {
        rejectUserIdFromSupplier() {},
        validateSupplierAuth() {},
      };
    }
    if (id === "../_lib/whatsappUser") {
      return {
        resolveWhatsappUser: async (_supabase, phone) => ({
          user_id: "user-1",
          whatsapp_phone_normalized: phone,
        }),
      };
    }
    if (id === "../_lib/catalogNames") {
      return { normalizeCatalogName: (value) => String(value ?? "").trim().toLowerCase() };
    }
    if (id === "../_lib/idempotency") {
      return {
        requireIdempotencyKey: () => "test",
        runIdempotentCommand: async ({ execute }) => ({
          ...(await execute()),
          replayed: false,
        }),
      };
    }
    if (id === "../_lib/supabaseAdmin") {
      return { getSupabaseAdmin: () => null };
    }
    if (id === "../_lib/transactionsCommon") return transactionsCommonStub;
    if (id === "../_lib/transactionResolver") {
      return { resolvePendingTransaction: () => ({ status: "not_found" }) };
    }
    throw new Error(`Unexpected require: ${id}`);
  },
};

vm.createContext(context);
vm.runInContext(code, context, { filename: "whatsapp.js" });

const {
  handleListTransactions,
  handleFinancialProjection,
  handleFinancialAnalytics,
  normalizeProjectionCardProfile,
  normalizeAnalyticsSource,
} = context;

const fixtures = {
  accounts: [
    {
      id: "account-pf",
      user_id: "user-1",
      name: "Nubank PF",
      banco: "Nubank",
      perfil_conta: "PF",
      created_at: "2026-01-01",
    },
    {
      id: "account-pj",
      user_id: "user-1",
      name: "Itau PJ",
      banco: "Itau",
      perfil_conta: "PJ",
      created_at: "2026-01-02",
    },
  ],
  credit_cards: [
    {
      id: "card-pf",
      user_id: "user-1",
      nome: "Cartao PF",
      categoria: "PF",
      brand: "Visa",
      dia_fechamento: 28,
      dia_vencimento: 10,
      is_active: true,
      created_at: "2026-01-01",
    },
    {
      id: "card-pj",
      user_id: "user-1",
      nome: "Cartao PJ",
      categoria: "PJ",
      brand: "Mastercard",
      dia_fechamento: 28,
      dia_vencimento: 10,
      is_active: true,
      created_at: "2026-01-02",
    },
  ],
  transactions: [
    {
      id: "expense-pf",
      user_id: "user-1",
      tipo: "despesa",
      valor: -100,
      data: "2026-07-05",
      descricao: "Mercado PF",
      categoria: "Alimentacao",
      tag: "",
      pago: false,
      conta_id: "account-pf",
      criado_em: 1,
      payload: { tipoGasto: "Variável" },
    },
    {
      id: "expense-pj",
      user_id: "user-1",
      tipo: "despesa",
      valor: -200,
      data: "2026-07-06",
      descricao: "Servidor PJ",
      categoria: "Infraestrutura",
      tag: "",
      pago: true,
      conta_id: "account-pj",
      criado_em: 2,
      payload: { tipoGasto: "Fixo" },
    },
    {
      id: "income-pf",
      user_id: "user-1",
      tipo: "receita",
      valor: 1200,
      data: "2026-07-07",
      descricao: "Receita PF",
      categoria: "Servicos",
      tag: "",
      pago: true,
      conta_id: "account-pf",
      criado_em: 3,
      payload: {},
    },
    {
      id: "card-expense-pf",
      user_id: "user-1",
      tipo: "cartao_credito",
      valor: -59.9,
      data: "2026-06-29",
      descricao: "CapCut PF",
      categoria: "Assinaturas",
      tag: "Trabalho",
      pago: false,
      cartao_id: "card-pf",
      criado_em: 4,
      payload: { tipoGasto: "Variável", faturaMes: "2026-07" },
    },
    {
      id: "card-expense-pj",
      user_id: "user-1",
      tipo: "cartao_credito",
      valor: -350,
      data: "2026-06-29",
      descricao: "Anuncio PJ",
      categoria: "Marketing",
      tag: "Empresa",
      pago: false,
      cartao_id: "card-pj",
      criado_em: 5,
      payload: { tipoGasto: "Variável", faturaMes: "2026-07" },
    },
  ],
};

const supabase = makeSupabase(fixtures);

async function callList(query) {
  const req = {
    method: "GET",
    query: {
      whatsapp_phone: "5541999999999",
      ...query,
    },
  };
  const res = {};
  await handleListTransactions(req, res, supabase);
  assert.equal(res.statusCode, 200);
  return res.body;
}

async function callProjection(query) {
  const req = {
    method: "GET",
    query: {
      whatsapp_phone: "5541999999999",
      ...query,
    },
  };
  const res = {};
  await handleFinancialProjection(req, res, supabase);
  assert.equal(res.statusCode, 200);
  return res.body;
}

async function callAnalytics(query) {
  const req = {
    method: "GET",
    query: {
      whatsapp_phone: "5541999999999",
      ...query,
    },
  };
  const res = {};
  await handleFinancialAnalytics(req, res, supabase);
  assert.equal(res.statusCode, 200);
  return res.body;
}

assert.equal(normalizeProjectionCardProfile(fixtures.credit_cards[0]), "PF");
assert.equal(normalizeProjectionCardProfile(fixtures.credit_cards[1]), "PJ");
assert.equal(normalizeAnalyticsSource("cartões"), "credit_cards");
assert.equal(normalizeAnalyticsSource("contas"), "general");

const pfCards = await callList({
  profile: "PF",
  source: "credit_cards",
  period: "2026-07",
  type: "despesa",
});
assert.equal(
  JSON.stringify(pfCards.transactions.map((row) => row.id)),
  JSON.stringify(["card-expense-pf"])
);
assert.equal(pfCards.scope.profile, "PF");
assert.equal(pfCards.scope.source, "credit_cards");
assert.equal(pfCards.totals.expenses, 59.9);

const pjCards = await callList({
  perfil: "PJ",
  fonte: "cartoes",
  periodo: "2026-07",
});
assert.equal(
  JSON.stringify(pjCards.transactions.map((row) => row.id)),
  JSON.stringify(["card-expense-pj"])
);

const accountExpenses = await callList({
  profile: "all",
  source: "accounts",
  period: "2026-07",
  type: "despesa",
});
assert.equal(
  JSON.stringify(
    Array.from(accountExpenses.transactions.map((row) => row.id)).sort()
  ),
  JSON.stringify(["expense-pf", "expense-pj"])
);
assert.equal(
  accountExpenses.transactions.some((row) => row.source === "credit_cards"),
  false
);

const filteredTag = await callList({
  profile: "all",
  source: "credit_cards",
  period: "2026-07",
  tag: "Trabalho",
});
assert.equal(
  JSON.stringify(filteredTag.transactions.map((row) => row.id)),
  JSON.stringify(["card-expense-pf"])
);

const pfProjection = await callProjection({
  profile: "PF",
  months: "3",
  start_period: "2026-07",
});
assert.equal(pfProjection.scope.profile, "PF");
assert.equal(pfProjection.scope.months, 3);
assert.equal(pfProjection.projection.length, 3);
assert.equal(pfProjection.projection[0].period, "2026-07");
assert.equal(pfProjection.projection[0].income, 1200);
assert.equal(pfProjection.projection[0].variable_and_card_expenses, 159.9);
assert.equal(
  pfProjection.scope.credit_card_ids.includes("card-pj"),
  false
);

const pfCardAnalytics = await callAnalytics({
  profile: "PF",
  source: "credit_cards",
  period: "2026-08",
});
assert.equal(pfCardAnalytics.scope.profile, "PF");
assert.equal(pfCardAnalytics.scope.source, "credit_cards");
assert.equal(pfCardAnalytics.summary.general_expenses_total, 0);
assert.equal(pfCardAnalytics.summary.credit_card_expenses_total, 59.9);
assert.equal(pfCardAnalytics.credit_card_expense_by_category[0].category, "Assinaturas");

const pfGeneralAnalytics = await callAnalytics({
  profile: "PF",
  source: "accounts",
  period: "2026-07",
});
assert.equal(pfGeneralAnalytics.scope.source, "general");
assert.equal(pfGeneralAnalytics.summary.general_expenses_total, 100);
assert.equal(pfGeneralAnalytics.summary.credit_card_expenses_total, 0);

await assert.rejects(
  () =>
    callList({
      source: "credit_cards",
      period: "2026-07",
    }),
  (error) => error instanceof ApiError && error.code === "FILTER_REQUIRED"
);

await assert.rejects(
  () =>
    callList({
      profile: "PF",
      source: "credit_cards",
      period: "2026-07",
      account_id: "account-pf",
    }),
  (error) => error instanceof ApiError && error.code === "FILTER_CONFLICT"
);

await assert.rejects(
  () =>
    handleFinancialProjection(
      {
        method: "GET",
        query: { whatsapp_phone: "5541999999999", profile: "PF" },
      },
      {},
      supabase
    ),
  (error) => error instanceof ApiError && error.code === "FILTER_REQUIRED"
);

await assert.rejects(
  () =>
    handleFinancialAnalytics(
      {
        method: "GET",
        query: { whatsapp_phone: "5541999999999", profile: "PF" },
      },
      {},
      supabase
    ),
  (error) => error instanceof ApiError && error.code === "FILTER_REQUIRED"
);

console.log("Filter integration tests passed.");
