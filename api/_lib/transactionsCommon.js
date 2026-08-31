const { ApiError } = require("./http");

const COMMON_TYPES = new Set(["receita", "despesa"]);
const SEM_PRAZO_MONTHS = 12;
const MAX_INSTALLMENTS = 120;
const MAX_FIXED_MONTHS = 120;
const PAYMENT_METHODS = new Set([
  "pix",
  "boleto",
  "dinheiro",
  "debito",
  "credito",
  "transferencia_bancaria",
  "debito_conta",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeEntityName(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function assertCanonicalName(providedName, canonicalName, code, fieldName) {
  if (providedName === undefined || providedName === null) return;
  const cleanProvidedName = String(providedName).trim();
  if (!cleanProvidedName) return;

  if (normalizeEntityName(cleanProvidedName) !== normalizeEntityName(canonicalName)) {
    throw new ApiError(
      400,
      code,
      `${fieldName} does not match the canonical entity resolved from its UUID.`
    );
  }
}

function validateAccountId(accountId, options = {}) {
  const cleanAccountId = String(accountId ?? "").trim();
  const fieldName = String(options.fieldName || "account_id");

  if (!cleanAccountId) {
    throw new ApiError(
      400,
      options.requiredCode || "ACCOUNT_ID_REQUIRED",
      options.requiredMessage || `${fieldName} is required.`
    );
  }

  if (!UUID_PATTERN.test(cleanAccountId)) {
    throw new ApiError(
      400,
      "ACCOUNT_ID_INVALID",
      `${fieldName} must be a valid account UUID returned by context.`
    );
  }

  return cleanAccountId;
}

function validateCreditCardId(creditCardId) {
  const cleanCreditCardId = String(creditCardId ?? "").trim();
  if (!cleanCreditCardId) {
    throw new ApiError(
      400,
      "CREDIT_CARD_ID_REQUIRED",
      "credit_card_id is required."
    );
  }
  if (!UUID_PATTERN.test(cleanCreditCardId)) {
    throw new ApiError(
      400,
      "CREDIT_CARD_ID_INVALID",
      "credit_card_id must be a valid credit card UUID returned by context."
    );
  }
  return cleanCreditCardId;
}

function normalizeTransactionType(value) {
  const type = String(value ?? "").trim().toLowerCase();

  if (!COMMON_TYPES.has(type)) {
    throw new ApiError(
      400,
      "INVALID_TRANSACTION_TYPE",
      "type must be receita or despesa."
    );
  }

  return type;
}

function parsePositiveAmount(value) {
  const raw = typeof value === "string" ? value.trim() : value;
  const amount = Number(raw);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "INVALID_AMOUNT", "amount must be greater than zero.");
  }

  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-8) {
    throw new ApiError(
      400,
      "INVALID_AMOUNT_PRECISION",
      "amount must have at most two decimal places."
    );
  }

  return cents / 100;
}

function toMoneyCents(value) {
  return Math.round(parsePositiveAmount(value) * 100);
}

function fromMoneyCents(cents) {
  return Number(cents) / 100;
}

function splitMoneyInCents(totalValue, parts) {
  const count = parseInstallments(parts);
  const totalCents = toMoneyCents(totalValue);
  const baseCents = Math.floor(totalCents / count);
  const remainder = totalCents - baseCents * count;
  return Array.from({ length: count }, (_, index) =>
    fromMoneyCents(baseCents + (index === count - 1 ? remainder : 0))
  );
}

function parseInstallments(value) {
  const installments = Number(value);

  if (!Number.isInteger(installments) || installments <= 1) {
    throw new ApiError(
      400,
      "INVALID_INSTALLMENTS",
      "installments must be an integer greater than 1."
    );
  }

  if (installments > MAX_INSTALLMENTS) {
    throw new ApiError(
      400,
      "INVALID_INSTALLMENTS",
      `installments must be ${MAX_INSTALLMENTS} or less.`
    );
  }

  return installments;
}

