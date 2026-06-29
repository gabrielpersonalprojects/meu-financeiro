const { ApiError } = require("./http");
const { normalizeCatalogName } = require("./catalogNames");

const COMMON_TYPES = new Set(["receita", "despesa"]);
const MAX_INSTALLMENTS = 120;
const PAYMENT_METHODS = new Set([
  "pix",
  "boleto",
  "dinheiro",
  "debito",
  "credito",
  "transferencia_bancaria",
  "debito_conta",
]);

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
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "INVALID_AMOUNT", "amount must be greater than zero.");
  }

  return Math.abs(amount);
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
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setMonth(date.getMonth() + monthsToAdd);

  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
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
    return type === "despesa" ? "normal" : "";
  }

  if (raw === "parcelado") {
    throw new ApiError(
      400,
      "SPENDING_TYPE_NOT_SUPPORTED",
      "parcelado is not supported in this endpoint."
    );
  }

  if (raw === "variavel" || raw === "normal") {
    return raw === "variavel" ? "variável" : "normal";
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

function getAccountProfileId(account) {
  return String(account?.perfil_conta ?? "")
    .trim()
    .toLowerCase() === "pj"
    ? "pj"
    : "pf";
}

async function requireOwnedAccount(supabase, userId, accountId) {
  const cleanAccountId = String(accountId ?? "").trim();

  if (!cleanAccountId) {
    throw new ApiError(400, "ACCOUNT_ID_REQUIRED", "account_id is required.");
  }

  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, banco, perfil_conta")
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

  return data;
}

async function validateCategoryIfProvided({
  supabase,
  userId,
  profileId,
  type,
  category,
}) {
  const cleanCategory = String(category ?? "").trim();
  if (!cleanCategory) return "";

  const normalizedName = normalizeCatalogName(cleanCategory);

  const { data, error } = await supabase
    .from("user_categories")
    .select("id, nome, normalized_name")
    .eq("user_id", userId)
    .eq("profile_id", profileId)
    .eq("tipo", type)
    .eq("normalized_name", normalizedName)
    .limit(1);

  if (error) throw error;

  const found = data?.[0] ?? null;

  if (!found) {
    throw new ApiError(
      400,
      "CATEGORY_NOT_FOUND",
      "category does not exist for this user, profile, and type."
    );
  }

  return found.nome || cleanCategory;
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
  return `${label} ${description} parcelada em ${installments}x lanÃ§ada com sucesso.`;
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
  MAX_INSTALLMENTS,
  addMonthsLikeUi,
  buildInstallmentsSummary,
  buildTransactionSummary,
  getAccountProfileId,
  isFutureDate,
  mapTransactionResponse,
  normalizePaymentMethod,
  normalizeSpendingType,
  normalizeTransactionType,
  parseBoolean,
  parseInstallments,
  parseIsoDate,
  parsePositiveAmount,
  requireOwnedAccount,
  requireOwnedCommonTransaction,
  validateCategoryIfProvided,
};