function normalizeDeadlineMode(value) {
  const mode = String(value ?? "").trim().toLowerCase();

  if (mode !== "sem_prazo" && mode !== "com_prazo") {
    throw new ApiError(
      400,
      "INVALID_DEADLINE_MODE",
      "deadline_mode must be sem_prazo or com_prazo."
    );
  }

  return mode;
}

function parseBoolean(value, fieldName) {
  if (typeof value !== "boolean") {
    throw new ApiError(
      400,
      "INVALID_BOOLEAN",
      `${fieldName} must be boolean.`
    );
  }

  return value;
}

function parseIsoDate(value, code = "INVALID_DATE", fieldName = "date") {
  const date = String(value ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, code, `${fieldName} must be a valid YYYY-MM-DD date.`);
  }

  const parsed = new Date(`${date}T12:00:00Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new ApiError(400, code, `${fieldName} must be a valid YYYY-MM-DD date.`);
  }

  return date;
}

function isFutureDate(date) {
  const today = new Date().toISOString().slice(0, 10);
  return String(date) > today;
}

function addMonthsLikeUi(isoDate, monthsToAdd) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  const targetMonthStart = new Date(year, month - 1 + monthsToAdd, 1, 12, 0, 0, 0);
  const targetYear = targetMonthStart.getFullYear();
  const targetMonth = targetMonthStart.getMonth();
  const lastDay = new Date(targetYear, targetMonth + 1, 0, 12, 0, 0, 0).getDate();
  const date = new Date(targetYear, targetMonth, Math.min(day, lastDay), 12, 0, 0, 0);

  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
}

function countMonthsInclusive(startIso, endIso) {
  const [startYear, startMonth] = String(startIso).split("-").map(Number);
  const [endYear, endMonth] = String(endIso).split("-").map(Number);
  const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  return Math.max(1, months);
}

function buildSemPrazoMeta(originDate, months = SEM_PRAZO_MONTHS) {
  return {
    recurrenceKind: "sem_prazo",
    recurrenceWindowMonths: months,
    recurrenceOriginDate: originDate,
    recurrenceWindowStart: originDate,
    recurrenceWindowEnd: addMonthsLikeUi(originDate, months - 1),
    recurrenceStatus: "ativa",
    recurrenceRenewalDecision: "pendente",
    recurrenceDismissedAt: "",
    recurrenceCanceledAt: "",
    recurrenceLastActionAt: "",
  };
}

function normalizePaymentMethod(value) {
  const method = String(value ?? "").trim().toLowerCase();
  if (!method) return "";

  if (!PAYMENT_METHODS.has(method)) {
    throw new ApiError(
      400,
      "INVALID_PAYMENT_METHOD",
      "payment_method is invalid."
    );
  }

  return method;
}

function normalizeSpendingType(value, type) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!raw) {
    return type === "despesa" ? "variável" : "";
  }

  if (raw === "parcelado") {
    throw new ApiError(
      400,
      "SPENDING_TYPE_NOT_SUPPORTED",
      "parcelado is not supported in this endpoint."
    );
  }

  if (raw === "variavel" || raw === "normal" || raw === "comum") {
    return "variável";
  }

  if (raw === "fixo") {
    return "fixo";
  }

  throw new ApiError(
    400,
    "INVALID_SPENDING_TYPE",
    "spending_type must be variavel, variável, fixo, or omitted."
  );
}

function buildInstallmentPlanningFields(type, current, total, recurrenceId) {
  return {
    tipoGasto: type === "despesa" ? "fixo" : "",
    recorrenciaId: String(recurrenceId ?? "").trim(),
    isRecorrente: false,
    parcelaAtual: Number(current),
    totalParcelas: Number(total),
  };
}

function getAccountProfileId(account) {
  return String(account?.perfil_conta ?? "")
    .trim()
    .toLowerCase() === "pj"
    ? "pj"
    : "pf";
}

async function requireOwnedAccount(supabase, userId, accountId, options = {}) {
  const cleanAccountId = validateAccountId(accountId);

  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, banco, tipo_conta, perfil_conta")
    .eq("id", cleanAccountId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data?.id) {
    throw new ApiError(
      404,
      "ACCOUNT_NOT_FOUND",
      "account_id was not found for this user."
    );
  }

  assertCanonicalName(
    options.providedName,
    data.name || data.banco || "Conta",
    options.mismatchCode || "ACCOUNT_ID_NAME_MISMATCH",
    options.nameField || "account_name"
  );

  return data;
}

async function requireOwnedCreditCard(supabase, userId, creditCardId, options = {}) {
  const cleanCreditCardId = validateCreditCardId(creditCardId);
  const { data, error } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("id", cleanCreditCardId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new ApiError(
      404,
      "CREDIT_CARD_NOT_FOUND",
      "credit_card_id was not found for this user."
    );
  }
  if (data.is_active === false) {
    throw new ApiError(400, "CREDIT_CARD_INACTIVE", "credit_card_id is inactive.");
  }

  assertCanonicalName(
    options.providedName,
    data.nome || data.name || data.bank_text || "Cartão",
    "CREDIT_CARD_ID_NAME_MISMATCH",
    options.nameField || "credit_card_name"
  );
  return data;
}

function mapCanonicalAccount(row) {
  return {
    id: row.id,
    name: row.name || row.banco || "Conta",
    bank: row.banco || "",
    account_type: row.tipo_conta || "",
    profile_type: String(row.perfil_conta || "").trim().toUpperCase(),
  };
}

function mapCanonicalCreditCard(row) {
  const rawProfile = String(
    row.perfil ??
      row.perfil_cartao ??
      row.perfilCartao ??
      row.categoria ??
      row.category ??
      row.brand ??
      ""
  ).trim().toLowerCase();
  return {
    id: row.id,
    name: row.nome || row.name || "",
    issuer: row.bank_text || row.titular || row.banco || "",
    category: row.categoria || row.bandeira || "",
    profile_type: rawProfile === "pj" ? "PJ" : "PF",
    closing_day: Number(row.dia_fechamento ?? row.diaFechamento ?? 1),
    due_day: Number(row.dia_vencimento ?? row.diaVencimento ?? 10),
    is_active: row.is_active !== false,
  };
}

async function requireValidTransferAccounts(
  supabase,
  userId,
  fromAccountId,
  toAccountId,
  options = {}
) {
  const cleanFromAccountId = validateAccountId(fromAccountId, {
    fieldName: "from_account_id",
    requiredCode: "FROM_ACCOUNT_ID_REQUIRED",
    requiredMessage: "from_account_id is required.",
  });
  const cleanToAccountId = validateAccountId(toAccountId, {
    fieldName: "to_account_id",
    requiredCode: "TO_ACCOUNT_ID_REQUIRED",
    requiredMessage: "to_account_id is required.",
  });

  if (cleanFromAccountId === cleanToAccountId) {
    throw new ApiError(
      400,
      "TRANSFER_ACCOUNTS_SAME",
      "from_account_id and to_account_id must be different."
    );
  }

  const [fromAccount, toAccount] = await Promise.all([
    requireOwnedAccount(supabase, userId, cleanFromAccountId, {
      providedName: options.fromAccountName,
      mismatchCode: "TRANSFER_ACCOUNT_ID_NAME_MISMATCH",
      nameField: "from_account_name",
    }),
    requireOwnedAccount(supabase, userId, cleanToAccountId, {
      providedName: options.toAccountName,
      mismatchCode: "TRANSFER_ACCOUNT_ID_NAME_MISMATCH",
      nameField: "to_account_name",
    }),
  ]);

  if (String(fromAccount.id) === String(toAccount.id)) {
    throw new ApiError(
      400,
      "TRANSFER_ACCOUNTS_SAME",
      "from_account_id and to_account_id must be different."
    );
  }

  return { fromAccount, toAccount };
}

async function requireValidInvoicePaymentTargets(
  supabase,
  userId,
  creditCardId,
  accountId,
  options = {}
) {
  const [creditCard, paymentAccount] = await Promise.all([
    requireOwnedCreditCard(supabase, userId, creditCardId, {
      providedName: options.creditCardName,
    }),
    requireOwnedAccount(supabase, userId, accountId, {
      providedName: options.paymentAccountName,
      nameField: "payment_account_name",
    }),
  ]);
  return { creditCard, paymentAccount };
}

function isBlockedTransaction(row) {
  const type = String(row?.tipo ?? "").trim().toLowerCase();
  const category = String(row?.categoria ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const payload = row?.payload ?? {};

  if (type === "cartao_credito") return "CREDIT_CARD_TRANSACTION_NOT_ALLOWED";
  if (type === "transferencia") return "TRANSFER_TRANSACTION_NOT_ALLOWED";
  if (category === "transferencia") return "TRANSFER_TRANSACTION_NOT_ALLOWED";
  if (String(payload?.transferId ?? "").trim()) {
    return "TRANSFER_TRANSACTION_NOT_ALLOWED";
  }
  if (String(row?.transfer_from_id ?? "").trim()) {
    return "TRANSFER_TRANSACTION_NOT_ALLOWED";
  }
  if (String(row?.transfer_to_id ?? "").trim()) {
    return "TRANSFER_TRANSACTION_NOT_ALLOWED";
  }
  if (!COMMON_TYPES.has(type)) return "TRANSACTION_TYPE_NOT_ALLOWED";

  return "";
}

async function requireOwnedCommonTransaction(supabase, userId, transactionId) {
  const cleanId = String(transactionId ?? "").trim();

  if (!cleanId) {
    throw new ApiError(
      400,
      "TRANSACTION_ID_REQUIRED",
      "transaction_id is required."
    );
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", cleanId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data?.id) {
    throw new ApiError(
      404,
      "TRANSACTION_NOT_FOUND",
      "transaction_id was not found for this user."
    );
  }

  const blockedCode = isBlockedTransaction(data);
  if (blockedCode) {
    throw new ApiError(
      400,
      blockedCode,
      "This endpoint only supports common receitas/despesas."
    );
  }

  return data;
}

function buildTransactionSummary(type, description) {
  const label = type === "receita" ? "Receita" : "Despesa";
  return `${label} ${description} lançada com sucesso.`;
}

function buildInstallmentsSummary(type, description, installments) {
  const label = type === "receita" ? "Receita" : "Despesa";
  return `${label} ${description} parcelada em ${installments}x lançada com sucesso.`;
}

function buildFixedSummary(type, description, deadlineMode) {
  const label = type === "receita" ? "Receita" : "Despesa";
  const modeLabel = deadlineMode === "sem_prazo" ? "sem prazo" : "com prazo";
  return `${label} ${description} fixa ${modeLabel} lançada com sucesso.`;
}

function mapTransactionResponse(row) {
  return {
    id: row.id,
    type: row.tipo,
    description: row.descricao || "",
    amount: Number(row.valor || 0),
    date: row.data,
    account_id: row.conta_id || row.qual_conta || null,
    paid: Boolean(row.pago),
    category: row.categoria || "",
  };
}

module.exports = {
  MAX_FIXED_MONTHS,
  MAX_INSTALLMENTS,
  SEM_PRAZO_MONTHS,
  addMonthsLikeUi,
  buildFixedSummary,
  buildInstallmentPlanningFields,
  buildInstallmentsSummary,
  buildSemPrazoMeta,
  buildTransactionSummary,
  countMonthsInclusive,
  getAccountProfileId,
  isFutureDate,
  mapCanonicalAccount,
  mapCanonicalCreditCard,
  mapTransactionResponse,
  normalizePaymentMethod,
  normalizeDeadlineMode,
  normalizeSpendingType,
  normalizeTransactionType,
  parseBoolean,
  parseInstallments,
  parseIsoDate,
  parsePositiveAmount,
  toMoneyCents,
  fromMoneyCents,
  splitMoneyInCents,
  requireOwnedAccount,
  requireOwnedCreditCard,
  requireOwnedCommonTransaction,
  requireValidInvoicePaymentTargets,
  requireValidTransferAccounts,
  validateAccountId,
  validateCreditCardId,
};
