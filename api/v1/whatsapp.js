const crypto = require("crypto");
const { getSupabaseAdmin } = require("../_lib/supabaseAdmin");
const {
  ApiError,
  json,
  parseJson,
  requireMethod,
  requireString,
  withApi,
} = require("../_lib/http");
const {
  rejectUserIdFromSupplier,
  validateSupplierAuth,
} = require("../_lib/whatsappAuth");
const { resolveWhatsappUser } = require("../_lib/whatsappUser");
const { normalizeCatalogName } = require("../_lib/catalogNames");
const {
  requireIdempotencyKey,
  runIdempotentCommand,
  validateIdempotencyIdentifiers,
  validateStoredTransactionReplay,
} = require("../_lib/idempotency");
const {
  addMonthsLikeUi,
  buildFixedSummary,
  buildInstallmentPlanningFields,
  buildInstallmentsSummary,
  buildSemPrazoMeta,
  buildTransactionSummary,
  countMonthsInclusive,
  getAccountProfileId,
  isFutureDate,
  mapTransactionResponse,
  MAX_FIXED_MONTHS,
  normalizeDeadlineMode,
  normalizePaymentMethod,
  normalizeSpendingType,
  normalizeTransactionType,
  parseBoolean,
  parseInstallments,
  parseIsoDate,
  parsePositiveAmount,
  requireOwnedAccount,
  SEM_PRAZO_MONTHS,
  requireOwnedCommonTransaction,
  validateCategoryIfProvided,
} = require("../_lib/transactionsCommon");
const { resolvePendingTransaction } = require("../_lib/transactionResolver");

const BASE_ROUTE = "/api/v1/whatsapp";

function routeForAction(action) {
  return `${BASE_ROUTE}?action=${action}`;
}

function normalizeAction(req) {
  const action = String(req.query?.action ?? "").trim();
  if (!action) {
    throw new ApiError(400, "ACTION_REQUIRED", "action query parameter is required.");
  }
  return action;
}

function mapAccount(row) {
  return {
    id: row.id,
    name: row.name || row.banco || "Conta",
    bank: row.banco || "",
    account_type: row.tipo_conta || "",
    profile_type: row.perfil_conta || "",
  };
}

function mapCreditCard(row) {
  return {
    id: row.id,
    name: row.nome || "",
    issuer: row.bank_text || row.titular || "",
    category: row.categoria || "",
    profile_type: getCreditCardProfileId(row).toUpperCase(),
    closing_day: Number(row.dia_fechamento || 1),
    due_day: Number(row.dia_vencimento || 10),
    is_active: row.is_active !== false,
  };
}

function parseLimit(value) {
  const limit = Number(value || 50);
  if (!Number.isFinite(limit)) return 50;
  return Math.min(Math.max(Math.trunc(limit), 1), 100);
}

async function fetchAllRows(buildQuery, pageSize = 1000) {
  const allRows = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await buildQuery().range(from, to);

    if (error) throw error;

    const rows = data ?? [];
    allRows.push(...rows);

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

async function fetchAllTransactionsForUser(
  supabase,
  userId,
  { select = "*", build = (query) => query } = {}
) {
  return fetchAllRows(() => {
    const query = supabase
      .from("transactions")
      .select(select)
      .eq("user_id", userId);

    return build(query);
  });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getInvoiceMonth(dateIso, closingDay) {
  const date = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  const closing = Math.min(Math.max(Number(closingDay || 1), 1), 31);
  const day = date.getUTCDate();

  if (day >= closing) {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function invoiceDueDate(invoiceMonth, dueDay) {
  const [year, month] = String(invoiceMonth).split("-").map(Number);
  if (!year || !month) return null;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(Number(dueDay || 10), 1), lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function clampDay(year, monthIndex0, day) {
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  return Math.max(1, Math.min(Number(day || 1), lastDay));
}

function makeLocalDate(year, monthIndex0, day) {
  return new Date(year, monthIndex0, clampDay(year, monthIndex0, day), 12, 0, 0, 0);
}

function formatDateOnlyIsoLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function parseInvoiceMonthBase(invoiceMonth) {
  const [year, month] = String(invoiceMonth ?? "").split("-").map(Number);
  if (!year || !month) return null;
  return new Date(year, month - 1, 1, 12, 0, 0, 0);
}

function getCreditInvoiceCycle(cardId, invoiceMonth, closingDay, dueDay) {
  const baseMonth = parseInvoiceMonthBase(invoiceMonth);
  if (!baseMonth) return null;

  const closing = Math.max(1, Math.min(31, Number(closingDay ?? 1)));
  const due = Math.max(1, Math.min(31, Number(dueDay ?? 1)));
  const closingOffset = due > closing ? 0 : -1;

  const cycleEnd = makeLocalDate(
    baseMonth.getFullYear(),
    baseMonth.getMonth() + closingOffset,
    closing
  );
  cycleEnd.setHours(0, 0, 0, 0);

  const previousClosing = makeLocalDate(
    baseMonth.getFullYear(),
    baseMonth.getMonth() + closingOffset - 1,
    closing
  );
  previousClosing.setHours(0, 0, 0, 0);

  const cycleStart = new Date(previousClosing);
  cycleStart.setDate(cycleStart.getDate() + 1);
  cycleStart.setHours(0, 0, 0, 0);

  const dueDate = makeLocalDate(baseMonth.getFullYear(), baseMonth.getMonth(), due);
  dueDate.setHours(0, 0, 0, 0);

  const cycleStartIso = formatDateOnlyIsoLocal(cycleStart);
  const cycleEndIso = formatDateOnlyIsoLocal(cycleEnd);

  return {
    ciclo_key: `${cardId}__${cycleStartIso}__${cycleEndIso}`,
    cycle_start: cycleStartIso,
    cycle_end: cycleEndIso,
    due_date: formatDateOnlyIsoLocal(dueDate),
    cycle_start_date: cycleStart,
    cycle_end_date: cycleEnd,
    due_date_obj: dueDate,
  };
}

function parseCreditInvoiceCycleKey(cicloKey) {
  const clean = String(cicloKey ?? "").trim();
  const parts = clean.split("__");

  if (parts.length !== 3) {
    throw new ApiError(
      400,
      "INVALID_CICLO_KEY",
      "ciclo_key must use format credit_card_id__YYYY-MM-DD__YYYY-MM-DD."
    );
  }

  const [creditCardId, cycleStart, cycleEnd] = parts.map((part) =>
    String(part ?? "").trim()
  );

  if (!creditCardId || !/^\d{4}-\d{2}-\d{2}$/.test(cycleStart) || !/^\d{4}-\d{2}-\d{2}$/.test(cycleEnd)) {
    throw new ApiError(
      400,
      "INVALID_CICLO_KEY",
      "ciclo_key must use format credit_card_id__YYYY-MM-DD__YYYY-MM-DD."
    );
  }

  const cycleStartDate = new Date(`${cycleStart}T00:00:00`);
  const cycleEndDate = new Date(`${cycleEnd}T00:00:00`);

  if (
    Number.isNaN(cycleStartDate.getTime()) ||
    Number.isNaN(cycleEndDate.getTime()) ||
    cycleStartDate.getTime() > cycleEndDate.getTime()
  ) {
    throw new ApiError(
      400,
      "INVALID_CICLO_KEY",
      "ciclo_key has invalid cycle dates."
    );
  }

  return {
    ciclo_key: clean,
    credit_card_id: creditCardId,
    cycle_start: cycleStart,
    cycle_end: cycleEnd,
    cycle_start_date: cycleStartDate,
    cycle_end_date: cycleEndDate,
  };
}

function getInvoiceMonthFromCycleEnd(cycleEndIso, closingDay, dueDay) {
  const date = new Date(`${cycleEndIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  const closing = Math.max(1, Math.min(31, Number(closingDay ?? 1)));
  const due = Math.max(1, Math.min(31, Number(dueDay ?? 1)));
  const invoiceOffset = due > closing ? 0 : 1;
  const base = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
  base.setMonth(base.getMonth() + invoiceOffset);

  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

function getCreditInvoiceMonth(dateIso, closingDay, dueDay) {
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  const closing = Math.max(1, Math.min(31, Number(closingDay ?? 1)));
  const due = Math.max(1, Math.min(31, Number(dueDay ?? 1)));
  const invoiceOffset = due > closing ? 0 : 1;
  const base = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);

  if (date.getDate() >= closing) {
    base.setMonth(base.getMonth() + 1);
  }

  base.setMonth(base.getMonth() + invoiceOffset);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

function getCreditTransactionCardId(row) {
  return String(
    row?.cartao_id ??
      row?.qual_conta ??
      row?.payload?.cartaoId ??
      row?.payload?.qualCartao ??
      row?.payload?.targetId ??
      ""
  ).trim();
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function buildInvoicePaymentTransactionDescription(card) {
  const issuer = String(card?.bank_text ?? card?.titular ?? card?.emissor ?? "").trim() || "Cartão";
  const category = String(card?.categoria ?? "").trim();
  return category ? `Fatura: ${issuer} ${category}` : `Fatura: ${issuer}`;
}

function getCreditInvoiceStatusForApi({
  amount,
  remainingAmount,
  today,
  cycleStart,
  cycleEnd,
  dueDate,
  manualStatus,
}) {
  const total = Math.abs(Number(amount || 0));
  const remaining = Math.max(0, Number(remainingAmount || 0));
  const manual = String(manualStatus ?? "").trim().toLowerCase();

  if (manual === "paga") return "PAGA";
  if (total <= 0 && remaining <= 0) return "ZERADA";
  if (total > 0 && remaining <= 0) return "PAGA";
  if (today < cycleStart) return "FUTURA";
  if (today <= cycleEnd) return "EM_ABERTO";
  if (today <= dueDate) return "FECHADA";
  return "ATRASADA";
}

function formatCurrencyBR(value) {
  const amount = Number(value || 0);
  return `R$ ${amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildInvoicePaymentGuidance(status, remainingAmount) {
  const remaining = Math.max(0, Number(remainingAmount || 0));
  const formatted = formatCurrencyBR(remaining);

  if ((status === "FECHADA" || status === "ATRASADA") && remaining > 0) {
    return {
      can_pay_via_api: true,
      api_payment_type: "full_only",
      payment_message: `Esta fatura pode ser paga pela API somente pelo valor total à vista de ${formatted}. Para continuar, escolha de qual conta bancária o pagamento deve sair.`,
      panel_required_reason: null,
      payment_account_required: true,
      account_selection_message:
        "Para pagar esta fatura pela API, escolha de qual conta bancária o pagamento deve sair.",
    };
  }

  if (status === "EM_ABERTO" && remaining > 0) {
    return {
      can_pay_via_api: false,
      api_payment_type: "full_only",
      payment_message: `Esta fatura ainda está em aberto. O valor gasto até agora é ${formatted}. Para pagamento parcial ou antecipado, acesse o painel FluxMoney.`,
      panel_required_reason: "invoice_still_open",
      payment_account_required: false,
      account_selection_message: null,
    };
  }

  if (status === "FUTURA") {
    return {
      can_pay_via_api: false,
      api_payment_type: "full_only",
      payment_message:
        "Esta fatura ainda é futura. Para consultar ou gerenciar detalhes, acesse o painel FluxMoney.",
      panel_required_reason: "future_invoice",
      payment_account_required: false,
      account_selection_message: null,
    };
  }

  return {
    can_pay_via_api: false,
    api_payment_type: "full_only",
    payment_message: "Esta fatura não possui saldo pendente para pagamento.",
    panel_required_reason: "no_pending_amount",
    payment_account_required: false,
    account_selection_message: null,
  };
}

function addMonthsSafeLikeCreditUi(isoDate, monthsToAdd) {
  const [year, month, day] = String(isoDate).split("-").map(Number);
  const lastDayTarget = new Date(year, month - 1 + monthsToAdd + 1, 0).getDate();
  const safeDay = Math.min(day, lastDayTarget);
  const date = new Date(year, month - 1 + monthsToAdd, safeDay, 12, 0, 0, 0);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function normalizeCreditSpendingType(value) {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!raw || raw === "variavel" || raw === "normal") return "Variável";
  if (raw === "fixo") return "Fixo";

  throw new ApiError(
    400,
    "INVALID_SPENDING_TYPE",
    "spending_type must be variavel, variável, fixo, or omitted."
  );
}

function getCreditCardProfileId(card) {
  const raw = String(
    card?.perfil ??
      card?.perfil_cartao ??
      card?.perfilCartao ??
      card?.categoria ??
      card?.category ??
      card?.brand ??
      ""
  )
    .trim()
    .toLowerCase();

  return raw === "pj" ? "pj" : "pf";
}

function getCreditCardAccountId(card) {
  return (
    String(
      card?.conta_pagante_id ??
        card?.contaPaganteId ??
        card?.conta_id ??
        card?.contaId ??
        card?.profile_id ??
        card?.profileId ??
        card?.account_id ??
        card?.accountId ??
        ""
    ).trim() || null
  );
}

function normalizeCategoryType(value) {
  const type = String(value ?? "").trim();
  if (type !== "receita" && type !== "despesa") {
    throw new ApiError(
      400,
      "INVALID_CATEGORY_TYPE",
      "type must be either receita or despesa."
    );
  }
  return type;
}

function normalizeProfileId(value) {
  const profileId = String(value ?? "").trim().toLowerCase();

  if (profileId !== "pf" && profileId !== "pj") {
    throw new ApiError(
      400,
      "INVALID_PROFILE_ID",
      "profile_id must be pf or pj."
    );
  }

  return profileId;
}

function typeLabel(type) {
  return String(type ?? "") === "receita" ? "Receita" : "Despesa";
}

function settledVerb(type) {
  return String(type ?? "") === "receita" ? "recebida" : "paga";
}

function formatMoneyPtBr(value) {
  return `R$ ${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getSaoPauloTodayIso() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function normalizeSummaryPeriod(value, todayIsoValue) {
  const raw = String(value ?? "").trim();
  if (!raw) return String(todayIsoValue).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(raw)) {
    throw new ApiError(400, "PERIOD_INVALID", "period must use format YYYY-MM.");
  }

  const month = Number(raw.slice(5, 7));
  if (month < 1 || month > 12) {
    throw new ApiError(400, "PERIOD_INVALID", "period must use format YYYY-MM.");
  }

  return raw;
}

function addDaysIso(dateIso, days) {
  const date = new Date(`${dateIso}T12:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function isPaidValue(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return value === true || value === 1 || raw === "1" || raw === "true" || raw === "pago";
}

function getTransactionAccountId(row) {
  return String(row?.conta_id ?? row?.qual_conta ?? "").trim();
}

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getTransactionPayload(row) {
  return row?.payload && typeof row.payload === "object" ? row.payload : {};
}

function getMovementKind(row) {
  return String(row?.payload?.movementKind ?? row?.movementKind ?? "")
    .trim()
    .toLowerCase();
}

function getLinkedMovementId(row) {
  return String(row?.payload?.linkedMovementId ?? row?.linkedMovementId ?? "").trim();
}

function getTransferId(row) {
  return String(
    row?.payload?.transferId ??
      row?.transferId ??
      row?.transfer_id ??
      row?.payload?.transfer_id ??
      ""
  ).trim();
}

function getMovementRecurrenceId(row) {
  return String(
    row?.payload?.recorrenciaId ??
      row?.payload?.recurrenceId ??
      row?.recorrenciaId ??
      row?.recurrenceId ??
      ""
  ).trim();
}

function isPfPjMovement(row) {
  return getMovementKind(row) === "pf_pj";
}

function getMovementAccountIds(row) {
  const payload = getTransactionPayload(row);
  const fromAccountId = String(
    row?.transfer_from_id ??
      row?.conta_origem_id ??
      payload?.originAccountId ??
      payload?.conta_origem_id ??
      payload?.contaOrigemId ??
      ""
  ).trim();
  const toAccountId = String(
    row?.transfer_to_id ??
      row?.conta_destino_id ??
      payload?.destinationAccountId ??
      payload?.conta_destino_id ??
      payload?.contaDestinoId ??
      ""
  ).trim();

  return { fromAccountId, toAccountId };
}

function isTransferTransaction(row) {
  if (isPfPjMovement(row)) return false;

  const type = normalizeText(row?.tipo);
  const category = normalizeText(row?.categoria);
  const transferId = getTransferId(row);
  const movementAccounts = getMovementAccountIds(row);

  return (
    type === "transferencia" ||
    type === "transferência" ||
    category === "transferencia" ||
    category === "transferência" ||
    category.includes("transfer") ||
    Boolean(transferId) ||
    Boolean(movementAccounts.fromAccountId) ||
    Boolean(movementAccounts.toAccountId)
  );
}

function signedBankAmount(row) {
  const type = String(row?.tipo ?? "").trim().toLowerCase();
  const amount = Math.abs(Number(row?.valor || 0));

  if (type === "cartao_credito") return 0;
  if (type === "receita") return amount;
  if (type === "despesa") return -amount;

  return Number(row?.valor || 0);
}

function makeAccountLabel(account) {
  return String(account?.name || account?.banco || "Conta").trim();
}

function makeProfileLabel(account) {
  return String(account?.perfil_conta || "").trim().toUpperCase();
}

function normalizeSummaryProfile(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;

  if (raw !== "PF" && raw !== "PJ") {
    throw new ApiError(400, "PROFILE_INVALID", "profile must be PF or PJ.");
  }

  return raw;
}

function parseSummaryAccountFilters(query) {
  const accountId = String(query?.account_id ?? "").trim();
  const accountIdsRaw = String(query?.account_ids ?? "").trim();
  const hasAccountIdsParam = Object.prototype.hasOwnProperty.call(
    query ?? {},
    "account_ids"
  );

  if (accountId && accountIdsRaw) {
    throw new ApiError(
      400,
      "ACCOUNT_FILTER_CONFLICT",
      "Use account_id or account_ids, not both."
    );
  }

  if (accountId) {
    return { account_id: accountId, account_ids: [accountId] };
  }

  if (!accountIdsRaw && !hasAccountIdsParam) {
    return { account_id: null, account_ids: [] };
  }

  if (!accountIdsRaw && hasAccountIdsParam) {
    throw new ApiError(
      400,
      "ACCOUNT_IDS_INVALID",
      "account_ids must include at least one account id."
    );
  }

  const accountIds = accountIdsRaw
    .split(",")
    .map((id) => String(id ?? "").trim())
    .filter(Boolean);

  const uniqueAccountIds = Array.from(new Set(accountIds));

  if (!uniqueAccountIds.length) {
    throw new ApiError(
      400,
      "ACCOUNT_IDS_INVALID",
      "account_ids must include at least one account id."
    );
  }

  return { account_id: null, account_ids: uniqueAccountIds };
}

function normalizeProjectionMonths(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 12;

  const months = Number(raw);
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    throw new ApiError(
      400,
      "MONTHS_INVALID",
      "months deve ser um número entre 1 e 24."
    );
  }

  return months;
}

function normalizeProjectionStartPeriod(value, todayIsoValue) {
  const raw = String(value ?? "").trim();
  if (!raw) return String(todayIsoValue).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(raw)) {
    throw new ApiError(
      400,
      "START_PERIOD_INVALID",
      "start_period must use format YYYY-MM."
    );
  }

  const month = Number(raw.slice(5, 7));
  if (month < 1 || month > 12) {
    throw new ApiError(
      400,
      "START_PERIOD_INVALID",
      "start_period must use format YYYY-MM."
    );
  }

  return raw;
}

function normalizeProjectionMode(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "acumulado";

  if (raw !== "acumulado" && raw !== "mensal") {
    throw new ApiError(
      400,
      "PROJECTION_MODE_INVALID",
      "mode must be acumulado or mensal."
    );
  }

  return raw;
}

function normalizeProjectionProfile(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw || raw === "ALL") return "all";

  if (raw !== "PF" && raw !== "PJ") {
    throw new ApiError(
      400,
      "PROFILE_INVALID",
      "profile must be PF, PJ, or all."
    );
  }

  return raw;
}

function parseProjectionIdFilters(query, singularName, pluralName, conflictCode, invalidCode) {
  const singleId = String(query?.[singularName] ?? "").trim();
  const idsRaw = String(query?.[pluralName] ?? "").trim();
  const hasPluralParam = Object.prototype.hasOwnProperty.call(query ?? {}, pluralName);

  if (singleId && idsRaw) {
    throw new ApiError(
      400,
      conflictCode,
      `Use ${singularName} or ${pluralName}, not both.`
    );
  }

  if (singleId) {
    return { single_id: singleId, ids: [singleId] };
  }

  if (!idsRaw && !hasPluralParam) {
    return { single_id: null, ids: [] };
  }

  if (!idsRaw && hasPluralParam) {
    throw new ApiError(
      400,
      invalidCode,
      `${pluralName} must include at least one id.`
    );
  }

  const ids = idsRaw
    .split(",")
    .map((id) => String(id ?? "").trim())
    .filter(Boolean);
  const uniqueIds = Array.from(new Set(ids));

  if (!uniqueIds.length) {
    throw new ApiError(
      400,
      invalidCode,
      `${pluralName} must include at least one id.`
    );
  }

  return { single_id: null, ids: uniqueIds };
}

function parseProjectionBoolean(value, defaultValue, code, name) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  if (["true", "1", "yes", "sim"].includes(raw)) return true;
  if (["false", "0", "no", "nao", "não"].includes(raw)) return false;

  throw new ApiError(400, code, `${name} must be true or false.`);
}

function firstQueryValue(query, ...names) {
  for (const name of names) {
    const value = query?.[name];
    if (value !== undefined && String(value ?? "").trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function hasQueryValue(query, ...names) {
  return names.some(
    (name) =>
      Object.prototype.hasOwnProperty.call(query ?? {}, name) &&
      String(query?.[name] ?? "").trim() !== ""
  );
}

function requireExplicitQueryFilters(query, filters, action) {
  const missing = filters
    .filter((filter) => !hasQueryValue(query, ...(filter.aliases || [filter.name])))
    .map((filter) => filter.name);

  if (missing.length > 0) {
    throw new ApiError(
      400,
      "FILTER_REQUIRED",
      `${action} requires explicit filters: ${missing.join(", ")}.`,
      {
        action,
        missing_filters: missing,
        required_filters: filters.map((filter) => ({
          name: filter.name,
          aliases: filter.aliases || [filter.name],
          allowed_values: filter.allowed_values || null,
        })),
      }
    );
  }
}

function addMonthsToPeriod(period, offset) {
  const [year, month] = String(period).split("-").map(Number);
  const date = new Date(year, month - 1 + Number(offset || 0), 1, 12, 0, 0, 0);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatProjectionPeriodLabel(period) {
  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const [year, month] = String(period).split("-").map(Number);
  const index = Math.max(0, Math.min(11, (month || 1) - 1));
  return `${months[index]} de ${year}`;
}

function normalizeProjectionAccountProfile(account) {
  const raw = String(
    account?.perfil_conta ??
      account?.perfilConta ??
      account?.perfil ??
      account?.brand ??
      ""
  )
    .trim()
    .toUpperCase();

  return raw === "PF" || raw === "PJ" ? raw : "";
}

function normalizeProjectionCardProfile(card) {
  const raw = String(
    card?.perfil ??
      card?.perfil_cartao ??
      card?.perfilCartao ??
      card?.categoria ??
      card?.category ??
      card?.brand ??
      ""
  )
    .trim()
    .toUpperCase();

  if (raw === "PF" || raw === "PJ") return raw;
  return getCreditCardProfileId(card).toUpperCase();
}

function getProjectionInitialBalance(account) {
  if (account?.initial_balance_cents != null) {
    return Number(account.initial_balance_cents || 0) / 100;
  }
  if (account?.initialBalanceCents != null) {
    return Number(account.initialBalanceCents || 0) / 100;
  }
  if (account?.initialBalance != null) return Number(account.initialBalance || 0);
  if (account?.saldoInicial != null) return Number(account.saldoInicial || 0);
  if (account?.saldo_inicial != null) return Number(account.saldo_inicial || 0);
  return 0;
}

function getProjectionTransactionAccountId(row) {
  return String(
    row?.profileId ??
      row?.profile_id ??
      row?.conta_id ??
      row?.account_id ??
      row?.contaId ??
      row?.accountId ??
      row?.qual_conta ??
      row?.qualConta ??
      row?.conta_origem_id ??
      row?.contaOrigemId ??
      row?.conta_destino_id ??
      row?.contaDestinoId ??
      row?.transfer_from_id ??
      row?.transferFromId ??
      row?.transfer_to_id ??
      row?.transferToId ??
      row?.conta?.id ??
      row?.profile?.id ??
      row?.payload?.profileId ??
      row?.payload?.profile_id ??
      row?.payload?.conta_id ??
      row?.payload?.account_id ??
      row?.payload?.contaId ??
      row?.payload?.accountId ??
      row?.payload?.qual_conta ??
      row?.payload?.qualConta ??
      row?.payload?.conta_origem_id ??
      row?.payload?.contaOrigemId ??
      row?.payload?.conta_destino_id ??
      row?.payload?.contaDestinoId ??
      row?.payload?.transfer_from_id ??
      row?.payload?.transferFromId ??
      row?.payload?.transfer_to_id ??
      row?.payload?.transferToId ??
      ""
  ).trim();
}

function getProjectionCreditCardId(row, cardsById) {
  const refs = [
    row?.cartao_id,
    row?.cartaoId,
    row?.creditCardId,
    row?.credit_card_id,
    row?.card_id,
    row?.cardId,
    row?.selectedCreditCardId,
    row?.selected_credit_card_id,
    row?.qual_conta,
    row?.qualConta,
    row?.qual_cartao,
    row?.qualCartao,
    row?.payload?.cartao_id,
    row?.payload?.cartaoId,
    row?.payload?.creditCardId,
    row?.payload?.credit_card_id,
    row?.payload?.card_id,
    row?.payload?.cardId,
    row?.payload?.selectedCreditCardId,
    row?.payload?.selected_credit_card_id,
    row?.payload?.qual_conta,
    row?.payload?.qualConta,
    row?.payload?.qual_cartao,
    row?.payload?.qualCartao,
    row?.payload?.targetId,
    row?.payload?.target_id,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  if (!refs.length) return "";

  for (const ref of refs) {
    if (cardsById.has(ref)) return ref;
  }

  const cards = Array.from(cardsById.values());
  for (const ref of refs) {
    const refNorm = normalizeText(ref);
    const matched = cards.find((card) => {
      const name = normalizeText(card?.nome ?? card?.name);
      const issuer = normalizeText(
        card?.bank_text ?? card?.bankText ?? card?.titular ?? card?.emissor
      );
      return (name && refNorm === name) || (issuer && refNorm === issuer);
    });
    if (matched?.id) return String(matched.id);
  }

  return "";
}

function getProjectionTransactionProfile(row, accountsById, cardsById) {
  const accountId = getProjectionTransactionAccountId(row);
  if (accountId && accountsById.has(accountId)) {
    const profile = normalizeProjectionAccountProfile(accountsById.get(accountId));
    if (profile) return profile;
  }

  const cardId = getProjectionCreditCardId(row, cardsById);
  if (cardId && cardsById.has(cardId)) {
    const profile = normalizeProjectionCardProfile(cardsById.get(cardId));
    if (profile) return profile;
  }

  return "";
}

function getProjectionTransactionPeriod(row, cardsById) {
  const type = String(row?.tipo ?? "").trim().toLowerCase();
  const date = String(row?.data ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";

  if (type !== "cartao_credito") return date.slice(0, 7);

  const savedInvoiceMonth = String(row?.faturaMes ?? row?.payload?.faturaMes ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(savedInvoiceMonth)) return savedInvoiceMonth;

  const cardId = getProjectionCreditCardId(row, cardsById);
  const card = cardId ? cardsById.get(cardId) : null;
  if (!card) return date.slice(0, 7);

  return getCreditInvoiceMonth(date, card.dia_fechamento, card.dia_vencimento) || date.slice(0, 7);
}

function isProjectionInvoicePayment(row) {
  const description = normalizeText(row?.descricao);
  const categoryRaw = row?.categoria;
  const category = normalizeText(
    typeof categoryRaw === "string"
      ? categoryRaw
      : categoryRaw?.nome ?? categoryRaw?.label ?? categoryRaw?.value ?? ""
  );
  const origin = normalizeText(row?.origemLancamento ?? row?.payload?.origemLancamento);
  const isInvoiceInstallment =
    origin === "parcelamento_fatura" ||
    description.startsWith("parcelamento de fatura") ||
    category === "parcelamento de fatura";

  if (isInvoiceInstallment) return false;
  return description.startsWith("fatura:");
}

function isProjectionTransfer(row) {
  return isTransferTransaction(row);
}

function mapSummaryTransactionItem(row, accountsById, status) {
  const accountId = getTransactionAccountId(row);
  const account = accountId ? accountsById.get(accountId) : null;
  return {
    kind: "transaction",
    id: row.id,
    type: row.tipo,
    description: row.descricao || "",
    amount: Number(row.valor || 0),
    date: row.data,
    due_date: row.data,
    status,
    account_label: account ? makeAccountLabel(account) : null,
    profile: account ? makeProfileLabel(account) || null : null,
  };
}

function mapSummaryInvoiceItem(invoice) {
  return {
    kind: "credit_card_invoice",
    invoice_ref: invoice.invoice_ref,
    ciclo_key: invoice.ciclo_key,
    type: "credit_card_invoice",
    name: invoice.credit_card_name || "Fatura",
    amount: Number(invoice.remaining_amount || 0),
    due_date: invoice.due_date,
    status: invoice.status,
  };
}

function computeFinancialProjection({
  transactions,
  accountsById,
  cardsById,
  selectedAccountIds,
  selectedCreditCardIds,
  profile,
  includeCreditCards,
  includeTransfers,
  startPeriod,
  months,
  mode,
  initialBalance,
}) {
  const selectedAccountSet = new Set(selectedAccountIds.map((id) => String(id)));
  const selectedCardSet = new Set(selectedCreditCardIds.map((id) => String(id)));
  const hasAccountFilter = selectedAccountSet.size > 0;
  const hasCardFilter = selectedCardSet.size > 0;
  const profileFilter = profile === "PF" || profile === "PJ" ? profile : null;

  const transactionBelongsToProjection = (transaction) => {
    const type = String(transaction?.tipo ?? "").trim().toLowerCase();

    if (type === "cartao_credito") {
      if (!includeCreditCards) return false;

      const cardId = getProjectionCreditCardId(transaction, cardsById);
      const card = cardId ? cardsById.get(cardId) : null;
      if (!card || card.is_active === false) return false;

      if (profileFilter && normalizeProjectionCardProfile(card) !== profileFilter) {
        return false;
      }

      if (hasCardFilter && !selectedCardSet.has(cardId)) return false;
      return true;
    }

    const accountId = getProjectionTransactionAccountId(transaction);
    const account = accountId ? accountsById.get(accountId) : null;

    if (profileFilter) {
      if (!account || normalizeProjectionAccountProfile(account) !== profileFilter) {
        return false;
      }
    }

    if (hasAccountFilter && (!accountId || !selectedAccountSet.has(accountId))) {
      return false;
    }

    return true;
  };

  const scopedTransactions = (transactions ?? []).filter((transaction) => {
    if (!transactionBelongsToProjection(transaction)) return false;
    if (!includeTransfers && isProjectionTransfer(transaction)) return false;
    return true;
  });

  const projection = [];
  let runningBalance = Number(initialBalance || 0);

  for (let index = 0; index < months; index += 1) {
    const period = addMonthsToPeriod(startPeriod, index);
    const monthTransactions = scopedTransactions.filter(
      (transaction) => getProjectionTransactionPeriod(transaction, cardsById) === period
    );

    const incomeItems = monthTransactions.filter(
      (transaction) => String(transaction?.tipo ?? "").trim().toLowerCase() === "receita"
    );

    const fixedExpenseItems = monthTransactions.filter((transaction) => {
      const type = String(transaction?.tipo ?? "").trim().toLowerCase();
      const spendingType = normalizeText(transaction?.tipoGasto ?? transaction?.payload?.tipoGasto);
      return type === "despesa" && spendingType === "fixo";
    });

    const variableAndCardItems = monthTransactions
      .filter((transaction) => {
        const type = String(transaction?.tipo ?? "").trim().toLowerCase();
        const spendingType = normalizeText(
          transaction?.tipoGasto ?? transaction?.payload?.tipoGasto
        );
        const origin = normalizeText(
          transaction?.origemLancamento ?? transaction?.payload?.origemLancamento
        );
        const isCard = type === "cartao_credito";
        const isVariableExpense =
          type === "despesa" &&
          (spendingType === "normal" || spendingType === "variavel");
        const isInvoiceInstallment = origin === "parcelamento_fatura";

        return (
          isCard ||
          isVariableExpense ||
          isInvoiceInstallment ||
          isProjectionInvoicePayment(transaction)
        );
      })
      .filter((transaction) => !isProjectionInvoicePayment(transaction));

    const income = incomeItems.reduce(
      (sum, transaction) => sum + Number(transaction?.valor || 0),
      0
    );
    const fixedExpenses = fixedExpenseItems.reduce(
      (sum, transaction) => sum + Math.abs(Number(transaction?.valor || 0)),
      0
    );
    const variableAndCardExpenses = variableAndCardItems.reduce(
      (sum, transaction) => sum + Math.abs(Number(transaction?.valor || 0)),
      0
    );
    const monthlyResult = income - (fixedExpenses + variableAndCardExpenses);

    if (mode === "acumulado") {
      runningBalance += monthlyResult;
    }

    const projectedBalance = mode === "acumulado" ? runningBalance : monthlyResult;

    projection.push({
      period,
      label: formatProjectionPeriodLabel(period),
      income: roundMoney(income),
      fixed_expenses: roundMoney(fixedExpenses),
      variable_and_card_expenses: roundMoney(variableAndCardExpenses),
      monthly_result: roundMoney(monthlyResult),
      projected_balance: roundMoney(projectedBalance),
      items_summary: {
        income_count: incomeItems.length,
        fixed_expense_count: fixedExpenseItems.length,
        variable_and_card_count: variableAndCardItems.length,
      },
    });
  }

  return projection;
}

function buildProjectionSuggestedMessages({
  projection,
  months,
  mode,
  profile,
  accountLabels,
  finalProjectedBalance,
  tightestMonth,
  firstNegativeMonth,
}) {
  const scopeLabel =
    accountLabels.length === 1
      ? `Na conta ${accountLabels[0]}`
      : accountLabels.length > 1
      ? `Nas contas ${accountLabels.join(", ")}`
      : profile === "PF" || profile === "PJ"
      ? `Na ${profile}`
      : "Na visão geral";
  const projectionKind = mode === "acumulado" ? "acumulada" : "mensal";
  const balanceLabel = mode === "acumulado" ? "termina em" : "tem resultado final de";
  const firstMessage =
    accountLabels.length || profile === "PF" || profile === "PJ"
      ? `${scopeLabel}, sua projeção ${projectionKind} para os próximos ${months} meses ${balanceLabel} ${formatMoneyPtBr(
          finalProjectedBalance
        )}.`
      : `Sua projeção ${projectionKind} para os próximos ${months} meses ${balanceLabel} ${formatMoneyPtBr(
          finalProjectedBalance
        )}.`;
  const messages = [
    firstMessage,
  ];

  if (tightestMonth?.period) {
    messages.push(
      `O mês mais apertado é ${tightestMonth.label}, com saldo projetado de ${formatMoneyPtBr(
        tightestMonth.projected_balance
      )}.`
    );
  }

  if (firstNegativeMonth?.period) {
    messages.push(`Atenção: sua projeção fica negativa em ${firstNegativeMonth.label}.`);
  }

  const firstMonth = projection?.[0];
  if (firstMonth) {
    messages.push(
      `Em ${firstMonth.label}, o resultado projetado é ${formatMoneyPtBr(
        firstMonth.monthly_result
      )}.`
    );
  }

  return messages;
}

function assertFinancialProjectionContract(projection, months) {
  if (!Array.isArray(projection) || projection.length !== months) {
    throw new ApiError(
      500,
      "FINANCIAL_PROJECTION_CONTRACT_ERROR",
      "financial_projection did not produce the expected monthly projection array."
    );
  }

  for (const item of projection) {
    const hasRequiredShape =
      item &&
      typeof item === "object" &&
      typeof item.period === "string" &&
      Object.prototype.hasOwnProperty.call(item, "income") &&
      Object.prototype.hasOwnProperty.call(item, "fixed_expenses") &&
      Object.prototype.hasOwnProperty.call(item, "variable_and_card_expenses") &&
      Object.prototype.hasOwnProperty.call(item, "monthly_result") &&
      Object.prototype.hasOwnProperty.call(item, "projected_balance") &&
      item.items_summary &&
      typeof item.items_summary === "object";

    if (!hasRequiredShape) {
      throw new ApiError(
        500,
        "FINANCIAL_PROJECTION_CONTRACT_ERROR",
        "financial_projection produced a malformed projection item."
      );
    }
  }
}

function normalizeAnalyticsPeriod(value, todayIsoValue) {
  const raw = String(value ?? "").trim();
  if (!raw) return String(todayIsoValue).slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(raw)) {
    throw new ApiError(400, "PERIOD_INVALID", "period must use format YYYY-MM.");
  }

  const month = Number(raw.slice(5, 7));
  if (month < 1 || month > 12) {
    throw new ApiError(400, "PERIOD_INVALID", "period must use format YYYY-MM.");
  }

  return raw;
}

function normalizeAnalyticsSource(value) {
  const raw = normalizeText(value);
  if (!raw) return "all";

  if (["general", "geral", "accounts", "account", "contas", "conta"].includes(raw)) {
    return "general";
  }
  if (
    [
      "credit_cards",
      "credit_card",
      "cards",
      "card",
      "cartoes",
      "cartao",
    ].includes(raw)
  ) {
    return "credit_cards";
  }
  if (["all", "todos", "todas"].includes(raw)) return "all";

  throw new ApiError(
    400,
    "ANALYTICS_SOURCE_INVALID",
    "source must be general, credit_cards, or all."
  );
}

function normalizeAnalyticsLimit(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 10;

  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
    throw new ApiError(400, "LIMIT_INVALID", "limit must be a number between 1 and 20.");
  }

  return limit;
}

function getAnalyticsCategory(row) {
  const category = String(row?.categoria ?? row?.payload?.categoria ?? "").trim();
  return category || "Sem categoria";
}

function getAnalyticsGeneralCategory(row) {
  const category = String(row?.categoria || "Sem categoria").trim();
  return category || "Sem categoria";
}

function mapAnalyticsTransactionToApp(row) {
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};
  const mapped = {
    id: row?.id,
    tipo: row?.tipo,
    valor: Number(row?.valor ?? 0),
    data: row?.data,
    descricao: row?.descricao ?? "",
    categoria: row?.categoria ?? "",
    tag: row?.tag ?? "",
    pago: Boolean(row?.pago),
    payload,
    conta_id: row?.conta_id ?? null,
    conta_origem_id: row?.conta_origem_id ?? null,
    conta_destino_id: row?.conta_destino_id ?? null,
    cartao_id: row?.cartao_id ?? null,
    transfer_from_id: row?.transfer_from_id ?? "",
    transfer_to_id: row?.transfer_to_id ?? "",
    qual_conta: row?.qual_conta ?? "",
    criado_em: row?.criado_em ?? undefined,
    contaId: row?.conta_id ?? undefined,
    contaOrigemId: row?.conta_origem_id ?? undefined,
    contaDestinoId: row?.conta_destino_id ?? undefined,
    cartaoId: row?.cartao_id ?? payload?.cartaoId ?? "",
    qualCartao: row?.cartao_id ?? payload?.qualCartao ?? payload?.cartaoId ?? "",
    qualConta: row?.qual_conta ?? "",
    transferFromId: row?.transfer_from_id ?? "",
    transferToId: row?.transfer_to_id ?? "",
    metodoPagamento: payload?.metodoPagamento ?? "",
    tipoGasto: payload?.tipoGasto ?? "",
    recorrenciaId: payload?.recorrenciaId ?? row?.recorrenciaId ?? "",
    isRecorrente: payload?.isRecorrente ?? false,
    contraParte: payload?.contraParte ?? "",
    transferId: payload?.transferId ?? row?.transferId ?? "",
    observacoes: payload?.observacoes ?? "",
    parcelaAtual: payload?.parcelaAtual ?? row?.parcelaAtual ?? undefined,
    totalParcelas: payload?.totalParcelas ?? row?.totalParcelas ?? undefined,
    origemLancamento: payload?.origemLancamento ?? "",
    parcelamentoFaturaId: payload?.parcelamentoFaturaId ?? "",
    faturaOrigemCicloKey: payload?.faturaOrigemCicloKey ?? "",
  };

  return normalizeAnalyticsCreditTransactionCardRefs(mapped);
}

function normalizeAnalyticsCreditTransactionCardRefs(transaction) {
  if (String(transaction?.tipo ?? "").trim().toLowerCase() !== "cartao_credito") {
    return transaction;
  }

  const payload =
    transaction?.payload && typeof transaction.payload === "object"
      ? transaction.payload
      : {};
  const cardRef = String(
    transaction?.cartaoId ??
      transaction?.cartao_id ??
      transaction?.qualCartao ??
      transaction?.qual_cartao ??
      transaction?.qualConta ??
      transaction?.qual_conta ??
      payload?.cartaoId ??
      payload?.cartao_id ??
      payload?.qualCartao ??
      payload?.qual_cartao ??
      payload?.qualConta ??
      payload?.qual_conta ??
      payload?.targetId ??
      payload?.target_id ??
      ""
  ).trim();

  if (!cardRef) {
    return { ...transaction, payload };
  }

  return {
    ...transaction,
    cartaoId: cardRef,
    qualCartao: cardRef,
    payload: {
      ...payload,
      cartaoId: cardRef,
      qualCartao: cardRef,
      targetId: String(payload?.targetId ?? payload?.target_id ?? cardRef).trim(),
    },
  };
}

function mapAnalyticsAccountToApp(row) {
  return {
    ...row,
    id: row?.id,
    name: row?.name || row?.banco || "Conta",
    banco: row?.banco || row?.name || "Conta",
    numeroConta: row?.numero_conta || "",
    numeroAgencia: row?.numero_agencia || "",
    perfilConta: row?.perfil_conta || "PF",
    tipoConta: row?.tipo_conta || "Conta Corrente",
    initialBalanceCents: Number(row?.initial_balance_cents ?? 0),
  };
}

function mapAnalyticsCreditCardToApp(row) {
  return {
    ...row,
    id: row?.id,
    name: row?.nome,
    emissor: row?.bank_text ?? row?.titular ?? "",
    validade: String(row?.validade ?? ""),
    diaFechamento: Number(row?.dia_fechamento ?? 1),
    diaVencimento: Number(row?.dia_vencimento ?? 10),
    limite: Number(row?.limite_total ?? 0),
    limiteDisponivel: undefined,
    contaVinculadaId: null,
    gradientFrom: row?.gradient_from ?? "#220055",
    gradientTo: row?.gradient_to ?? "#4600ac",
    categoria: row?.categoria ?? "",
    perfil: getCreditCardProfileId(row),
    createdAt: row?.created_at ?? "",
    updatedAt: row?.updated_at ?? "",
  };
}

function getAnalyticsCardClosingDay(card) {
  return Number(card?.diaFechamento ?? card?.dia_fechamento ?? 1);
}

function getAnalyticsCardDueDay(card) {
  return Number(card?.diaVencimento ?? card?.dia_vencimento ?? 1);
}

function getAnalyticsProfileFromTransaction(transaction, accountsById) {
  const ids = [
    transaction?.profileId,
    transaction?.contaId,
    transaction?.qualConta,
    transaction?.conta?.id,
    transaction?.profile?.id,
  ]
    .map((id) => String(id ?? "").trim())
    .filter(Boolean);

  if (!ids.length) return null;

  const account = ids
    .map((id) => accountsById.get(id))
    .find(Boolean);
  const profile = String(
    account?.perfilConta ?? account?.perfil_conta ?? account?.perfil ?? ""
  )
    .trim()
    .toUpperCase();

  return profile === "PF" || profile === "PJ" ? profile : null;
}

function getAnalyticsCardMonthFromDate(dateIso, closingDay, dueDay) {
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  const day = date.getDate();
  const closing = Math.max(1, Math.min(31, Number(closingDay ?? 1)));
  const due = Math.max(1, Math.min(31, Number(dueDay ?? 1)));
  const effectiveClosing = Math.min(
    closing,
    new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  );
  const invoiceOffset = due > closing ? 0 : 1;
  const base = new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);

  if (day > effectiveClosing) {
    base.setMonth(base.getMonth() + 1);
  }

  base.setMonth(base.getMonth() + invoiceOffset);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

function buildAnalyticsCategoryRows(grouped, limit) {
  const allEntries = Array.from(grouped.entries())
    .map(([category, data]) => ({
      category,
      amount: roundMoney(data.amount),
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category));
  const total = allEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  return allEntries
    .slice(0, limit)
    .map((entry) => ({
      ...entry,
      percentage: total > 0 ? Number(((entry.amount / total) * 100).toFixed(1)) : 0,
    }));
}

function addAnalyticsGroupValue(grouped, category, amount) {
  const current = grouped.get(category) ?? { amount: 0, count: 0 };
  current.amount += Math.abs(Number(amount || 0));
  current.count += 1;
  grouped.set(category, current);
}

function buildAnalyticsChart(title, data) {
  return {
    chart_type: "donut",
    title,
    data: data.map((item) => ({
      label: item.category,
      value: item.amount,
    })),
  };
}

function buildAnalyticsSuggestedMessages({
  source,
  period,
  generalRows,
  creditCardRows,
}) {
  const label = formatProjectionPeriodLabel(period).toLowerCase();
  const topGeneral = generalRows[0] ?? null;
  const topCredit = creditCardRows[0] ?? null;

  if (!topGeneral && !topCredit) {
    return ["Não encontrei gastos para esse período e escopo."];
  }

  if (source === "general") {
    return topGeneral
      ? [
          `Na fonte Geral, sua maior categoria de gastos em ${label} foi ${topGeneral.category}, com ${formatMoneyPtBr(
            topGeneral.amount
          )}.`,
        ]
      : ["Não encontrei gastos na fonte Geral para esse período e escopo."];
  }

  if (source === "credit_cards") {
    return topCredit
      ? [
          `Nos cartões, sua maior categoria de gastos em ${label} foi ${topCredit.category}, com ${formatMoneyPtBr(
            topCredit.amount
          )}.`,
        ]
      : ["Não encontrei gastos de cartão para esse período e escopo."];
  }

  const messages = [];
  if (topGeneral) {
    messages.push(
      `Na fonte Geral, a maior categoria em ${label} foi ${topGeneral.category}, com ${formatMoneyPtBr(
        topGeneral.amount
      )}.`
    );
  }
  if (topCredit) {
    messages.push(
      `Nos cartões, a maior categoria em ${label} foi ${topCredit.category}, com ${formatMoneyPtBr(
        topCredit.amount
      )}.`
    );
  }
  return messages;
}

function sameAccountId(left, right) {
  return String(left ?? "").trim() === String(right ?? "").trim();
}

async function resolveGetUser(supabase, req) {
  const whatsappPhone = requireString(
    req.query?.whatsapp_phone,
    "WHATSAPP_PHONE_REQUIRED",
    "whatsapp_phone query parameter is required."
  );
  return resolveWhatsappUser(supabase, whatsappPhone);
}

async function requireOwnedCreditCard(supabase, userId, creditCardId) {
  const cleanCreditCardId = String(creditCardId ?? "").trim();

  if (!cleanCreditCardId) {
    throw new ApiError(
      400,
      "CREDIT_CARD_ID_REQUIRED",
      "credit_card_id is required."
    );
  }

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
    throw new ApiError(
      400,
      "CREDIT_CARD_INACTIVE",
      "credit_card_id is inactive."
    );
  }

  return data;
}

async function validateCreditCardTagIfProvided({ supabase, userId, tag }) {
  const cleanTag = String(tag ?? "").trim();
  if (!cleanTag) return "";

  const normalizedName = normalizeCatalogName(cleanTag);

  const { data, error } = await supabase
    .from("user_tags")
    .select("id, nome, normalized_name")
    .eq("user_id", userId)
    .eq("normalized_name", normalizedName)
    .limit(1);

  if (error) throw error;

  const found = data?.[0] ?? null;
  if (!found) {
    throw new ApiError(
      400,
      "TAG_NOT_FOUND",
      "tag does not exist for this user."
    );
  }

  return found.nome || cleanTag;
}

function normalizeTransactionListSource(value) {
  const raw = normalizeText(value);
  if (!raw || ["all", "todos", "todas"].includes(raw)) return "all";
  if (
    ["accounts", "account", "general", "geral", "contas", "conta"].includes(raw)
  ) {
    return "accounts";
  }
  if (
    [
      "credit_cards",
      "credit_card",
      "cards",
      "card",
      "cartoes",
      "cartao",
    ].includes(raw)
  ) {
    return "credit_cards";
  }

  throw new ApiError(
    400,
    "TRANSACTION_SOURCE_INVALID",
    "source must be accounts, credit_cards, or all."
  );
}

function normalizeTransactionListType(value) {
  const raw = normalizeText(value);
  if (!raw || ["all", "todos", "todas"].includes(raw)) return "all";
  if (raw === "receita" || raw === "receitas") return "receita";
  if (raw === "despesa" || raw === "despesas") return "despesa";
  if (
    ["transferencia", "transferencias", "transfer", "transfers"].includes(raw)
  ) {
    return "transferencia";
  }
  if (
    [
      "cartao_credito",
      "cartao",
      "cartoes",
      "credit_card",
      "credit_cards",
    ].includes(raw)
  ) {
    return "cartao_credito";
  }

  throw new ApiError(
    400,
    "TRANSACTION_TYPE_FILTER_INVALID",
    "type must be receita, despesa, transferencia, cartao_credito, or all."
  );
}

function normalizeTransactionListStatus(value) {
  const raw = normalizeText(value);
  if (!raw || ["all", "todos", "todas"].includes(raw)) return "all";
  if (["paid", "pago", "paga", "recebido", "recebida"].includes(raw)) {
    return "paid";
  }
  if (["pending", "pendente", "pendentes"].includes(raw)) return "pending";
  if (["overdue", "atrasado", "atrasada", "atrasados", "atrasadas"].includes(raw)) {
    return "overdue";
  }
  if (["due_today", "hoje", "vence_hoje", "vencendo_hoje"].includes(raw)) {
    return "due_today";
  }
  if (["future", "futuro", "futura", "futuros", "futuras"].includes(raw)) {
    return "future";
  }

  throw new ApiError(
    400,
    "TRANSACTION_STATUS_FILTER_INVALID",
    "status must be paid, pending, overdue, due_today, future, or all."
  );
}

function normalizeTransactionListSpendingType(value) {
  const raw = normalizeText(value);
  if (!raw || ["all", "todos", "todas"].includes(raw)) return "all";
  if (["variavel", "variable"].includes(raw)) return "variavel";
  if (["fixo", "fixed", "recorrente"].includes(raw)) return "fixo";
  if (["parcelado", "installment", "installments"].includes(raw)) {
    return "parcelado";
  }
  if (["normal", "comum"].includes(raw)) return "normal";

  throw new ApiError(
    400,
    "SPENDING_TYPE_FILTER_INVALID",
    "spending_type must be variavel, fixo, parcelado, normal, or all."
  );
}

function normalizeTransactionListSort(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "date_desc";

  const allowed = new Set([
    "date_desc",
    "date_asc",
    "amount_desc",
    "amount_asc",
    "created_desc",
    "created_asc",
  ]);
  if (!allowed.has(raw)) {
    throw new ApiError(
      400,
      "TRANSACTION_SORT_INVALID",
      "sort must be date_desc, date_asc, amount_desc, amount_asc, created_desc, or created_asc."
    );
  }
  return raw;
}

function normalizeTransactionListPage(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 1;
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(400, "PAGE_INVALID", "page must be an integer greater than zero.");
  }
  return page;
}

function normalizeTransactionListLimit(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 50;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(
      400,
      "LIMIT_INVALID",
      "limit must be an integer between 1 and 100."
    );
  }
  return limit;
}

function parseOptionalTransactionBoolean(value, name) {
  if (value === undefined || String(value ?? "").trim() === "") return null;
  return parseProjectionBoolean(
    value,
    false,
    `${String(name).toUpperCase()}_INVALID`,
    name
  );
}

function normalizeOptionalTransactionDate(value, code, name) {
  if (value === undefined || String(value ?? "").trim() === "") return null;
  return parseIsoDate(value, code, name);
}

function getTransactionListStatus(row, today) {
  if (isPaidValue(row?.pago)) return "paid";
  const date = String(row?.data ?? "").trim();
  if (date < today) return "overdue";
  if (date === today) return "due_today";
  return "future";
}

function getTransactionListSpendingType(row) {
  const payload = getTransactionPayload(row);
  const totalInstallments = Number(
    payload?.totalParcelas ??
      payload?.total_installments ??
      row?.totalParcelas ??
      row?.total_installments ??
      0
  );
  if (totalInstallments > 1) return "parcelado";

  const raw = normalizeText(row?.tipoGasto ?? payload?.tipoGasto);
  if (raw === "fixo") return "fixo";
  if (raw === "variavel") return "variavel";
  if (raw === "normal") return "normal";
  return "";
}

function compareTransactionListRows(left, right, sort) {
  const leftDate = String(left?.data ?? "");
  const rightDate = String(right?.data ?? "");
  const leftAmount = Math.abs(Number(left?.valor || 0));
  const rightAmount = Math.abs(Number(right?.valor || 0));
  const leftCreated = Number(left?.criado_em || left?.created_at || 0);
  const rightCreated = Number(right?.criado_em || right?.created_at || 0);

  if (sort === "date_asc") {
    return leftDate.localeCompare(rightDate) || String(left?.id).localeCompare(String(right?.id));
  }
  if (sort === "amount_desc") {
    return rightAmount - leftAmount || rightDate.localeCompare(leftDate);
  }
  if (sort === "amount_asc") {
    return leftAmount - rightAmount || rightDate.localeCompare(leftDate);
  }
  if (sort === "created_desc") {
    return rightCreated - leftCreated || rightDate.localeCompare(leftDate);
  }
  if (sort === "created_asc") {
    return leftCreated - rightCreated || leftDate.localeCompare(rightDate);
  }
  return rightDate.localeCompare(leftDate) || String(right?.id).localeCompare(String(left?.id));
}

async function handleListTransactions(req, res, supabase) {
  requireMethod(req, "GET");
  rejectUserIdFromSupplier(req.query || {});

  const user = await resolveGetUser(supabase, req);
  const query = req.query || {};
  const today = getSaoPauloTodayIso();
  const strictFilters = parseProjectionBoolean(
    firstQueryValue(query, "strict_filters", "filtros_estritos"),
    true,
    "STRICT_FILTERS_INVALID",
    "strict_filters"
  );

  if (strictFilters) {
    requireExplicitQueryFilters(
      query,
      [
        {
          name: "profile",
          aliases: ["profile", "perfil"],
          allowed_values: ["PF", "PJ", "all"],
        },
        {
          name: "source",
          aliases: ["source", "fonte"],
          allowed_values: ["accounts", "credit_cards", "all"],
        },
      ],
      "list_transactions"
    );

    if (
      !hasQueryValue(
        query,
        "period",
        "periodo",
        "date_from",
        "data_inicio",
        "date_to",
        "data_fim"
      )
    ) {
      throw new ApiError(
        400,
        "FILTER_REQUIRED",
        "list_transactions requires period or an explicit date range.",
        {
          action: "list_transactions",
          missing_filters: ["period_or_date_range"],
          allowed_values: {
            period: "YYYY-MM",
            date_from: "YYYY-MM-DD",
            date_to: "YYYY-MM-DD",
          },
        }
      );
    }
  }

  const profile = normalizeProjectionProfile(
    firstQueryValue(query, "profile", "perfil")
  );
  const source = normalizeTransactionListSource(
    firstQueryValue(query, "source", "fonte")
  );
  const type = normalizeTransactionListType(
    firstQueryValue(query, "type", "tipo")
  );
  const status = normalizeTransactionListStatus(
    firstQueryValue(query, "status", "situacao")
  );
  const spendingType = normalizeTransactionListSpendingType(
    firstQueryValue(query, "spending_type", "tipo_gasto")
  );
  const periodValue = firstQueryValue(query, "period", "periodo");
  const period = periodValue
    ? normalizeAnalyticsPeriod(periodValue, today)
    : null;
  const dateFrom = normalizeOptionalTransactionDate(
    firstQueryValue(query, "date_from", "data_inicio"),
    "DATE_FROM_INVALID",
    "date_from"
  );
  const dateTo = normalizeOptionalTransactionDate(
    firstQueryValue(query, "date_to", "data_fim"),
    "DATE_TO_INVALID",
    "date_to"
  );
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ApiError(
      400,
      "DATE_RANGE_INVALID",
      "date_from cannot be after date_to."
    );
  }

  const accountFilter = parseProjectionIdFilters(
    query,
    "account_id",
    "account_ids",
    "ACCOUNT_FILTER_CONFLICT",
    "ACCOUNT_IDS_INVALID"
  );
  const creditCardFilter = parseProjectionIdFilters(
    query,
    "credit_card_id",
    "credit_card_ids",
    "CREDIT_CARD_FILTER_CONFLICT",
    "CREDIT_CARD_IDS_INVALID"
  );
  const category = String(firstQueryValue(query, "category", "categoria") ?? "").trim();
  const tag = String(firstQueryValue(query, "tag") ?? "").trim();
  const description = String(
    firstQueryValue(query, "description", "descricao", "q", "busca") ?? ""
  ).trim();
  const paid = parseOptionalTransactionBoolean(
    firstQueryValue(query, "paid", "pago"),
    "paid"
  );
  const includeTransfers = parseProjectionBoolean(
    firstQueryValue(query, "include_transfers", "incluir_transferencias"),
    type === "transferencia",
    "INCLUDE_TRANSFERS_INVALID",
    "include_transfers"
  );
  const page = normalizeTransactionListPage(firstQueryValue(query, "page", "pagina"));
  const limit = normalizeTransactionListLimit(firstQueryValue(query, "limit", "limite"));
  const sort = normalizeTransactionListSort(firstQueryValue(query, "sort", "ordenacao"));

  if (source === "accounts" && type === "cartao_credito") {
    throw new ApiError(
      400,
      "FILTER_CONFLICT",
      "source=accounts cannot be combined with type=cartao_credito."
    );
  }
  if (source === "credit_cards" && type === "transferencia") {
    throw new ApiError(
      400,
      "FILTER_CONFLICT",
      "source=credit_cards cannot be combined with type=transferencia."
    );
  }
  if (source === "credit_cards" && accountFilter.ids.length > 0) {
    throw new ApiError(
      400,
      "FILTER_CONFLICT",
      "source=credit_cards cannot be combined with account_id/account_ids."
    );
  }
  if (source === "accounts" && creditCardFilter.ids.length > 0) {
    throw new ApiError(
      400,
      "FILTER_CONFLICT",
      "source=accounts cannot be combined with credit_card_id/credit_card_ids."
    );
  }
  if (accountFilter.ids.length > 0 && creditCardFilter.ids.length > 0) {
    throw new ApiError(
      400,
      "FILTER_CONFLICT",
      "account_id/account_ids and credit_card_id/credit_card_ids cannot be combined."
    );
  }

  const [accountsResult, cardsResult, transactionRows] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: true }),
    fetchAllTransactionsForUser(supabase, user.user_id, {
      build: (builder) =>
        builder.order("data", { ascending: false }).order("id", { ascending: false }),
    }),
  ]);

  for (const result of [accountsResult, cardsResult]) {
    if (result.error) throw result.error;
  }

  const accounts = accountsResult.data ?? [];
  const cards = cardsResult.data ?? [];
  const accountsById = new Map(accounts.map((account) => [String(account.id), account]));
  const cardsById = new Map(cards.map((card) => [String(card.id), card]));
  const requestedAccountSet = new Set(accountFilter.ids.map((id) => String(id)));
  const requestedCardSet = new Set(creditCardFilter.ids.map((id) => String(id)));
  const profileFilter = profile === "PF" || profile === "PJ" ? profile : null;

  for (const accountId of requestedAccountSet) {
    if (!accountsById.has(accountId)) {
      throw new ApiError(
        404,
        "ACCOUNT_NOT_FOUND",
        "account_id was not found for this user."
      );
    }
  }
  for (const cardId of requestedCardSet) {
    if (!cardsById.has(cardId)) {
      throw new ApiError(
        404,
        "CREDIT_CARD_NOT_FOUND",
        "credit_card_id was not found for this user."
      );
    }
  }

  const filtered = (transactionRows ?? [])
    .filter((row) => {
      const rowType = String(row?.tipo ?? "").trim().toLowerCase();
      const isCard = rowType === "cartao_credito";
      const isTransfer = isTransferTransaction(row);
      const accountId = getProjectionTransactionAccountId(row);
      const account = accountId ? accountsById.get(accountId) : null;
      const cardId = getProjectionCreditCardId(row, cardsById);
      const card = cardId ? cardsById.get(cardId) : null;
      const rowProfile = isCard
        ? card
          ? normalizeProjectionCardProfile(card)
          : ""
        : account
        ? normalizeProjectionAccountProfile(account)
        : "";

      if (source === "accounts" && isCard) return false;
      if (source === "credit_cards" && !isCard) return false;
      if (profileFilter && rowProfile !== profileFilter) return false;
      if (
        requestedAccountSet.size > 0 &&
        (isCard || !requestedAccountSet.has(accountId))
      ) {
        return false;
      }
      if (
        requestedCardSet.size > 0 &&
        (!isCard || !requestedCardSet.has(cardId))
      ) {
        return false;
      }

      if (type === "receita" && (rowType !== "receita" || isTransfer)) return false;
      if (
        type === "despesa" &&
        (isTransfer || (rowType !== "despesa" && !isCard))
      ) {
        return false;
      }
      if (type === "transferencia" && !isTransfer) return false;
      if (type === "cartao_credito" && !isCard) return false;
      if (!includeTransfers && isTransfer) return false;

      const transactionPeriod = getProjectionTransactionPeriod(row, cardsById);
      if (period && transactionPeriod !== period) return false;
      const date = String(row?.data ?? "").trim();
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;

      if (
        category &&
        normalizeText(row?.categoria) !== normalizeText(category)
      ) {
        return false;
      }
      if (tag && normalizeText(row?.tag) !== normalizeText(tag)) return false;
      if (
        description &&
        !normalizeText(row?.descricao).includes(normalizeText(description))
      ) {
        return false;
      }
      if (paid !== null && isPaidValue(row?.pago) !== paid) return false;

      const rowStatus = getTransactionListStatus(row, today);
      if (status === "pending" && rowStatus === "paid") return false;
      if (status !== "all" && status !== "pending" && rowStatus !== status) {
        return false;
      }

      const rowSpendingType = getTransactionListSpendingType(row);
      if (spendingType !== "all" && rowSpendingType !== spendingType) {
        return false;
      }

      return true;
    })
    .sort((left, right) => compareTransactionListRows(left, right, sort));

  const totalItems = filtered.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  const offset = (page - 1) * limit;
  const pageRows = filtered.slice(offset, offset + limit);
  const totals = filtered.reduce(
    (acc, row) => {
      const rowType = String(row?.tipo ?? "").trim().toLowerCase();
      const amount = Math.abs(Number(row?.valor || 0));
      if (rowType === "receita") acc.income += amount;
      if (rowType === "despesa" || rowType === "cartao_credito") {
        acc.expenses += amount;
      }
      return acc;
    },
    { income: 0, expenses: 0 }
  );

  const transactions = pageRows.map((row) => {
    const rowType = String(row?.tipo ?? "").trim().toLowerCase();
    const isCard = rowType === "cartao_credito";
    const accountId = getProjectionTransactionAccountId(row);
    const account = accountId ? accountsById.get(accountId) : null;
    const cardId = getProjectionCreditCardId(row, cardsById);
    const card = cardId ? cardsById.get(cardId) : null;
    const payload = getTransactionPayload(row);
    const movementKind = isPfPjMovement(row)
      ? "pf_pj"
      : isTransferTransaction(row)
      ? "internal_transfer"
      : "common";

    return {
      id: row.id,
      transaction_id: row.id,
      source: isCard ? "credit_cards" : "accounts",
      type: rowType,
      movement_kind: movementKind,
      amount: Number(row?.valor || 0),
      absolute_amount: Math.abs(Number(row?.valor || 0)),
      date: row?.data || null,
      description: row?.descricao || "",
      category: row?.categoria || "",
      tag: row?.tag || "",
      paid: isPaidValue(row?.pago),
      status: getTransactionListStatus(row, today),
      spending_type: getTransactionListSpendingType(row) || null,
      account_id: accountId || null,
      account_label: account ? makeAccountLabel(account) : null,
      credit_card_id: cardId || null,
      credit_card_label: card
        ? String(card?.nome || card?.bank_text || card?.titular || "Cartão").trim()
        : null,
      profile: isCard
        ? card
          ? normalizeProjectionCardProfile(card) || null
          : null
        : account
        ? normalizeProjectionAccountProfile(account) || null
        : null,
      invoice_month: isCard
        ? getProjectionTransactionPeriod(row, cardsById) || null
        : null,
      installment: Number(payload?.parcelaAtual || 0) || null,
      total_installments: Number(payload?.totalParcelas || 0) || null,
      recurrence_id: getMovementRecurrenceId(row) || null,
      linked_movement_id: getLinkedMovementId(row) || null,
      transfer_id: getTransferId(row) || null,
    };
  });

  json(res, 200, {
    ok: true,
    action: "list_transactions",
    scope: {
      strict_filters: strictFilters,
      profile,
      source,
      type,
      period,
      date_from: dateFrom,
      date_to: dateTo,
      account_ids: accountFilter.ids,
      credit_card_ids: creditCardFilter.ids,
      category: category || null,
      tag: tag || null,
      paid,
      status,
      spending_type: spendingType,
      description: description || null,
      include_transfers: includeTransfers,
      sort,
      is_global:
        profile === "all" &&
        source === "all" &&
        accountFilter.ids.length === 0 &&
        creditCardFilter.ids.length === 0,
    },
    pagination: {
      page,
      limit,
      total_items: totalItems,
      total_pages: totalPages,
      has_next_page: totalPages > 0 && page < totalPages,
      has_previous_page: page > 1,
    },
    totals: {
      income: roundMoney(totals.income),
      expenses: roundMoney(totals.expenses),
      net: roundMoney(totals.income - totals.expenses),
    },
    transactions,
  });
}

async function handleContext(req, res, supabase) {
  requireMethod(req, "GET");
  rejectUserIdFromSupplier(req.query || {});
  const user = await resolveGetUser(supabase, req);

  const [accountsResult, cardsResult, categoriesResult, tagsResult] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, banco, name, tipo_conta, perfil_conta")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("credit_cards")
        .select("id, nome, titular, bank_text, categoria, dia_fechamento, dia_vencimento, is_active")
        .eq("user_id", user.user_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_categories")
        .select("id, profile_id, tipo, nome")
        .eq("user_id", user.user_id)
        .order("nome", { ascending: true }),
      supabase
        .from("user_tags")
        .select("id, nome")
        .eq("user_id", user.user_id)
        .order("nome", { ascending: true }),
    ]);

  for (const result of [accountsResult, cardsResult, categoriesResult, tagsResult]) {
    if (result.error) throw result.error;
  }

  json(res, 200, {
    ok: true,
    user: {
      user_id: user.user_id,
      whatsapp_phone_normalized: user.whatsapp_phone_normalized,
    },
    accounts: (accountsResult.data ?? []).map(mapAccount),
    credit_cards: (cardsResult.data ?? []).map(mapCreditCard),
    categories: (categoriesResult.data ?? []).map((row) => ({
      id: row.id,
      profile_id: String(row.profile_id ?? "").trim().toLowerCase(),
      type: row.tipo,
      name: row.nome,
    })),
    profiles: [
      { id: "pf", label: "PF" },
      { id: "pj", label: "PJ" },
    ],
    credit_card_tags: (tagsResult.data ?? []).map((row) => ({
      id: row.id,
      name: row.nome,
    })),
    rules: {
      public_contract_language: "en",
      transaction_types: ["receita", "despesa", "transferencia", "cartao_credito"],
      category_types: ["receita", "despesa"],
      read_actions: [
        "context",
        "list_transactions",
        "pending_transactions",
        "payable_invoices",
        "financial_summary",
        "financial_projection",
        "financial_analytics",
      ],
      list_transaction_sources: ["accounts", "credit_cards", "all"],
      list_transaction_statuses: [
        "paid",
        "pending",
        "overdue",
        "due_today",
        "future",
        "all",
      ],
      list_transaction_spending_types: [
        "variavel",
        "fixo",
        "parcelado",
        "normal",
        "all",
      ],
      filtered_actions_require_explicit_scope: true,
      user_id_from_supplier_body: "not_accepted",
      invoice_ref_format: "credit_card_id:YYYY-MM",
    },
  });
}

async function handlePendingTransactions(req, res, supabase) {
  requireMethod(req, "GET");
  rejectUserIdFromSupplier(req.query || {});
  const user = await resolveGetUser(supabase, req);
  const limit = parseLimit(req.query?.limit);
  const type = String(req.query?.type ?? "").trim();
  const accountId = String(req.query?.account_id ?? "").trim();
  const fromAccountId = String(req.query?.from_account_id ?? "").trim();
  const toAccountId = String(req.query?.to_account_id ?? "").trim();
  const movementKindFilter = String(req.query?.movement_kind ?? "")
    .trim()
    .toLowerCase();
  const descriptionFilter = String(req.query?.description ?? req.query?.q ?? "").trim();
  const dateFilter = String(req.query?.date ?? "").trim();
  const amountFilterRaw = String(req.query?.amount ?? "").trim();
  const amountFilter = amountFilterRaw ? Number(amountFilterRaw) : null;

  if (dateFilter) {
    parseIsoDate(dateFilter, "INVALID_DATE_FILTER", "date");
  }
  if (amountFilterRaw && (!Number.isFinite(amountFilter) || amountFilter <= 0)) {
    throw new ApiError(400, "INVALID_AMOUNT_FILTER", "amount must be greater than zero.");
  }

  const pendingRows = await fetchAllTransactionsForUser(supabase, user.user_id, {
    select:
      "id, tipo, valor, data, descricao, categoria, tag, conta_id, qual_conta, pago, payload, transfer_from_id, transfer_to_id, conta_origem_id, conta_destino_id",
    build: (query) => {
      let pendingQuery = query
        .eq("pago", false)
        .in("tipo", ["receita", "despesa"])
        .order("data", { ascending: true })
        .order("id", { ascending: true });

      if (type === "receita" || type === "despesa") {
        pendingQuery = pendingQuery.eq("tipo", type);
      }

      if (accountId) {
        pendingQuery = pendingQuery.eq("conta_id", accountId);
      }

      return pendingQuery;
    },
  });

  const filteredRows = pendingRows.filter((row) => {
    const movementKind = isPfPjMovement(row)
      ? "pf_pj"
      : isTransferTransaction(row)
      ? "internal_transfer"
      : "common";
    const descriptionNorm = normalizeText(row?.descricao);
    const filterNorm = normalizeText(descriptionFilter);
    const { fromAccountId: movementFrom, toAccountId: movementTo } =
      getMovementAccountIds(row);

    if (movementKindFilter && movementKind !== movementKindFilter) return false;
    if (fromAccountId && movementFrom !== fromAccountId) return false;
    if (toAccountId && movementTo !== toAccountId) return false;
    if (dateFilter && String(row?.data ?? "") !== dateFilter) return false;
    if (amountFilter != null && toCents(Math.abs(Number(row?.valor || 0))) !== toCents(amountFilter)) {
      return false;
    }
    if (filterNorm && !descriptionNorm.includes(filterNorm)) return false;

    return true;
  });

  const data = filteredRows.slice(0, limit);

  const accountIds = Array.from(
    new Set(
      data
        .map((row) => String(row.conta_id || row.qual_conta || "").trim())
        .filter(Boolean)
    )
  );

  let accountsById = new Map();
  if (accountIds.length > 0) {
    const { data: accountsData, error: accountsError } = await supabase
      .from("accounts")
      .select("id, name, banco, perfil_conta")
      .eq("user_id", user.user_id)
      .in("id", accountIds);

    if (accountsError) throw accountsError;

    accountsById = new Map(
      (accountsData ?? []).map((account) => [String(account.id), account])
    );
  }

  const getPendingStatus = (date) => {
    const cleanDate = String(date ?? "").trim();
    const today = todayIso();
    if (cleanDate < today) return "overdue";
    if (cleanDate === today) return "due_today";
    return "future";
  };

  json(res, 200, {
    ok: true,
    transactions: data.map((row) => ({
      ...(() => {
        const accountId = String(row.conta_id || row.qual_conta || "").trim();
        const account = accountId ? accountsById.get(accountId) : null;
        const amount = Number(row.valor || 0);
        const absoluteAmount = Math.abs(amount);
        const type = row.tipo;
        const description = row.descricao || "";
        const accountLabel = account
          ? String(account.name || account.banco || "Conta").trim()
          : "";
        const profile = account
          ? String(account.perfil_conta || "").trim().toUpperCase()
          : "";
        const actionText = type === "receita" ? "recebida" : "paga";
        const typeText = type === "receita" ? "receita" : "despesa";
        const movementKind = isPfPjMovement(row)
          ? "pf_pj"
          : isTransferTransaction(row)
          ? "internal_transfer"
          : "common";
        const linkedMovementId = getLinkedMovementId(row);
        const transferId = getTransferId(row);
        const movementAccounts = getMovementAccountIds(row);
        const recurrenceId = getMovementRecurrenceId(row);
        const linkedGroupId =
          movementKind === "pf_pj"
            ? linkedMovementId
            : movementKind === "internal_transfer"
            ? transferId
            : "";
        const linkedLegsCount = data.filter(
          (item) =>
            buildMovementGroupKey(item) === buildMovementGroupKey(row) &&
            buildMovementGroupKey(item).startsWith("pfpj:")
        ).length;

        return {
          id: row.id,
          transaction_id: row.id,
          type,
          amount,
          absolute_amount: absoluteAmount,
          date: row.data,
          description,
          category: row.categoria || "",
          tag: row.tag || "",
          account_id: accountId || null,
          account_label: accountLabel || null,
          profile: profile || null,
          status: getPendingStatus(row.data),
          movement_kind: movementKind,
          linked_movement_id: linkedMovementId || null,
          transfer_id: transferId || null,
          linked_group_id: linkedGroupId || null,
          from_account_id: movementAccounts.fromAccountId || null,
          to_account_id: movementAccounts.toAccountId || null,
          recurrence_id: recurrenceId || null,
          settle_affects_linked_legs:
            movementKind === "pf_pj" || movementKind === "internal_transfer",
          linked_legs_count:
            movementKind === "pf_pj" ? Math.max(1, linkedLegsCount) : null,
          settle_confirmation_message: `Confirma marcar a ${typeText} ${description || "lançamento"} de ${formatMoneyPtBr(
            absoluteAmount
          )} como ${actionText}?`,
          paid: Boolean(row.pago),
        };
      })(),
    })),
  });
}

async function handleResolveTransaction(req, res, supabase) {
  requireMethod(req, "POST");
  const body = await parseJson(req);
  rejectUserIdFromSupplier(body);

  const whatsappPhone = requireString(
    body.whatsapp_phone,
    "WHATSAPP_PHONE_REQUIRED",
    "whatsapp_phone is required."
  );
  const description = requireString(
    body.description,
    "DESCRIPTION_REQUIRED",
    "description is required."
  );

  const amount =
    body.amount === undefined || String(body.amount ?? "").trim() === ""
      ? null
      : parsePositiveAmount(body.amount);
  const date =
    body.date === undefined || String(body.date ?? "").trim() === ""
      ? ""
      : parseIsoDate(body.date, "INVALID_DATE_FILTER", "date");
  const type =
    body.type === undefined || String(body.type ?? "").trim() === ""
      ? ""
      : normalizeTransactionType(body.type);
  const profileId =
    body.profile_id === undefined || String(body.profile_id ?? "").trim() === ""
      ? ""
      : normalizeProfileId(body.profile_id);

  const user = await resolveWhatsappUser(supabase, whatsappPhone);
  const pendingRows = await fetchAllTransactionsForUser(supabase, user.user_id, {
    select:
      "id, tipo, valor, data, descricao, categoria, conta_id, qual_conta, pago, payload, transfer_from_id, transfer_to_id, conta_origem_id, conta_destino_id",
    build: (query) => {
      let pendingQuery = query
        .eq("pago", false)
        .in("tipo", ["receita", "despesa"])
        .order("data", { ascending: true })
        .order("id", { ascending: true });

      if (type) {
        pendingQuery = pendingQuery.eq("tipo", type);
      }

      if (date) {
        pendingQuery = pendingQuery.eq("data", date);
      }

      return pendingQuery;
    },
  });

  const accountIds = Array.from(
    new Set(
      pendingRows
        .map((row) => String(row?.conta_id ?? row?.qual_conta ?? "").trim())
        .filter(Boolean)
    )
  );

  let accounts = [];
  if (accountIds.length > 0) {
    const { data: accountRows, error: accountsError } = await supabase
      .from("accounts")
      .select("id, name, banco, tipo_conta, perfil_conta")
      .eq("user_id", user.user_id)
      .in("id", accountIds);

    if (accountsError) throw accountsError;
    accounts = accountRows ?? [];
  }

  const resolution = resolvePendingTransaction({
    rows: pendingRows,
    accounts,
    description,
    amount,
    date,
    type,
    profileId,
  });

  if (resolution.status === "not_found") {
    throw new ApiError(
      404,
      "TRANSACTION_NOT_FOUND",
      "Nenhum lançamento pendente correspondente foi encontrado."
    );
  }

  if (resolution.status === "multiple_matches") {
    return json(res, 200, {
      ok: true,
      status: "multiple_matches",
      selection_required: true,
      message:
        "Encontrei mais de um lançamento pendente. Qual deles você deseja baixar?",
      match_strategy: resolution.match_strategy,
      matches: resolution.candidates,
    });
  }

  return json(res, 200, {
    ok: true,
    status: "selected",
    selection_required: false,
    match_strategy: resolution.match_strategy,
    selected_transaction: resolution.selected_transaction,
  });
}


async function getCreditInvoiceSummaries(
  supabase,
  userId,
  { creditCardId, cicloKey } = {}
) {
  const [cardsResult, transactionRows, paymentsResult, manualStatusResult] =
    await Promise.all([
      (() => {
        let query = supabase.from("credit_cards").select("*").eq("user_id", userId);
        if (creditCardId) query = query.eq("id", creditCardId);
        return query;
      })(),
      fetchAllTransactionsForUser(supabase, userId, {
        select:
          "id, tipo, valor, data, descricao, categoria, cartao_id, qual_conta, pago, payload",
        build: (query) =>
          query
            .eq("tipo", "cartao_credito")
            .order("data", { ascending: true })
            .order("id", { ascending: true }),
      }),
      (() => {
        let query = supabase
          .from("invoice_payments")
          .select("credit_card_id, ciclo_key, amount")
          .eq("user_id", userId);
        if (creditCardId) query = query.eq("credit_card_id", creditCardId);
        if (cicloKey) query = query.eq("ciclo_key", cicloKey);
        return query;
      })(),
      (() => {
        let query = supabase
          .from("invoice_manual_status")
          .select("cartao_id, ciclo_key, status_manual")
          .eq("user_id", userId);
        if (creditCardId) query = query.eq("cartao_id", creditCardId);
        if (cicloKey) query = query.eq("ciclo_key", cicloKey);
        return query;
      })(),
    ]);

  for (const result of [
    cardsResult,
    paymentsResult,
    manualStatusResult,
  ]) {
    if (result.error) throw result.error;
  }

  const cardsById = new Map(
    (cardsResult.data ?? []).map((card) => [String(card.id), card])
  );
  const manualStatusByRef = new Map(
    (manualStatusResult.data ?? []).map((row) => [
      `${row.cartao_id}:${row.ciclo_key}`,
      String(row?.status_manual ?? ""),
    ])
  );
  const paymentTotals = new Map();

  for (const payment of paymentsResult.data ?? []) {
    const ref = `${payment.credit_card_id}:${payment.ciclo_key}`;
    paymentTotals.set(ref, (paymentTotals.get(ref) || 0) + Number(payment.amount || 0));
  }

  const invoices = new Map();

  for (const tx of transactionRows) {
    const cardId = getCreditTransactionCardId(tx);
    if (creditCardId && cardId !== String(creditCardId)) continue;
    const card = cardsById.get(cardId);
    if (!card || card.is_active === false) continue;

    const invoiceMonth = getCreditInvoiceMonth(
      tx.data,
      card.dia_fechamento,
      card.dia_vencimento
    );
    if (!invoiceMonth) continue;

    const cycle = getCreditInvoiceCycle(
      cardId,
      invoiceMonth,
      card.dia_fechamento,
      card.dia_vencimento
    );
    if (!cycle?.ciclo_key) continue;
    if (cicloKey && cycle.ciclo_key !== String(cicloKey)) continue;

    const invoiceRef = `${cardId}:${invoiceMonth}`;
    const current = invoices.get(cycle.ciclo_key) ?? {
      invoice_ref: invoiceRef,
      ciclo_key: cycle.ciclo_key,
      cycle_start: cycle.cycle_start,
      cycle_end: cycle.cycle_end,
      credit_card_id: cardId,
      credit_card_name: card.nome || "",
      credit_card_profile: getCreditCardProfileId(card).toUpperCase(),
      invoice_month: invoiceMonth,
      due_date: cycle.due_date,
      account_id: null,
      account_label: null,
      amount: 0,
      transaction_count: 0,
      cycle_start_date: cycle.cycle_start_date,
      cycle_end_date: cycle.cycle_end_date,
      due_date_obj: cycle.due_date_obj,
    };

    current.amount += Math.abs(Number(tx.valor || 0));
    current.transaction_count += 1;
    invoices.set(cycle.ciclo_key, current);
  }

  const today = new Date(`${todayIso()}T00:00:00`);
  return Array.from(invoices.values())
    .filter((invoice) => invoice.amount > 0)
    .map((invoice) => {
      const statusRef = `${invoice.credit_card_id}:${invoice.ciclo_key}`;
      const paidAmount = roundMoney(Number(paymentTotals.get(statusRef) || 0));
      const remainingAmount = roundMoney(Math.max(0, invoice.amount - paidAmount));
      const status = getCreditInvoiceStatusForApi({
        amount: invoice.amount,
        remainingAmount,
        today,
        cycleStart: invoice.cycle_start_date,
        cycleEnd: invoice.cycle_end_date,
        dueDate: invoice.due_date_obj,
        manualStatus: manualStatusByRef.get(statusRef),
      });
      const guidance = buildInvoicePaymentGuidance(status, remainingAmount);
      const {
        cycle_start_date,
        cycle_end_date,
        due_date_obj,
        ...publicInvoice
      } = invoice;

      return {
        ...publicInvoice,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        status,
        ...guidance,
      };
    });
}

async function handlePayableInvoices(req, res, supabase) {
  requireMethod(req, "GET");
  rejectUserIdFromSupplier(req.query || {});
  const user = await resolveGetUser(supabase, req);

  const payable = (await getCreditInvoiceSummaries(supabase, user.user_id))
    .filter((invoice) => {
      if (invoice.remaining_amount <= 0) return false;
      if (invoice.status === "PAGA" || invoice.status === "ZERADA") return false;
      return true;
    })
    .sort((a, b) =>
      String(a.due_date).localeCompare(String(b.due_date)) ||
      String(a.credit_card_name).localeCompare(String(b.credit_card_name))
    );

  json(res, 200, {
    ok: true,
    representation: {
      invoice_id_available: false,
      invoice_ref_format: "credit_card_id:YYYY-MM",
    },
    invoices: payable,
  });
}

async function handleFinancialSummary(req, res, supabase) {
  requireMethod(req, "GET");
  rejectUserIdFromSupplier(req.query || {});

  const user = await resolveGetUser(supabase, req);
  const today = getSaoPauloTodayIso();
  const period = normalizeSummaryPeriod(req.query?.period, today);
  const profileFilter = normalizeSummaryProfile(req.query?.profile);
  const accountFilter = parseSummaryAccountFilters(req.query || {});
  const upcomingLimit = addDaysIso(today, 7);

  const [accountsResult, transactionRows, invoiceSummaries] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, banco, name, perfil_conta, initial_balance_cents")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: true }),
    fetchAllTransactionsForUser(supabase, user.user_id, {
      select:
        "id, tipo, valor, data, descricao, categoria, tag, conta_id, qual_conta, pago, payload, transfer_from_id, transfer_to_id",
      build: (query) =>
        query.order("data", { ascending: true }).order("id", { ascending: true }),
    }),
    getCreditInvoiceSummaries(supabase, user.user_id),
  ]);

  for (const result of [accountsResult]) {
    if (result.error) throw result.error;
  }

  const accounts = accountsResult.data ?? [];
  const transactions = transactionRows;
  const accountsById = new Map(accounts.map((account) => [String(account.id), account]));
  const requestedAccountIds = accountFilter.account_ids;

  for (const accountId of requestedAccountIds) {
    if (!accountsById.has(String(accountId))) {
      throw new ApiError(
        404,
        "ACCOUNT_NOT_FOUND",
        "account_id was not found for this user."
      );
    }
  }

  const hasAccountFilter = requestedAccountIds.length > 0;
  const baseAccounts = hasAccountFilter
    ? requestedAccountIds.map((id) => accountsById.get(String(id))).filter(Boolean)
    : accounts;
  const selectedAccounts = profileFilter
    ? baseAccounts.filter((account) => makeProfileLabel(account) === profileFilter)
    : baseAccounts;
  const selectedAccountIds = new Set(
    selectedAccounts.map((account) => String(account.id))
  );
  const isGlobalScope = !profileFilter && !hasAccountFilter;
  const accountLabels = selectedAccounts.map((account) => makeAccountLabel(account));
  const transactionBelongsToScope = (transaction) => {
    if (isGlobalScope) return true;
    const accountId = getTransactionAccountId(transaction);
    return Boolean(accountId && selectedAccountIds.has(accountId));
  };
  const scopedTransactions = transactions.filter(transactionBelongsToScope);
  const balancesByAccount = new Map();

  for (const account of selectedAccounts) {
    balancesByAccount.set(
      String(account.id),
      Number(account.initial_balance_cents || 0) / 100
    );
  }

  let totalCashBalance = selectedAccounts.reduce(
    (sum, account) => sum + Number(account.initial_balance_cents || 0) / 100,
    0
  );

  for (const transaction of scopedTransactions) {
    if (!isPaidValue(transaction.pago)) continue;

    const signedAmount = signedBankAmount(transaction);
    if (!signedAmount) continue;

    const accountId = getTransactionAccountId(transaction);
    if (accountId && balancesByAccount.has(accountId)) {
      totalCashBalance += signedAmount;
      balancesByAccount.set(
        accountId,
        Number(balancesByAccount.get(accountId) || 0) + signedAmount
      );
    }
  }

  const balanceAccounts = selectedAccounts.map((account) => ({
    account_id: account.id,
    account_label: makeAccountLabel(account),
    profile: makeProfileLabel(account) || null,
    balance: roundMoney(balancesByAccount.get(String(account.id)) || 0),
  }));

  let received = 0;
  let paidExpenses = 0;
  let pendingReceivables = 0;
  let pendingExpenses = 0;
  let transactionsCount = 0;

  const monthPendingExpenses = [];
  const monthPendingReceivables = [];
  const overdueItems = [];
  const dueTodayItems = [];
  const upcomingItems = [];

  for (const transaction of scopedTransactions) {
    const type = String(transaction?.tipo ?? "").trim().toLowerCase();
    if (type !== "receita" && type !== "despesa") continue;
    if (isTransferTransaction(transaction)) continue;

    const date = String(transaction?.data ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const paid = isPaidValue(transaction.pago);
    const amountAbs = Math.abs(Number(transaction.valor || 0));
    const isInPeriod = date.slice(0, 7) === period;

    if (isInPeriod) {
      transactionsCount += 1;
      if (type === "receita") {
        if (paid) received += amountAbs;
        else {
          pendingReceivables += amountAbs;
          monthPendingReceivables.push(transaction);
        }
      }

      if (type === "despesa") {
        if (paid) paidExpenses += amountAbs;
        else {
          pendingExpenses += amountAbs;
          monthPendingExpenses.push(transaction);
        }
      }
    }

    if (!paid) {
      if (date < today) {
        overdueItems.push(
          mapSummaryTransactionItem(transaction, accountsById, "overdue")
        );
      } else if (date === today) {
        dueTodayItems.push(
          mapSummaryTransactionItem(transaction, accountsById, "due_today")
        );
      } else if (date <= upcomingLimit) {
        upcomingItems.push(
          mapSummaryTransactionItem(transaction, accountsById, "future")
        );
      }
    }
  }

  const invoiceScopeNotes = [];
  if (hasAccountFilter) {
    invoiceScopeNotes.push(
      "credit_card_summary is not filtered by account_id because credit cards do not have a reliable bank account link."
    );
  }

  const scopedInvoiceSummaries = (invoiceSummaries ?? []).filter((invoice) => {
    if (!profileFilter) return true;
    return String(invoice.credit_card_profile ?? "").trim().toUpperCase() === profileFilter;
  });

  const invoicesWithPending = scopedInvoiceSummaries.filter(
    (invoice) =>
      Number(invoice.remaining_amount || 0) > 0 &&
      invoice.status !== "PAGA" &&
      invoice.status !== "ZERADA"
  );

  const invoiceItems = invoicesWithPending
    .map((invoice) => ({
      invoice_ref: invoice.invoice_ref,
      ciclo_key: invoice.ciclo_key,
      credit_card_id: invoice.credit_card_id,
      credit_card_name: invoice.credit_card_name,
      credit_card_profile: invoice.credit_card_profile || null,
      due_date: invoice.due_date,
      amount: roundMoney(invoice.amount),
      paid_amount: roundMoney(invoice.paid_amount),
      remaining_amount: roundMoney(invoice.remaining_amount),
      status: invoice.status,
      can_pay_via_api: Boolean(invoice.can_pay_via_api),
      payment_message: invoice.payment_message,
    }))
    .sort((a, b) =>
      String(a.due_date).localeCompare(String(b.due_date)) ||
      String(a.credit_card_name).localeCompare(String(b.credit_card_name))
    );

  let creditCardOpenTotal = 0;
  let creditCardAwaitingTotal = 0;
  let creditCardOverdueTotal = 0;

  for (const invoice of invoicesWithPending) {
    const remaining = Number(invoice.remaining_amount || 0);

    if (invoice.status === "ATRASADA") {
      creditCardOverdueTotal += remaining;
      overdueItems.push(mapSummaryInvoiceItem(invoice));
      continue;
    }

    if (invoice.status === "FECHADA") {
      creditCardAwaitingTotal += remaining;
    } else if (invoice.status === "EM_ABERTO" || invoice.status === "FUTURA") {
      creditCardOpenTotal += remaining;
    }

    if (String(invoice.due_date) === today) {
      dueTodayItems.push(mapSummaryInvoiceItem(invoice));
    } else if (String(invoice.due_date) > today && String(invoice.due_date) <= upcomingLimit) {
      upcomingItems.push(mapSummaryInvoiceItem(invoice));
    }
  }

  const overdueExpenseTotal = overdueItems
    .filter((item) => item.kind === "transaction" && item.type === "despesa")
    .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
  const overdueReceivableTotal = overdueItems
    .filter((item) => item.kind === "transaction" && item.type === "receita")
    .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
  const dueTodayExpenseTotal = dueTodayItems
    .filter((item) => item.kind === "transaction" && item.type === "despesa")
    .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
  const dueTodayReceivableTotal = dueTodayItems
    .filter((item) => item.kind === "transaction" && item.type === "receita")
    .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
  const dueTodayInvoiceTotal = dueTodayItems
    .filter((item) => item.kind === "credit_card_invoice")
    .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
  const upcomingTotal = upcomingItems.reduce(
    (sum, item) => sum + Math.abs(Number(item.amount || 0)),
    0
  );

  const payableInvoicesCount = invoicesWithPending.filter((invoice) =>
    Boolean(invoice.can_pay_via_api)
  ).length;
  const dashboardCurrentBalance = received - paidExpenses;
  const scopeLabel =
    accountLabels.length === 1
      ? accountLabels[0]
      : accountLabels.length > 1
      ? accountLabels.join(", ")
      : profileFilter
      ? profileFilter
      : "contas consultadas";

  const response = {
    ok: true,
    user: {
      user_id: user.user_id,
      whatsapp_phone_normalized: user.whatsapp_phone_normalized,
    },
    period: {
      month: period,
      today,
      timezone: "America/Sao_Paulo",
    },
    scope: {
      period,
      profile: profileFilter || "all",
      account_id: accountFilter.account_id,
      account_ids: requestedAccountIds,
      account_labels: accountLabels,
      account_label: accountLabels.length === 1 ? accountLabels[0] : null,
      is_global: isGlobalScope,
      notes: invoiceScopeNotes,
    },
    dashboard_summary: {
      current_balance: roundMoney(dashboardCurrentBalance),
      received: roundMoney(received),
      paid_expenses: roundMoney(paidExpenses),
      pending_receivables: roundMoney(pendingReceivables),
      pending_expenses: roundMoney(pendingExpenses),
    },
    balances: {
      total_balance: roundMoney(totalCashBalance),
      total_cash_balance: roundMoney(totalCashBalance),
      accounts: balanceAccounts,
    },
    monthly_totals: {
      received: roundMoney(received),
      paid_expenses: roundMoney(paidExpenses),
      net: roundMoney(dashboardCurrentBalance),
      pending_receivables: roundMoney(pendingReceivables),
      pending_expenses: roundMoney(pendingExpenses),
      transactions_count: transactionsCount,
    },
    pending_summary: {
      expenses_total: roundMoney(pendingExpenses),
      receivables_total: roundMoney(pendingReceivables),
      count: monthPendingExpenses.length + monthPendingReceivables.length,
    },
    overdue_summary: {
      expenses_total: roundMoney(overdueExpenseTotal),
      receivables_total: roundMoney(overdueReceivableTotal),
      credit_card_invoices_total: roundMoney(creditCardOverdueTotal),
      count: overdueItems.length,
      items: overdueItems.sort((a, b) =>
        String(a.due_date || a.date).localeCompare(String(b.due_date || b.date))
      ),
    },
    due_today: {
      expenses_total: roundMoney(dueTodayExpenseTotal),
      receivables_total: roundMoney(dueTodayReceivableTotal),
      credit_card_invoices_total: roundMoney(dueTodayInvoiceTotal),
      items: dueTodayItems.sort((a, b) =>
        String(a.description || a.name || "").localeCompare(
          String(b.description || b.name || "")
        )
      ),
    },
    upcoming: {
      days: 7,
      total: roundMoney(upcomingTotal),
      items: upcomingItems.sort((a, b) =>
        String(a.due_date || a.date).localeCompare(String(b.due_date || b.date))
      ),
    },
    credit_card_summary: {
      open_total: roundMoney(creditCardOpenTotal),
      awaiting_payment_total: roundMoney(creditCardAwaitingTotal),
      overdue_total: roundMoney(creditCardOverdueTotal),
      payable_invoices_count: payableInvoicesCount,
      scope_notes: invoiceScopeNotes,
      invoices: invoiceItems,
    },
    suggested_messages_for_nimble: [
      hasAccountFilter && accountLabels.length === 1
        ? `No ${scopeLabel}, seu saldo líquido do mês é ${formatMoneyPtBr(
            dashboardCurrentBalance
          )}.`
        : `No mês, seu saldo líquido é ${formatMoneyPtBr(dashboardCurrentBalance)}.`,
      `Nas contas consultadas, seu saldo bancário estimado é ${formatMoneyPtBr(
        totalCashBalance
      )}.`,
      `Você já recebeu ${formatMoneyPtBr(received)} e pagou ${formatMoneyPtBr(
        paidExpenses
      )} em despesas no mês.`,
      `Você tem ${formatMoneyPtBr(pendingExpenses)} em despesas pendentes no mês.`,
      `Há ${formatMoneyPtBr(overdueReceivableTotal)} em receitas atrasadas.`,
      `Há ${payableInvoicesCount} fatura(s) aguardando pagamento pela API.`,
    ],
  };

  json(res, 200, response);
}

async function handleFinancialProjection(req, res, supabase) {
  requireMethod(req, "GET");
  rejectUserIdFromSupplier(req.query || {});

  const user = await resolveGetUser(supabase, req);
  const strictFilters = parseProjectionBoolean(
    firstQueryValue(req.query, "strict_filters", "filtros_estritos"),
    true,
    "STRICT_FILTERS_INVALID",
    "strict_filters"
  );
  if (strictFilters) {
    requireExplicitQueryFilters(
      req.query || {},
      [
        {
          name: "profile",
          aliases: ["profile", "perfil"],
          allowed_values: ["PF", "PJ", "all"],
        },
        {
          name: "months",
          aliases: ["months", "meses"],
          allowed_values: ["1..24"],
        },
      ],
      "financial_projection"
    );
  }

  const today = getSaoPauloTodayIso();
  const months = normalizeProjectionMonths(
    firstQueryValue(req.query, "months", "meses")
  );
  const startPeriod = normalizeProjectionStartPeriod(
    firstQueryValue(req.query, "start_period", "periodo_inicial"),
    today
  );
  const mode = normalizeProjectionMode(
    firstQueryValue(req.query, "mode", "modo")
  );
  const profile = normalizeProjectionProfile(
    firstQueryValue(req.query, "profile", "perfil")
  );
  const accountFilter = parseProjectionIdFilters(
    req.query || {},
    "account_id",
    "account_ids",
    "ACCOUNT_FILTER_CONFLICT",
    "ACCOUNT_IDS_INVALID"
  );
  const creditCardFilter = parseProjectionIdFilters(
    req.query || {},
    "credit_card_id",
    "credit_card_ids",
    "CREDIT_CARD_FILTER_CONFLICT",
    "CREDIT_CARD_IDS_INVALID"
  );
  const includeCreditCards = parseProjectionBoolean(
    firstQueryValue(req.query, "include_credit_cards", "incluir_cartoes"),
    true,
    "INCLUDE_CREDIT_CARDS_INVALID",
    "include_credit_cards"
  );
  const includeTransfers = parseProjectionBoolean(
    firstQueryValue(req.query, "include_transfers", "incluir_transferencias"),
    false,
    "INCLUDE_TRANSFERS_INVALID",
    "include_transfers"
  );

  if (includeTransfers) {
    throw new ApiError(
      400,
      "TRANSFERS_PROJECTION_NOT_SUPPORTED",
      "A projeção via API ainda não inclui transferências. Use include_transfers=false."
    );
  }

  const [accountsResult, cardsResult, transactionRows] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: true }),
    fetchAllTransactionsForUser(supabase, user.user_id, {
      build: (query) =>
        query.order("data", { ascending: true }).order("id", { ascending: true }),
    }),
  ]);

  for (const result of [accountsResult, cardsResult]) {
    if (result.error) throw result.error;
  }

  const accounts = accountsResult.data ?? [];
  const cards = cardsResult.data ?? [];
  const transactions = transactionRows;
  const accountsById = new Map(accounts.map((account) => [String(account.id), account]));
  const cardsById = new Map(cards.map((card) => [String(card.id), card]));

  for (const accountId of accountFilter.ids) {
    if (!accountsById.has(String(accountId))) {
      throw new ApiError(
        404,
        "ACCOUNT_NOT_FOUND",
        "account_id was not found for this user."
      );
    }
  }

  for (const cardId of creditCardFilter.ids) {
    if (!cardsById.has(String(cardId))) {
      throw new ApiError(
        404,
        "CREDIT_CARD_NOT_FOUND",
        "credit_card_id was not found for this user."
      );
    }
  }

  const profileFilter = profile === "PF" || profile === "PJ" ? profile : null;
  const requestedAccountSet = new Set(accountFilter.ids.map((id) => String(id)));
  const requestedCardSet = new Set(creditCardFilter.ids.map((id) => String(id)));
  const hasAccountFilter = requestedAccountSet.size > 0;
  const hasCardFilter = requestedCardSet.size > 0;

  const selectedAccounts = accounts.filter((account) => {
    const id = String(account.id);
    if (hasAccountFilter && !requestedAccountSet.has(id)) return false;
    if (profileFilter && normalizeProjectionAccountProfile(account) !== profileFilter) {
      return false;
    }
    return hasAccountFilter || profileFilter || profile === "all";
  });

  const activeCards = cards.filter((card) => card.is_active !== false);
  const selectedCards = activeCards.filter((card) => {
    const id = String(card.id);
    if (hasCardFilter && !requestedCardSet.has(id)) return false;
    if (profileFilter && normalizeProjectionCardProfile(card) !== profileFilter) {
      return false;
    }
    return hasCardFilter || profileFilter || profile === "all";
  });

  const selectedAccountIds =
    hasAccountFilter || profileFilter
      ? selectedAccounts.length
        ? selectedAccounts.map((account) => String(account.id))
        : ["__no_matching_account__"]
      : [];
  const selectedCreditCardIds =
    hasCardFilter || profileFilter
      ? selectedCards.length
        ? selectedCards.map((card) => String(card.id))
        : ["__no_matching_credit_card__"]
      : [];
  const accountLabels = selectedAccounts.map((account) => makeAccountLabel(account));
  const creditCardLabels = selectedCards.map((card) =>
    String(card.nome || card.bank_text || card.titular || "Cartão").trim()
  );
  const initialBalance = selectedAccounts.reduce(
    (sum, account) => sum + getProjectionInitialBalance(account),
    0
  );

  const projection = computeFinancialProjection({
    transactions,
    accountsById,
    cardsById,
    selectedAccountIds,
    selectedCreditCardIds,
    profile,
    includeCreditCards,
    includeTransfers,
    startPeriod,
    months,
    mode,
    initialBalance,
  });

  assertFinancialProjectionContract(projection, months);

  const totals = projection.reduce(
    (acc, row) => {
      acc.income += Number(row.income || 0);
      acc.fixed_expenses += Number(row.fixed_expenses || 0);
      acc.variable_and_card_expenses += Number(row.variable_and_card_expenses || 0);
      acc.net_result += Number(row.monthly_result || 0);
      return acc;
    },
    {
      income: 0,
      fixed_expenses: 0,
      variable_and_card_expenses: 0,
      net_result: 0,
    }
  );
  const finalProjectedBalance =
    projection.length > 0
      ? Number(projection[projection.length - 1].projected_balance || 0)
      : roundMoney(initialBalance);
  const tightestMonth = projection.reduce((lowest, row) => {
    if (!lowest) return row;
    return Number(row.projected_balance || 0) < Number(lowest.projected_balance || 0)
      ? row
      : lowest;
  }, null);
  const firstNegativeMonth =
    projection.find((row) => Number(row.projected_balance || 0) < 0) ?? null;
  const notes = [
    "initial_balance follows the projection panel semantics: initial balance of the selected accounts.",
  ];

  if (!includeCreditCards) {
    notes.push("credit card transactions were excluded by include_credit_cards=false.");
  }

  if (hasAccountFilter && !hasCardFilter && includeCreditCards) {
    notes.push(
      "credit card transactions are not filtered by account_id because credit cards do not have a reliable bank account link."
    );
  }

  const response = {
    ok: true,
    action: "financial_projection",
    user: {
      user_id: user.user_id,
      whatsapp_phone_normalized: user.whatsapp_phone_normalized,
    },
    scope: {
      period_start: startPeriod,
      months,
      mode,
      profile,
      account_ids: hasAccountFilter
        ? accountFilter.ids
        : profileFilter
        ? selectedAccounts.map((account) => String(account.id))
        : [],
      account_labels: accountLabels,
      credit_card_ids: hasCardFilter
        ? creditCardFilter.ids
        : profileFilter
        ? selectedCards.map((card) => String(card.id))
        : [],
      credit_card_labels: creditCardLabels,
      include_credit_cards: includeCreditCards,
      include_transfers: includeTransfers,
      strict_filters: strictFilters,
      is_global: !profileFilter && !hasAccountFilter && !hasCardFilter,
      notes,
    },
    initial_balance: roundMoney(initialBalance),
    projection,
    totals: {
      income: roundMoney(totals.income),
      fixed_expenses: roundMoney(totals.fixed_expenses),
      variable_and_card_expenses: roundMoney(totals.variable_and_card_expenses),
      net_result: roundMoney(totals.net_result),
      final_projected_balance: roundMoney(finalProjectedBalance),
    },
    critical_points: {
      tightest_month: tightestMonth
        ? {
            period: tightestMonth.period,
            label: tightestMonth.label,
            projected_balance: roundMoney(tightestMonth.projected_balance),
          }
        : null,
      first_negative_month: firstNegativeMonth
        ? {
            period: firstNegativeMonth.period,
            label: firstNegativeMonth.label,
            projected_balance: roundMoney(firstNegativeMonth.projected_balance),
          }
        : null,
      lowest_projected_balance: tightestMonth
        ? roundMoney(tightestMonth.projected_balance)
        : null,
    },
    suggested_messages_for_nimble: buildProjectionSuggestedMessages({
      projection,
      months,
      mode,
      profile,
      accountLabels,
      finalProjectedBalance,
      tightestMonth,
      firstNegativeMonth,
    }),
  };

  json(res, 200, response);
}

async function handleFinancialAnalytics(req, res, supabase) {
  requireMethod(req, "GET");
  rejectUserIdFromSupplier(req.query || {});

  const user = await resolveGetUser(supabase, req);
  const strictFilters = parseProjectionBoolean(
    firstQueryValue(req.query, "strict_filters", "filtros_estritos"),
    true,
    "STRICT_FILTERS_INVALID",
    "strict_filters"
  );
  if (strictFilters) {
    requireExplicitQueryFilters(
      req.query || {},
      [
        {
          name: "profile",
          aliases: ["profile", "perfil"],
          allowed_values: ["PF", "PJ", "all"],
        },
        {
          name: "source",
          aliases: ["source", "fonte"],
          allowed_values: ["general", "credit_cards", "all"],
        },
      ],
      "financial_analytics"
    );
  }

  const today = getSaoPauloTodayIso();
  const period = normalizeAnalyticsPeriod(
    firstQueryValue(req.query, "period", "periodo"),
    today
  );
  const profile = normalizeProjectionProfile(
    firstQueryValue(req.query, "profile", "perfil")
  );
  const source = normalizeAnalyticsSource(
    firstQueryValue(req.query, "source", "fonte")
  );
  const limit = normalizeAnalyticsLimit(
    firstQueryValue(req.query, "limit", "limite")
  );
  const accountFilter = parseProjectionIdFilters(
    req.query || {},
    "account_id",
    "account_ids",
    "ACCOUNT_FILTER_CONFLICT",
    "ACCOUNT_IDS_INVALID"
  );
  const creditCardFilter = parseProjectionIdFilters(
    req.query || {},
    "credit_card_id",
    "credit_card_ids",
    "CREDIT_CARD_FILTER_CONFLICT",
    "CREDIT_CARD_IDS_INVALID"
  );

  const [accountsResult, cardsResult, transactionRows] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("credit_cards")
      .select("*")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: true }),
    fetchAllTransactionsForUser(supabase, user.user_id, {
      build: (query) =>
        query.order("data", { ascending: true }).order("id", { ascending: true }),
    }),
  ]);

  for (const result of [accountsResult, cardsResult]) {
    if (result.error) throw result.error;
  }

  const accounts = (accountsResult.data ?? []).map(mapAnalyticsAccountToApp);
  const cards = (cardsResult.data ?? []).map(mapAnalyticsCreditCardToApp);
  const transactions = transactionRows.map(mapAnalyticsTransactionToApp);
  const accountsById = new Map(accounts.map((account) => [String(account.id), account]));
  const cardsById = new Map(cards.map((card) => [String(card.id), card]));

  for (const accountId of accountFilter.ids) {
    if (!accountsById.has(String(accountId))) {
      throw new ApiError(
        404,
        "ACCOUNT_NOT_FOUND",
        "account_id was not found for this user."
      );
    }
  }

  for (const cardId of creditCardFilter.ids) {
    if (!cardsById.has(String(cardId))) {
      throw new ApiError(
        404,
        "CREDIT_CARD_NOT_FOUND",
        "credit_card_id was not found for this user."
      );
    }
  }

  const profileFilter = profile === "PF" || profile === "PJ" ? profile : null;
  const requestedAccountSet = new Set(accountFilter.ids.map((id) => String(id)));
  const requestedCardSet = new Set(creditCardFilter.ids.map((id) => String(id)));
  const hasAccountFilter = requestedAccountSet.size > 0;
  const hasCardFilter = requestedCardSet.size > 0;
  const includeGeneral = source === "general" || source === "all";
  const includeCreditCards = source === "credit_cards" || source === "all";

  const selectedAccounts = accounts.filter((account) => {
    const id = String(account.id);
    if (hasAccountFilter && !requestedAccountSet.has(id)) return false;
    if (profileFilter && normalizeProjectionAccountProfile(account) !== profileFilter) {
      return false;
    }
    return hasAccountFilter || profileFilter || profile === "all";
  });
  const selectedCards = cards
    .filter((card) => card.is_active !== false)
    .filter((card) => {
      const id = String(card.id);
      if (hasCardFilter && !requestedCardSet.has(id)) return false;
      if (profileFilter && normalizeProjectionCardProfile(card) !== profileFilter) {
        return false;
      }
      return hasCardFilter || profileFilter || profile === "all";
    });
  const selectedAccountSet = new Set(selectedAccounts.map((account) => String(account.id)));
  const selectedCardSet = new Set(selectedCards.map((card) => String(card.id)));
  const generalGrouped = new Map();
  const creditCardGrouped = new Map();
  const notes = [
    "Esta versão prioriza paridade com a aba Análise atual: gastos por categoria na fonte Geral e Cartões.",
  ];

  if (includeGeneral) {
    for (const transaction of transactions) {
      const type = String(transaction?.tipo ?? "").trim().toLowerCase();
      if (type !== "despesa") continue;

      const date = String(transaction?.data ?? "").trim();
      if (!date.startsWith(period)) continue;

      const category = getAnalyticsGeneralCategory(transaction);
      if (isTransferTransaction(transaction)) continue;

      if (profileFilter) {
        const transactionProfile = getAnalyticsProfileFromTransaction(
          transaction,
          accountsById
        );
        if (transactionProfile !== profileFilter) {
          continue;
        }
      }

      const accountId = getProjectionTransactionAccountId(transaction);
      if (hasAccountFilter && (!accountId || !selectedAccountSet.has(accountId))) {
        continue;
      }

      addAnalyticsGroupValue(generalGrouped, category, transaction.valor);
    }
  }

  if (includeCreditCards) {
    for (const transaction of transactions) {
      const type = String(transaction?.tipo ?? "").trim().toLowerCase();
      if (type !== "cartao_credito") continue;

      const cardId = getProjectionCreditCardId(transaction, cardsById);
      const card = cardId ? cardsById.get(cardId) : null;
      if (!card || card.is_active === false) continue;

      if (profileFilter && normalizeProjectionCardProfile(card) !== profileFilter) {
        continue;
      }

      if (hasCardFilter && !selectedCardSet.has(cardId)) {
        continue;
      }

      const transactionPeriod = getAnalyticsCardMonthFromDate(
        transaction.data,
        getAnalyticsCardClosingDay(card),
        getAnalyticsCardDueDay(card)
      );
      if (transactionPeriod !== period) continue;

      const category = getAnalyticsCategory(transaction);
      if (isTransferTransaction(transaction)) continue;

      addAnalyticsGroupValue(creditCardGrouped, category, transaction.valor);
    }
  }

  if (includeCreditCards && hasAccountFilter) {
    notes.push(
      "credit_card_expense_by_category is not filtered by account_id because credit cards do not have a reliable bank account link."
    );
  }

  const generalRows = includeGeneral
    ? buildAnalyticsCategoryRows(generalGrouped, limit)
    : [];
  const creditCardRows = includeCreditCards
    ? buildAnalyticsCategoryRows(creditCardGrouped, limit)
    : [];
  const generalTotal = roundMoney(
    generalRows.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const creditCardTotal = roundMoney(
    creditCardRows.reduce((sum, item) => sum + Number(item.amount || 0), 0)
  );
  const allCategories = new Set([
    ...generalRows.map((item) => item.category),
    ...creditCardRows.map((item) => item.category),
  ]);
  const accountLabels = selectedAccounts.map((account) => makeAccountLabel(account));
  const creditCardLabels = selectedCards.map((card) =>
    String(card.name || card.nome || card.emissor || card.bank_text || card.titular || "Cartão").trim()
  );

  json(res, 200, {
    ok: true,
    action: "financial_analytics",
    user: {
      user_id: user.user_id,
      whatsapp_phone_normalized: user.whatsapp_phone_normalized,
    },
    scope: {
      period,
      profile,
      source,
      account_ids: hasAccountFilter ? accountFilter.ids : [],
      account_labels: hasAccountFilter || profileFilter ? accountLabels : [],
      credit_card_ids: hasCardFilter ? creditCardFilter.ids : [],
      credit_card_labels: hasCardFilter || profileFilter ? creditCardLabels : [],
      strict_filters: strictFilters,
      is_global: !profileFilter && !hasAccountFilter && !hasCardFilter,
      notes,
    },
    summary: {
      general_expenses_total: generalTotal,
      credit_card_expenses_total: creditCardTotal,
      combined_expenses_total: roundMoney(generalTotal + creditCardTotal),
      top_general_category: generalRows[0] ?? null,
      top_credit_card_category: creditCardRows[0] ?? null,
      categories_count: allCategories.size,
    },
    general_expense_by_category: generalRows,
    credit_card_expense_by_category: creditCardRows,
    chart_data: {
      general_expense_by_category: buildAnalyticsChart(
        "Gastos por categoria",
        generalRows
      ),
      credit_card_expense_by_category: buildAnalyticsChart(
        "Gastos por categoria no cartão",
        creditCardRows
      ),
    },
    suggested_messages_for_nimble: buildAnalyticsSuggestedMessages({
      source,
      period,
      generalRows,
      creditCardRows,
    }),
  });
}

async function resolvePostContext(req, action) {
  requireMethod(req, "POST");
  const body = await parseJson(req);
  rejectUserIdFromSupplier(body);

  const idempotencyKey = requireIdempotencyKey(req);
  const whatsappPhone = requireString(
    body.whatsapp_phone,
    "WHATSAPP_PHONE_REQUIRED",
    "whatsapp_phone is required."
  );
  const providerMessageId = requireString(
    body.provider_message_id,
    "PROVIDER_MESSAGE_ID_REQUIRED",
    "provider_message_id is required."
  );

  validateIdempotencyIdentifiers({
    providerMessageId,
    idempotencyKey,
    action,
  });

  const supabase = getSupabaseAdmin();
  const user = await resolveWhatsappUser(supabase, whatsappPhone);

  return {
    body,
    idempotencyKey,
    providerMessageId,
    route: routeForAction(action),
    supabase,
    user,
  };
}

function assertTransferInsertResult(created, expectedCount) {
  const rows = Array.isArray(created) ? created : [];
  const ids = rows
    .map((row) => String(row?.id ?? "").trim())
    .filter(Boolean);

  if (
    rows.length !== expectedCount ||
    ids.length !== expectedCount ||
    new Set(ids).size !== expectedCount
  ) {
    throw new ApiError(
      500,
      "TRANSFER_PERSISTENCE_VERIFICATION_FAILED",
      "The transfer insert did not return all expected persisted transaction rows.",
      {
        expected_rows: expectedCount,
        returned_rows: rows.length,
        returned_ids: ids,
      }
    );
  }

  return rows;
}

async function runPostCommand(req, res, action, execute) {
  const { body, idempotencyKey, providerMessageId, route, supabase, user } =
    await resolvePostContext(req, action);

  const result = await runIdempotentCommand({
    supabase,
    userId: user.user_id,
    providerMessageId,
    idempotencyKey,
    route,
    requestBody: body,
    execute: () => execute({ body, providerMessageId, supabase, user }),
    validateReplay:
      action === "create_transfer"
        ? ({ body: storedBody }) =>
            validateStoredTransactionReplay({
              supabase,
              userId: user.user_id,
              responseBody: storedBody,
              operation: "create_transfer",
            })
        : undefined,
  });

  json(res, result.statusCode, {
    ...result.body,
    idempotency: {
      replayed: result.replayed,
    },
  });
}

async function handleCreateCategory(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    const type = normalizeCategoryType(body.type);
    const name = String(body.name ?? "").trim();
    const normalizedName = normalizeCatalogName(body.name);
    const profileId = normalizeProfileId(body.profile_id);

    const { data: existingRows, error: existingError } = await supabase
      .from("user_categories")
      .select("id, profile_id, tipo, nome, normalized_name")
      .eq("user_id", user.user_id)
      .eq("profile_id", profileId)
      .eq("tipo", type)
      .eq("normalized_name", normalizedName)
      .limit(1);
    if (existingError) throw existingError;

    const existing = existingRows?.[0] ?? null;

    if (existing) {
      return {
        statusCode: 200,
        body: {
          ok: true,
          status: "already_exists",
          category: {
            id: existing.id,
            profile_id: profileId,
            type: existing.tipo,
            name: existing.nome,
            normalized_name: existing.normalized_name || normalizedName,
          },
        },
      };
    }

    const { data: created, error: insertError } = await supabase
      .from("user_categories")
      .insert({
        user_id: user.user_id,
        profile_id: profileId,
        tipo: type,
        nome: name,
        normalized_name: normalizedName,
      })
      .select("id, profile_id, tipo, nome, normalized_name")
      .single();

    if (insertError) throw insertError;

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        category: {
          id: created.id,
          profile_id: profileId,
          type: created.tipo,
          name: created.nome,
          normalized_name: created.normalized_name || normalizedName,
        },
      },
    };
  });
}

async function handleCreateCreditCardTag(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    const name = String(body.name ?? "").trim();
    const normalizedName = normalizeCatalogName(body.name);

    const { data: existingRows, error: existingError } = await supabase
      .from("user_tags")
      .select("id, nome, normalized_name")
      .eq("user_id", user.user_id)
      .eq("normalized_name", normalizedName)
      .limit(1);

    if (existingError) throw existingError;

    const existing = existingRows?.[0] ?? null;

    if (existing) {
      return {
        statusCode: 200,
        body: {
          ok: true,
          status: "already_exists",
          tag: {
            id: existing.id,
            name: existing.nome,
            normalized_name: existing.normalized_name || normalizedName,
          },
        },
      };
    }

    const { data: created, error: insertError } = await supabase
      .from("user_tags")
      .insert({
        user_id: user.user_id,
        nome: name,
        normalized_name: normalizedName,
      })
      .select("id, nome, normalized_name")
      .single();

    if (insertError) throw insertError;

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        tag: {
          id: created.id,
          name: created.nome,
          normalized_name: created.normalized_name || normalizedName,
        },
      },
    };
  });
}

async function handleCreateTransaction(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    ensureMutationConfirmed(
      body,
      "Confirme com o usuário antes de criar um novo lançamento."
    );

    const type = normalizeTransactionType(body.type);
    const description = requireString(
      body.description,
      "DESCRIPTION_REQUIRED",
      "description is required."
    );
    const amountAbs = parsePositiveAmount(body.amount);
    const date = parseIsoDate(body.date);
    const paid = parseBoolean(body.paid, "paid");
    const paymentMethod = normalizePaymentMethod(body.payment_method);
    const spendingType = normalizeSpendingType(body.spending_type, type);
    const notes = String(body.notes ?? "").trim();

    const account = await requireOwnedAccount(supabase, user.user_id, body.account_id);
    const profileId = getAccountProfileId(account);
    const category = await validateCategoryIfProvided({
      supabase,
      userId: user.user_id,
      profileId,
      type,
      category: body.category,
    });

    const signedAmount = type === "receita" ? amountAbs : -amountAbs;
    const createdAt = Date.now();

    const { data: created, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.user_id,
        tipo: type,
        valor: signedAmount,
        data: date,
        descricao: description,
        categoria: category,
        tag: "",
        pago: paid,
        conta_id: account.id,
        conta_origem_id: null,
        conta_destino_id: null,
        cartao_id: null,
        transfer_from_id: "",
        transfer_to_id: "",
        qual_conta: account.id,
        criado_em: createdAt,
        payload: {
          metodoPagamento: paymentMethod,
          tipoGasto: spendingType,
          recorrenciaId: "",
          isRecorrente: false,
          recurrenceKind: "",
          recurrenceWindowMonths: null,
          recurrenceOriginDate: "",
          recurrenceWindowStart: "",
          recurrenceWindowEnd: "",
          recurrenceStatus: "",
          recurrenceRenewalDecision: "",
          recurrenceDismissedAt: "",
          recurrenceCanceledAt: "",
          recurrenceLastActionAt: "",
          contraParte: "",
          transferId: "",
          observacoes: notes,
          parcelaAtual: null,
          totalParcelas: null,
          qualCartao: "",
        },
      })
      .select("*")
      .single();

    if (error) throw error;

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        summary: buildTransactionSummary(type, description),
        transaction: mapTransactionResponse(created),
      },
    };
  });
}

async function handleMarkPaid(req, res, action) {
  requireMethod(req, "POST");
  const body = await parseJson(req);
  rejectUserIdFromSupplier(body);

  json(res, 400, {
    ok: false,
    error: {
      code: "ACTION_DEPRECATED",
      message: "Use settle_transaction with confirmed:true to settle a transaction.",
    },
  });
}

async function handleMarkUnpaid(req, res, action) {
  requireMethod(req, "POST");
  const body = await parseJson(req);
  rejectUserIdFromSupplier(body);

  json(res, 400, {
    ok: false,
    error: {
      code: "ACTION_NOT_SUPPORTED",
      message: "Undoing a payment is not available via WhatsApp API. Use the FluxMoney panel.",
    },
  });
}

function ensureMutationConfirmed(body, message) {
  if (body?.confirmed !== true) {
    throw new ApiError(
      400,
      "CONFIRMATION_REQUIRED",
      message ||
        "Confirme com o usuário antes de executar esta ação financeira."
    );
  }
}

function normalizeTransferRecurrenceMode(value) {
  const mode = String(value ?? "").trim().toLowerCase();
  if (!mode) return "single";
  if (mode === "single") return "single";
  if (mode === "com_prazo") return "com_prazo";
  if (mode === "sem_prazo") return "sem_prazo";

  throw new ApiError(
    400,
    "INVALID_DEADLINE_MODE",
    "deadline_mode must be single, sem_prazo or com_prazo."
  );
}

function buildMovementGroupKey(row) {
  if (isPfPjMovement(row)) {
    const linkedMovementId = getLinkedMovementId(row);
    if (linkedMovementId) return `pfpj:${linkedMovementId}`;
  }

  const transferId = getTransferId(row);
  if (transferId) return `transfer:${transferId}`;

  return `tx:${String(row?.id ?? "").trim()}`;
}

function mapPendingMovementCandidate(groupRows) {
  if (!Array.isArray(groupRows) || groupRows.length === 0) return null;

  const sorted = [...groupRows].sort((a, b) => {
    const dateA = String(a?.data ?? "");
    const dateB = String(b?.data ?? "");
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
  });
  const first = sorted[0];
  const amount = Math.max(
    ...sorted.map((row) => Math.abs(Number(row?.valor || 0))),
    0
  );
  const description = String(first?.descricao ?? "").trim();
  const { fromAccountId, toAccountId } = getMovementAccountIds(first);
  const movementKind = isPfPjMovement(first)
    ? "pf_pj"
    : isTransferTransaction(first)
    ? "internal_transfer"
    : "common";

  return {
    key: buildMovementGroupKey(first),
    movement_kind: movementKind,
    date: String(first?.data ?? ""),
    description,
    amount,
    from_account_id: fromAccountId || null,
    to_account_id: toAccountId || null,
    transaction_ids: sorted
      .map((row) => String(row?.id ?? "").trim())
      .filter(Boolean),
  };
}

function isCompatiblePendingCandidate(candidate, expected) {
  if (!candidate) return false;
  if (!expected) return true;

  const amountMatches =
    expected.amountAbs == null ||
    toCents(candidate.amount) === toCents(expected.amountAbs);
  if (!amountMatches) return false;

  if (expected.date && String(candidate.date ?? "") !== String(expected.date)) {
    return false;
  }

  if (
    expected.fromAccountId &&
    String(candidate.from_account_id ?? "") !== String(expected.fromAccountId)
  ) {
    return false;
  }

  if (
    expected.toAccountId &&
    String(candidate.to_account_id ?? "") !== String(expected.toAccountId)
  ) {
    return false;
  }

  if (expected.description) {
    const candidateDescription = normalizeText(candidate.description);
    const expectedDescription = normalizeText(expected.description);
    if (
      expectedDescription &&
      candidateDescription &&
      !candidateDescription.includes(expectedDescription) &&
      !expectedDescription.includes(candidateDescription)
    ) {
      return false;
    }
  }

  return true;
}

const UNSUPPORTED_SETTLEMENT_FIELDS = [
  "amount",
  "account_id",
  "category",
  "tag",
  "date",
  "paid",
  "new_value",
  "new_date",
  "undo",
  "delete",
  "cancel",
];

function rejectUnsupportedSettlementFields(body) {
  const found = UNSUPPORTED_SETTLEMENT_FIELDS.find((field) =>
    Object.prototype.hasOwnProperty.call(body ?? {}, field)
  );

  if (found) {
    throw new ApiError(
      400,
      "UNSUPPORTED_SETTLEMENT_FIELD",
      "Pela API, a baixa não altera valor, conta, data ou categoria. Para editar, acesse o painel FluxMoney."
    );
  }
}

function ensureSettleableTransaction(transaction) {
  const type = String(transaction?.tipo ?? "").trim().toLowerCase();
  const category = String(transaction?.categoria ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const description = String(transaction?.descricao ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const payload = transaction?.payload && typeof transaction.payload === "object"
    ? transaction.payload
    : {};

  if (type === "cartao_credito") {
    throw new ApiError(
      400,
      "CREDIT_CARD_NOT_SETTLEABLE_VIA_API",
      "Compras no cartão de crédito não podem ser baixadas por esta action."
    );
  }

  const isInvoicePayment =
    category === "cartao de credito" ||
    /^fatura\s*:/.test(description) ||
    String(payload?.origemLancamento ?? "").trim().toLowerCase() ===
      "pagamento_fatura" ||
    String(payload?.invoicePaymentId ?? "").trim() ||
    String(payload?.pagamentoFaturaId ?? "").trim();

  if (isInvoicePayment) {
    throw new ApiError(
      400,
      "UNSUPPORTED_TRANSACTION_TYPE",
      "Pagamentos de fatura não podem ser baixados por esta action."
    );
  }

  if (type !== "receita" && type !== "despesa") {
    throw new ApiError(
      400,
      "UNSUPPORTED_TRANSACTION_TYPE",
      "Esta action aceita apenas receitas e despesas."
    );
  }
}

async function resolveSettlementGroupRows(supabase, userId, transaction) {
  const transactionId = String(transaction?.id ?? "").trim();
  const linkedMovementId = getLinkedMovementId(transaction);
  const transferId = getTransferId(transaction);
  const transactionDate = String(transaction?.data ?? "").trim();

  if (!linkedMovementId && !transferId) {
    return [transaction];
  }

  const rows = await fetchAllTransactionsForUser(supabase, userId, {
    select:
      "id, tipo, valor, data, descricao, categoria, conta_id, qual_conta, pago, payload, transfer_from_id, transfer_to_id, conta_origem_id, conta_destino_id",
    build: (query) =>
      query
        .in("tipo", ["receita", "despesa"])
        .order("data", { ascending: true })
        .order("id", { ascending: true }),
  });

  let related = [];

  if (isPfPjMovement(transaction) && linkedMovementId) {
    related = rows.filter(
      (row) =>
        isPfPjMovement(row) &&
        String(getLinkedMovementId(row)) === String(linkedMovementId)
    );
  } else if (transferId) {
    related = rows.filter((row) => {
      if (String(getTransferId(row)) !== String(transferId)) return false;
      if (transactionDate) return String(row?.data ?? "") === transactionDate;
      return true;
    });

    if (related.length === 0) {
      related = rows.filter(
        (row) => String(getTransferId(row)) === String(transferId)
      );
    }
  }

  const byId = new Map(
    related
      .concat(transaction)
      .filter(Boolean)
      .map((row) => [String(row.id), row])
  );

  return Array.from(byId.values());
}

async function handleSettleTransaction(req, res, action) {
  await runPostCommand(
    req,
    res,
    action,
    async ({ body, providerMessageId, supabase, user }) => {
      rejectUnsupportedSettlementFields(body);
      ensureMutationConfirmed(
        body,
        "Confirme com o usuário antes de marcar esta transação como paga ou recebida."
      );

      const transactionId = requireString(
        body.transaction_id,
        "TRANSACTION_ID_REQUIRED",
        "transaction_id is required."
      );

      const settlementDate =
        body.settlement_date === undefined ||
        String(body.settlement_date ?? "").trim() === ""
          ? todayIso()
          : parseIsoDate(
              body.settlement_date,
              "INVALID_SETTLEMENT_DATE",
              "settlement_date"
            );

      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .eq("user_id", user.user_id)
        .maybeSingle();

      if (transactionError) throw transactionError;

      if (!transaction?.id) {
        throw new ApiError(
          404,
          "TRANSACTION_NOT_FOUND",
          "transaction_id was not found for this user."
        );
      }

      ensureSettleableTransaction(transaction);

      const accountId = String(
        transaction.conta_id ?? transaction.qual_conta ?? ""
      ).trim();

      if (!accountId) {
        throw new ApiError(
          400,
          "TRANSACTION_ACCOUNT_REQUIRED",
          "Esta transação não possui conta bancária vinculada. Corrija pelo painel FluxMoney antes de baixar pela API."
        );
      }

      const relatedRows = await resolveSettlementGroupRows(
        supabase,
        user.user_id,
        transaction
      );
      const rowsToSettle = relatedRows.filter((row) => !isPaidValue(row?.pago));

      if (rowsToSettle.length === 0) {
        throw new ApiError(
          409,
          "TRANSACTION_ALREADY_SETTLED",
          "Esta transação e os lançamentos vinculados já estão marcados como pagos/recebidos."
        );
      }

      const notes = String(body.notes ?? "").trim();
      const updatedRows = [];

      for (const row of rowsToSettle) {
        const payload =
          row.payload && typeof row.payload === "object"
            ? { ...row.payload }
            : {};

        payload.settledAt = settlementDate;
        payload.settlementNotes = notes;
        payload.settledBy = "whatsapp_api";
        payload.providerMessageId = providerMessageId;

        const { data: updated, error } = await supabase
          .from("transactions")
          .update({
            pago: true,
            payload,
          })
          .eq("id", row.id)
          .eq("user_id", user.user_id)
          .select("id, tipo, descricao, valor, data, conta_id, qual_conta, pago, payload")
          .single();

        if (error) throw error;
        updatedRows.push(updated);
      }

      const primary =
        updatedRows.find((row) => String(row.id) === String(transaction.id)) ||
        transaction;
      const type = String(primary.tipo ?? "").trim().toLowerCase();
      const description = primary.descricao || "lançamento";
      const movementKind = isPfPjMovement(transaction)
        ? "pf_pj"
        : getTransferId(transaction)
        ? "internal_transfer"
        : "common";
      const linkedAffectedCount = relatedRows.length;

      return {
        statusCode: 200,
        body: {
          ok: true,
          status: "settled",
          summary: `${typeLabel(type)} ${description} marcada como ${settledVerb(type)}.`,
          transaction: {
            id: primary.id,
            type,
            description,
            amount: Number(primary.valor || 0),
            date: primary.data,
            account_id: primary.conta_id || primary.qual_conta || null,
            paid: true,
            settled_at: primary.payload?.settledAt || settlementDate,
          },
          settlement: {
            movement_kind: movementKind,
            settled_count: updatedRows.length,
            linked_count: linkedAffectedCount,
            affected_transaction_ids: updatedRows.map((row) => row.id),
          },
          transactions: updatedRows.map((row) => ({
            id: row.id,
            type: String(row.tipo ?? "").trim().toLowerCase(),
            description: row.descricao || "",
            amount: Number(row.valor || 0),
            date: row.data,
            account_id: row.conta_id || row.qual_conta || null,
            paid: true,
            settled_at: row.payload?.settledAt || settlementDate,
          })),
        },
      };
    }
  );
}

async function handleCreateInstallments(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    ensureMutationConfirmed(
      body,
      "Confirme com o usuário antes de criar um lançamento parcelado."
    );

    const type = normalizeTransactionType(body.type);
    const description = requireString(
      body.description,
      "DESCRIPTION_REQUIRED",
      "description is required."
    );
    const amountAbs = parsePositiveAmount(body.amount);
    const date = parseIsoDate(body.date);
    const paid = parseBoolean(body.paid, "paid");
    const installments = parseInstallments(body.installments);
    const paymentMethod = normalizePaymentMethod(body.payment_method);
    const notes = String(body.notes ?? "").trim();

    const account = await requireOwnedAccount(supabase, user.user_id, body.account_id);
    const profileId = getAccountProfileId(account);
    const category = await validateCategoryIfProvided({
      supabase,
      userId: user.user_id,
      profileId,
      type,
      category: body.category,
    });

    const installmentAbs = amountAbs / installments;
    const signedInstallment =
      type === "receita" ? Math.abs(installmentAbs) : -Math.abs(installmentAbs);
    const signedTotal = type === "receita" ? amountAbs : -amountAbs;
    const createdAt = Date.now();
    const recorrenciaId = `rec_${createdAt}`;

    const rows = Array.from({ length: installments }, (_, index) => ({
      user_id: user.user_id,
      tipo: type,
      valor: signedInstallment,
      data: addMonthsLikeUi(date, index),
      descricao: `${description} (${index + 1}/${installments})`,
      categoria: category,
      tag: "",
      pago: index === 0 ? paid : false,
      conta_id: account.id,
      conta_origem_id: null,
      conta_destino_id: null,
      cartao_id: null,
      transfer_from_id: "",
      transfer_to_id: "",
      qual_conta: account.id,
      criado_em: createdAt + index,
      payload: {
        metodoPagamento: paymentMethod,
        ...buildInstallmentPlanningFields(
          type,
          index + 1,
          installments,
          recorrenciaId
        ),
        recurrenceKind: "",
        recurrenceWindowMonths: null,
        recurrenceOriginDate: "",
        recurrenceWindowStart: "",
        recurrenceWindowEnd: "",
        recurrenceStatus: "",
        recurrenceRenewalDecision: "",
        recurrenceDismissedAt: "",
        recurrenceCanceledAt: "",
        recurrenceLastActionAt: "",
        contraParte: "",
        transferId: "",
        observacoes: notes,
        qualCartao: "",
      },
    }));

    const { data: created, error } = await supabase
      .from("transactions")
      .insert(rows)
      .select("*");

    if (error) throw error;

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        summary: buildInstallmentsSummary(type, description, installments),
        installment_group: {
          recorrencia_id: recorrenciaId,
          installments,
          total_amount: signedTotal,
          installment_amount: signedInstallment,
        },
        transactions: (created ?? []).map(mapTransactionResponse),
      },
    };
  });
}

async function handleCreateFixed(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    ensureMutationConfirmed(
      body,
      "Confirme com o usuário antes de criar um lançamento recorrente."
    );

    const type = normalizeTransactionType(body.type);
    const description = requireString(
      body.description,
      "DESCRIPTION_REQUIRED",
      "description is required."
    );
    const amountAbs = parsePositiveAmount(body.amount);
    const date = parseIsoDate(body.date);
    const paid = parseBoolean(body.paid, "paid");
    const deadlineMode = normalizeDeadlineMode(body.deadline_mode);
    const paymentMethod = normalizePaymentMethod(body.payment_method);
    const notes = String(body.notes ?? "").trim();

    let months = SEM_PRAZO_MONTHS;
    let semPrazoMeta = null;

    if (deadlineMode === "com_prazo") {
      const endDate = parseIsoDate(body.end_date, "INVALID_END_DATE", "end_date");
      if (endDate < date) {
        throw new ApiError(
          400,
          "INVALID_END_DATE",
          "end_date cannot be before date."
        );
      }
      months = countMonthsInclusive(date, endDate);
    } else {
      semPrazoMeta = buildSemPrazoMeta(date, SEM_PRAZO_MONTHS);
    }

    if (months > MAX_FIXED_MONTHS) {
      throw new ApiError(
        400,
        "FIXED_MONTHS_LIMIT_EXCEEDED",
        `fixed transactions can generate at most ${MAX_FIXED_MONTHS} months.`
      );
    }

    const account = await requireOwnedAccount(supabase, user.user_id, body.account_id);
    const profileId = getAccountProfileId(account);
    const category = await validateCategoryIfProvided({
      supabase,
      userId: user.user_id,
      profileId,
      type,
      category: body.category,
    });

    const signedAmount = type === "receita" ? amountAbs : -amountAbs;
    const createdAt = Date.now();
    const recorrenciaId = `rec_${createdAt}`;

    const recurrencePayload =
      semPrazoMeta ?? {
        recurrenceKind: "",
        recurrenceWindowMonths: null,
        recurrenceOriginDate: "",
        recurrenceWindowStart: "",
        recurrenceWindowEnd: "",
        recurrenceStatus: "",
        recurrenceRenewalDecision: "",
        recurrenceDismissedAt: "",
        recurrenceCanceledAt: "",
        recurrenceLastActionAt: "",
      };

    const rows = Array.from({ length: months }, (_, index) => ({
      user_id: user.user_id,
      tipo: type,
      valor: signedAmount,
      data: addMonthsLikeUi(date, index),
      descricao: description,
      categoria: category,
      tag: "",
      pago: index === 0 ? paid : false,
      conta_id: account.id,
      conta_origem_id: null,
      conta_destino_id: null,
      cartao_id: null,
      transfer_from_id: "",
      transfer_to_id: "",
      qual_conta: account.id,
      criado_em: createdAt + index,
      payload: {
        metodoPagamento: paymentMethod,
        tipoGasto: "fixo",
        recorrenciaId,
        isRecorrente: true,
        ...recurrencePayload,
        contraParte: "",
        transferId: "",
        observacoes: notes,
        parcelaAtual: null,
        totalParcelas: null,
        qualCartao: "",
      },
    }));

    const { data: created, error } = await supabase
      .from("transactions")
      .insert(rows)
      .select("*");

    if (error) throw error;

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        summary: buildFixedSummary(type, description, deadlineMode),
        fixed_group: {
          recorrencia_id: recorrenciaId,
          deadline_mode: deadlineMode,
          months,
          monthly_amount: signedAmount,
        },
        transactions: (created ?? []).map(mapTransactionResponse),
      },
    };
  });
}

async function findCompatiblePendingTransferCandidates(supabase, userId, criteria) {
  const rows = await fetchAllTransactionsForUser(supabase, userId, {
    select:
      "id, tipo, valor, data, descricao, categoria, pago, payload, transfer_from_id, transfer_to_id, conta_origem_id, conta_destino_id",
    build: (query) =>
      query
        .eq("pago", false)
        .in("tipo", ["receita", "despesa"])
        .order("data", { ascending: true })
        .order("id", { ascending: true }),
  });

  const transferLikeRows = rows.filter(
    (row) => isPfPjMovement(row) || isTransferTransaction(row)
  );
  const grouped = new Map();

  for (const row of transferLikeRows) {
    const key = buildMovementGroupKey(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  const candidates = Array.from(grouped.values())
    .map((groupRows) => mapPendingMovementCandidate(groupRows))
    .filter(Boolean)
    .filter((candidate) =>
      isCompatiblePendingCandidate(candidate, {
        description: criteria?.description,
        amountAbs: criteria?.amountAbs,
        date: criteria?.date,
        fromAccountId: criteria?.fromAccountId,
        toAccountId: criteria?.toAccountId,
      })
    )
    .sort((a, b) =>
      String(a.date).localeCompare(String(b.date)) ||
      String(a.description).localeCompare(String(b.description))
    );

  return candidates;
}

async function handleCreateTransfer(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    ensureMutationConfirmed(
      body,
      "Confirme com o usuário antes de criar um lançamento de transferência/movimento PF/PJ."
    );

    const description = requireString(
      body.description,
      "DESCRIPTION_REQUIRED",
      "description is required."
    );
    const amountAbs = parsePositiveAmount(body.amount);
    const date = parseIsoDate(body.date);
    const paid = parseBoolean(body.paid, "paid");
    const notes = String(body.notes ?? "").trim();
    const fromAccountId = requireString(
      body.from_account_id,
      "FROM_ACCOUNT_ID_REQUIRED",
      "from_account_id is required."
    );
    const toAccountId = requireString(
      body.to_account_id,
      "TO_ACCOUNT_ID_REQUIRED",
      "to_account_id is required."
    );
    const recurrenceMode = normalizeTransferRecurrenceMode(body.deadline_mode);
    const allowCreateDespitePending =
      body.create_new_confirmed === true || body.force_create === true;

    if (sameAccountId(fromAccountId, toAccountId)) {
      throw new ApiError(
        400,
        "SAME_TRANSFER_ACCOUNT",
        "from_account_id and to_account_id must be different."
      );
    }

    const [fromAccount, toAccount] = await Promise.all([
      requireOwnedAccount(supabase, user.user_id, fromAccountId),
      requireOwnedAccount(supabase, user.user_id, toAccountId),
    ]);

    if (sameAccountId(fromAccount.id, toAccount.id)) {
      throw new ApiError(
        400,
        "SAME_TRANSFER_ACCOUNT",
        "from_account_id and to_account_id must be different."
      );
    }

    if (!allowCreateDespitePending) {
      const candidates = await findCompatiblePendingTransferCandidates(
        supabase,
        user.user_id,
        {
          description,
          amountAbs,
          date,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
        }
      );

      if (candidates.length > 0) {
        throw new ApiError(
          409,
          "PENDING_TRANSFER_MATCH_FOUND",
          "Existe movimentação pendente compatível. Confirme a baixa da pendência antes de criar uma nova.",
          {
            status: "pending_match_found",
            candidates,
            next_step:
              "Use settle_transaction para baixar a pendência, ou envie create_new_confirmed:true para criar mesmo assim.",
          }
        );
      }
    }

    const fromProfile = getAccountProfileId(fromAccount);
    const toProfile = getAccountProfileId(toAccount);
    const isCrossProfile = fromProfile !== toProfile;
    const createdAt = Date.now();
    const effectivePaid = date <= todayIso() ? paid : false;

    const buildRef = (prefix) =>
      typeof crypto !== "undefined" && crypto.randomUUID
        ? `${prefix}_${crypto.randomUUID()}`
        : `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    if (!isCrossProfile && recurrenceMode !== "single") {
      throw new ApiError(
        400,
        "INTERNAL_TRANSFER_RECURRENCE_NOT_SUPPORTED",
        "Transferência interna entre contas do mesmo perfil deve ser avulsa (deadline_mode=single)."
      );
    }

    if (isCrossProfile) {
      const fromCategoryProvided =
        body.from_category ?? body.category_from ?? body.category_origin;
      const toCategoryProvided =
        body.to_category ?? body.category_to ?? body.category_destination;
      const fromCategory =
        (await validateCategoryIfProvided({
          supabase,
          userId: user.user_id,
          profileId: fromProfile,
          type: "despesa",
          category: fromCategoryProvided,
        })) || "Movimento PF/PJ";
      const toCategory =
        (await validateCategoryIfProvided({
          supabase,
          userId: user.user_id,
          profileId: toProfile,
          type: "receita",
          category: toCategoryProvided,
        })) || "Movimento PF/PJ";
      const originProfileKind = fromProfile.toUpperCase();
      const destinationProfileKind = toProfile.toUpperCase();

      const createPfPjLegsForDate = ({ currentDate, index, recurrenceId, recurrencePayload }) => {
        const linkedMovementId = buildRef("mov");
        const paidCurrent = index === 0 ? effectivePaid : false;
        const isRecurring = Boolean(recurrenceId);
        const spendingType = isRecurring ? "fixo" : "Variável";

        const basePayload = {
          metodoPagamento: "",
          tipoGasto: spendingType,
          recorrenciaId: recurrenceId || "",
          isRecorrente: isRecurring,
          recurrenceKind: "",
          recurrenceWindowMonths: null,
          recurrenceOriginDate: "",
          recurrenceWindowStart: "",
          recurrenceWindowEnd: "",
          recurrenceStatus: "",
          recurrenceRenewalDecision: "",
          recurrenceDismissedAt: "",
          recurrenceCanceledAt: "",
          recurrenceLastActionAt: "",
          transferId: "",
          observacoes: notes,
          parcelaAtual: null,
          totalParcelas: null,
          qualCartao: "",
          movementKind: "pf_pj",
          linkedMovementId,
          originAccountId: fromAccount.id,
          destinationAccountId: toAccount.id,
          originProfileKind,
          destinationProfileKind,
        };

        return [
          {
            user_id: user.user_id,
            tipo: "despesa",
            valor: -Math.abs(amountAbs),
            data: currentDate,
            descricao: description,
            categoria: fromCategory,
            tag: "",
            pago: paidCurrent,
            conta_id: fromAccount.id,
            conta_origem_id: fromAccount.id,
            conta_destino_id: toAccount.id,
            cartao_id: null,
            transfer_from_id: fromAccount.id,
            transfer_to_id: toAccount.id,
            qual_conta: fromAccount.id,
            criado_em: createdAt + index * 2,
            payload: {
              ...basePayload,
              linkedMovementDirection: "saida",
              contraParte: toAccount.id,
              ...(recurrencePayload || {}),
            },
          },
          {
            user_id: user.user_id,
            tipo: "receita",
            valor: Math.abs(amountAbs),
            data: currentDate,
            descricao: description,
            categoria: toCategory,
            tag: "",
            pago: paidCurrent,
            conta_id: toAccount.id,
            conta_origem_id: fromAccount.id,
            conta_destino_id: toAccount.id,
            cartao_id: null,
            transfer_from_id: fromAccount.id,
            transfer_to_id: toAccount.id,
            qual_conta: toAccount.id,
            criado_em: createdAt + index * 2 + 1,
            payload: {
              ...basePayload,
              linkedMovementDirection: "entrada",
              contraParte: fromAccount.id,
              ...(recurrencePayload || {}),
            },
          },
        ];
      };

      if (recurrenceMode === "single") {
        const rows = createPfPjLegsForDate({
          currentDate: date,
          index: 0,
          recurrenceId: "",
          recurrencePayload: null,
        });

        const { data: created, error } = await supabase
          .from("transactions")
          .insert(rows)
          .select("*");

        if (error) throw error;
        const verifiedCreated = assertTransferInsertResult(created, rows.length);

        return {
          statusCode: 201,
          body: {
            ok: true,
            status: "created",
            summary: `Movimento PF/PJ ${description} lançado com sucesso.`,
            transfer_group: {
              movement_kind: "pf_pj",
              from_account_id: fromAccount.id,
              to_account_id: toAccount.id,
              amount: amountAbs,
              paid: effectivePaid,
              recurring: false,
            },
            transactions: verifiedCreated.map(mapTransactionResponse),
          },
        };
      }

      let months = SEM_PRAZO_MONTHS;
      let recurrencePayload = null;
      let endDate = "";

      if (recurrenceMode === "com_prazo") {
        endDate = parseIsoDate(body.end_date, "INVALID_END_DATE", "end_date");
        if (endDate < date) {
          throw new ApiError(
            400,
            "INVALID_END_DATE",
            "end_date cannot be before date."
          );
        }
        months = countMonthsInclusive(date, endDate);
      } else {
        recurrencePayload = buildSemPrazoMeta(date, SEM_PRAZO_MONTHS);
      }

      if (months > MAX_FIXED_MONTHS) {
        throw new ApiError(
          400,
          "FIXED_MONTHS_LIMIT_EXCEEDED",
          `fixed transactions can generate at most ${MAX_FIXED_MONTHS} months.`
        );
      }

      const recurrenceId = `rec_${createdAt}`;
      const rows = [];

      for (let index = 0; index < months; index += 1) {
        const currentDate = addMonthsLikeUi(date, index);
        rows.push(
          ...createPfPjLegsForDate({
            currentDate,
            index,
            recurrenceId,
            recurrencePayload,
          })
        );
      }

      const { data: created, error } = await supabase
        .from("transactions")
        .insert(rows)
        .select("*");

      if (error) throw error;
      const verifiedCreated = assertTransferInsertResult(created, rows.length);

      return {
        statusCode: 201,
        body: {
          ok: true,
          status: "created",
          summary: `Movimento PF/PJ recorrente ${description} lançado com sucesso.`,
          transfer_group: {
            movement_kind: "pf_pj",
            from_account_id: fromAccount.id,
            to_account_id: toAccount.id,
            amount: amountAbs,
            paid_first_occurrence: effectivePaid,
            recurring: true,
            recurrence_mode: recurrenceMode,
            recurrence_id: recurrenceId,
            months,
            end_date: recurrenceMode === "com_prazo" ? endDate : null,
          },
          transactions: verifiedCreated.map(mapTransactionResponse),
        },
      };
    }

    const transferId = buildRef("tr");

    const basePayload = {
      metodoPagamento: "",
      tipoGasto: "",
      recorrenciaId: "",
      isRecorrente: false,
      recurrenceKind: "",
      recurrenceWindowMonths: null,
      recurrenceOriginDate: "",
      recurrenceWindowStart: "",
      recurrenceWindowEnd: "",
      recurrenceStatus: "",
      recurrenceRenewalDecision: "",
      recurrenceDismissedAt: "",
      recurrenceCanceledAt: "",
      recurrenceLastActionAt: "",
      transferId,
      observacoes: notes,
      parcelaAtual: null,
      totalParcelas: null,
      qualCartao: "",
    };

    const saida = {
      user_id: user.user_id,
      tipo: "despesa",
      valor: -Math.abs(amountAbs),
      data: date,
      descricao: description,
      categoria: "Transferência",
      tag: "",
      pago: effectivePaid,
      conta_id: fromAccount.id,
      conta_origem_id: fromAccount.id,
      conta_destino_id: toAccount.id,
      cartao_id: null,
      transfer_from_id: fromAccount.id,
      transfer_to_id: toAccount.id,
      qual_conta: fromAccount.id,
      criado_em: createdAt,
      payload: {
        ...basePayload,
        contraParte: toAccount.id,
      },
    };

    const entrada = {
      user_id: user.user_id,
      tipo: "receita",
      valor: Math.abs(amountAbs),
      data: date,
      descricao: description,
      categoria: "Transferência",
      tag: "",
      pago: effectivePaid,
      conta_id: toAccount.id,
      conta_origem_id: fromAccount.id,
      conta_destino_id: toAccount.id,
      cartao_id: null,
      transfer_from_id: fromAccount.id,
      transfer_to_id: toAccount.id,
      qual_conta: toAccount.id,
      criado_em: createdAt + 1,
      payload: {
        ...basePayload,
        contraParte: fromAccount.id,
      },
    };

    const { data: created, error } = await supabase
      .from("transactions")
      .insert([saida, entrada])
      .select("*");

    if (error) throw error;
    const verifiedCreated = assertTransferInsertResult(created, 2);

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        summary: `Transferência ${description} lançada com sucesso.`,
        transfer_group: {
          movement_kind: "internal_transfer",
          transfer_id: transferId,
          from_account_id: fromAccount.id,
          to_account_id: toAccount.id,
          amount: amountAbs,
          paid: effectivePaid,
        },
        transactions: verifiedCreated.map(mapTransactionResponse),
      },
    };
  });
}

async function handleCreateCreditCardPurchase(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    ensureMutationConfirmed(
      body,
      "Confirme com o usuário antes de lançar uma compra no cartão."
    );

    if (body.account_id !== undefined) {
      throw new ApiError(
        400,
        "ACCOUNT_ID_NOT_ALLOWED",
        "account_id is not accepted for credit card purchases."
      );
    }

    if (body.installments !== undefined) {
      throw new ApiError(
        400,
        "INSTALLMENTS_NOT_ALLOWED",
        "installments is not accepted for this action."
      );
    }

    const description = requireString(
      body.description,
      "DESCRIPTION_REQUIRED",
      "description is required."
    );
    const amountAbs = parsePositiveAmount(body.amount);
    const date = parseIsoDate(body.date);
    const paid = body.paid === undefined ? false : parseBoolean(body.paid, "paid");
    const notes = String(body.notes ?? "").trim();
    const spendingType = normalizeCreditSpendingType(body.spending_type);

    const card = await requireOwnedCreditCard(
      supabase,
      user.user_id,
      body.credit_card_id
    );
    const creditCardId = String(card.id);
    const profileId = getCreditCardProfileId(card);
    const category = await validateCategoryIfProvided({
      supabase,
      userId: user.user_id,
      profileId,
      type: "despesa",
      category: body.category,
    });
    const tag = await validateCreditCardTagIfProvided({
      supabase,
      userId: user.user_id,
      tag: body.tag,
    });

    const invoiceMonth = getCreditInvoiceMonth(
      date,
      Number(card.dia_fechamento ?? card.diaFechamento ?? 1),
      Number(card.dia_vencimento ?? card.diaVencimento ?? 1)
    );
    const linkedAccountId = getCreditCardAccountId(card);
    const createdAt = Date.now();

    const { data: created, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.user_id,
        tipo: "cartao_credito",
        valor: -Math.abs(amountAbs),
        data: date,
        descricao: description,
        categoria: category,
        tag,
        pago: paid,
        conta_id: linkedAccountId,
        conta_origem_id: null,
        conta_destino_id: null,
        cartao_id: creditCardId,
        transfer_from_id: "",
        transfer_to_id: "",
        qual_conta: creditCardId,
        criado_em: createdAt,
        payload: {
          metodoPagamento: "",
          tipoGasto: spendingType,
          recorrenciaId: "",
          isRecorrente: false,
          recurrenceKind: "",
          recurrenceWindowMonths: null,
          recurrenceOriginDate: "",
          recurrenceWindowStart: "",
          recurrenceWindowEnd: "",
          recurrenceStatus: "",
          recurrenceRenewalDecision: "",
          recurrenceDismissedAt: "",
          recurrenceCanceledAt: "",
          recurrenceLastActionAt: "",
          contraParte: "",
          transferId: "",
          observacoes: notes,
          parcelaAtual: null,
          totalParcelas: null,
          cartaoId: creditCardId,
          qualCartao: creditCardId,
          targetId: creditCardId,
          faturaMes: invoiceMonth,
          origemLancamento: "",
          parcelamentoFaturaId: "",
          faturaOrigemCicloKey: "",
        },
      })
      .select("*")
      .single();

    if (error) throw error;

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        summary: `Compra ${description} lançada no cartão com sucesso.`,
        transaction: {
          id: created.id,
          type: created.tipo,
          description: created.descricao || "",
          amount: Number(created.valor || 0),
          date: created.data,
          credit_card_id: created.cartao_id || creditCardId,
          category: created.categoria || "",
          tag: created.tag || "",
          paid: Boolean(created.pago),
          invoice_month: created.payload?.faturaMes || invoiceMonth,
        },
      },
    };
  });
}

async function handleCreateCreditCardInstallments(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    ensureMutationConfirmed(
      body,
      "Confirme com o usuário antes de lançar uma compra parcelada no cartão."
    );

    if (body.account_id !== undefined) {
      throw new ApiError(
        400,
        "ACCOUNT_ID_NOT_ALLOWED",
        "account_id is not accepted for credit card purchases."
      );
    }

    const description = requireString(
      body.description,
      "DESCRIPTION_REQUIRED",
      "description is required."
    );
    const amountAbs = parsePositiveAmount(body.amount);
    const date = parseIsoDate(body.date);
    const paid = body.paid === undefined ? false : parseBoolean(body.paid, "paid");
    const installments = parseInstallments(body.installments);
    const notes = String(body.notes ?? "").trim();

    const card = await requireOwnedCreditCard(
      supabase,
      user.user_id,
      body.credit_card_id
    );
    const creditCardId = String(card.id);
    const profileId = getCreditCardProfileId(card);
    const category = await validateCategoryIfProvided({
      supabase,
      userId: user.user_id,
      profileId,
      type: "despesa",
      category: body.category,
    });
    const tag = await validateCreditCardTagIfProvided({
      supabase,
      userId: user.user_id,
      tag: body.tag,
    });

    const linkedAccountId = getCreditCardAccountId(card);
    const createdAt = Date.now();
    const recorrenciaId = `cc_parc_${creditCardId}_${createdAt}`;
    const installmentAmount = -Math.abs(amountAbs / installments);

    const rows = Array.from({ length: installments }, (_, index) => {
      const installmentNumber = index + 1;
      const installmentDate = addMonthsSafeLikeCreditUi(date, index);
      const invoiceMonth = getCreditInvoiceMonth(
        installmentDate,
        Number(card.dia_fechamento ?? card.diaFechamento ?? 1),
        Number(card.dia_vencimento ?? card.diaVencimento ?? 1)
      );

      return {
        user_id: user.user_id,
        tipo: "cartao_credito",
        valor: installmentAmount,
        data: installmentDate,
        descricao: `${description} (${installmentNumber}/${installments})`,
        categoria: category,
        tag,
        pago: index === 0 ? paid : false,
        conta_id: linkedAccountId,
        conta_origem_id: null,
        conta_destino_id: null,
        cartao_id: creditCardId,
        transfer_from_id: "",
        transfer_to_id: "",
        qual_conta: creditCardId,
        criado_em: createdAt + index,
        payload: {
          metodoPagamento: "",
          ...buildInstallmentPlanningFields(
            "despesa",
            installmentNumber,
            installments,
            recorrenciaId
          ),
          recurrenceKind: "",
          recurrenceWindowMonths: null,
          recurrenceOriginDate: "",
          recurrenceWindowStart: "",
          recurrenceWindowEnd: "",
          recurrenceStatus: "",
          recurrenceRenewalDecision: "",
          recurrenceDismissedAt: "",
          recurrenceCanceledAt: "",
          recurrenceLastActionAt: "",
          contraParte: "",
          transferId: "",
          observacoes: notes,
          cartaoId: creditCardId,
          qualCartao: creditCardId,
          targetId: creditCardId,
          faturaMes: invoiceMonth,
          origemLancamento: "",
          parcelamentoFaturaId: "",
          faturaOrigemCicloKey: "",
        },
      };
    });

    const { data: created, error } = await supabase
      .from("transactions")
      .insert(rows)
      .select("*");

    if (error) throw error;

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        summary: `Compra ${description} parcelada em ${installments}x lançada no cartão com sucesso.`,
        installment_group: {
          installments,
          total_amount: amountAbs,
          installment_amount: installmentAmount,
          recorrencia_id: recorrenciaId,
        },
        transactions: (created ?? []).map((row) => ({
          id: row.id,
          type: row.tipo,
          description: row.descricao || "",
          amount: Number(row.valor || 0),
          date: row.data,
          credit_card_id: row.cartao_id || creditCardId,
          category: row.categoria || "",
          tag: row.tag || "",
          paid: Boolean(row.pago),
          invoice_month: row.payload?.faturaMes || "",
          installment: Number(row.payload?.parcelaAtual || 0),
          total_installments: Number(row.payload?.totalParcelas || 0),
        })),
      },
    };
  });
}

async function handlePayCreditCardInvoice(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    if (body.confirmed !== true) {
      throw new ApiError(
        400,
        "CONFIRMATION_REQUIRED",
        "Invoice payment requires explicit user confirmation."
      );
    }

    const creditCardId = requireString(
      body.credit_card_id,
      "CREDIT_CARD_ID_REQUIRED",
      "credit_card_id is required."
    );
    const cicloKey = requireString(
      body.ciclo_key,
      "CICLO_KEY_REQUIRED",
      "ciclo_key is required."
    );
    const accountId = String(body.account_id ?? "").trim();

    if (!accountId) {
      throw new ApiError(
        400,
        "PAYMENT_ACCOUNT_REQUIRED",
        "Para pagar a fatura, informe de qual conta bancária o valor deve sair."
      );
    }

    const paymentDate = parseIsoDate(
      body.payment_date || todayIso(),
      "INVALID_PAYMENT_DATE",
      "payment_date"
    );
    const notes = String(body.notes ?? "").trim();
    const cycle = parseCreditInvoiceCycleKey(cicloKey);

    if (String(cycle.credit_card_id) !== String(creditCardId)) {
      throw new ApiError(
        400,
        "CICLO_KEY_CARD_MISMATCH",
        "ciclo_key does not belong to credit_card_id."
      );
    }

    const [card, account] = await Promise.all([
      requireOwnedCreditCard(supabase, user.user_id, creditCardId),
      requireOwnedAccount(supabase, user.user_id, accountId),
    ]);

    const closingDay = Number(card.dia_fechamento ?? card.diaFechamento ?? 1);
    const dueDay = Number(card.dia_vencimento ?? card.diaVencimento ?? 10);
    const invoiceMonth = getInvoiceMonthFromCycleEnd(
      cycle.cycle_end,
      closingDay,
      dueDay
    );
    const expectedCycle = getCreditInvoiceCycle(
      creditCardId,
      invoiceMonth,
      closingDay,
      dueDay
    );

    if (!invoiceMonth || !expectedCycle || expectedCycle.ciclo_key !== cicloKey) {
      throw new ApiError(
        400,
        "INVALID_CICLO_KEY",
        "ciclo_key does not match this credit card invoice cycle."
      );
    }

    const invoice = (
      await getCreditInvoiceSummaries(supabase, user.user_id, {
        creditCardId,
        cicloKey,
      })
    ).find(
      (item) =>
        String(item.credit_card_id) === String(creditCardId) &&
        String(item.ciclo_key) === String(cicloKey)
    );

    if (!invoice || Number(invoice.amount || 0) <= 0) {
      throw new ApiError(
        404,
        "INVOICE_NOT_FOUND_OR_EMPTY",
        "Invoice was not found or has no credit card purchases."
      );
    }

    const invoiceAmount = roundMoney(Number(invoice.amount || 0));
    const paidAmount = roundMoney(Number(invoice.paid_amount || 0));
    const remainingAmount = roundMoney(Number(invoice.remaining_amount || 0));
    const status = String(invoice.status || "");

    if (body.amount !== undefined) {
      const requestedAmount = Number(body.amount);
      if (
        !Number.isFinite(requestedAmount) ||
        toCents(Math.abs(requestedAmount)) !== toCents(remainingAmount)
      ) {
        throw new ApiError(
          400,
          "FULL_PAYMENT_ONLY",
          "Pela API, só é permitido pagar o valor total da fatura. Para pagamento parcial, acesse o painel FluxMoney."
        );
      }
    }

    if (remainingAmount <= 0 || status === "PAGA" || status === "ZERADA") {
      throw new ApiError(
        400,
        "INVOICE_ALREADY_PAID",
        "Esta fatura não possui saldo pendente para pagamento."
      );
    }

    if (status !== "FECHADA" && status !== "ATRASADA") {
      throw new ApiError(
        400,
        "INVOICE_NOT_PAYABLE_VIA_API",
        "Esta fatura ainda não está fechada. Pela API, o pagamento é permitido apenas para fatura fechada/atrasada e pelo valor total. Para consultar ou pagar parcialmente, acesse o painel FluxMoney.",
        {
          current_amount: invoiceAmount,
          remaining_amount: remainingAmount,
          status,
          payment_message: invoice.payment_message,
        }
      );
    }

    const createdAt = Date.now();
    const accountLabel = String(account.name || account.banco || "").trim() || null;
    const description = buildInvoicePaymentTransactionDescription(card);
    let createdTransaction = null;
    let createdPayment = null;

    try {
      const { data: transactionRow, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: user.user_id,
          tipo: "despesa",
          valor: -Math.abs(remainingAmount),
          data: paymentDate,
          descricao: description,
          categoria: "Cartão de Crédito",
          tag: "",
          pago: true,
          conta_id: accountId,
          conta_origem_id: null,
          conta_destino_id: null,
          cartao_id: null,
          transfer_from_id: "",
          transfer_to_id: "",
          qual_conta: accountId,
          criado_em: createdAt,
          payload: {
            metodoPagamento: "",
            tipoGasto: "",
            recorrenciaId: "",
            isRecorrente: false,
            recurrenceKind: "",
            recurrenceWindowMonths: null,
            recurrenceOriginDate: "",
            recurrenceWindowStart: "",
            recurrenceWindowEnd: "",
            recurrenceStatus: "",
            recurrenceRenewalDecision: "",
            recurrenceDismissedAt: "",
            recurrenceCanceledAt: "",
            recurrenceLastActionAt: "",
            contraParte: "",
            transferId: "",
            observacoes: notes,
            parcelaAtual: null,
            totalParcelas: null,
            qualCartao: "",
            origemLancamento: "whatsapp_api",
            action: "pay_credit_card_invoice",
            creditCardId,
            cicloKey,
            invoiceMonth,
            providerMessageId: body.provider_message_id,
            notes,
          },
        })
        .select("*")
        .single();

      if (transactionError) throw transactionError;
      createdTransaction = transactionRow;

      const { data: paymentRow, error: paymentError } = await supabase
        .from("invoice_payments")
        .insert({
          id: crypto.randomUUID(),
          user_id: user.user_id,
          credit_card_id: creditCardId,
          ciclo_key: cicloKey,
          payment_date: paymentDate,
          amount: remainingAmount,
          account_id: accountId,
          account_label: accountLabel,
          transaction_id: String(createdTransaction.id),
          snapshot_created_at_ms: createdAt,
        })
        .select("*")
        .single();

      if (paymentError) throw paymentError;
      createdPayment = paymentRow;

      const { error: statusError } = await supabase
        .from("invoice_manual_status")
        .upsert(
          {
            id: crypto.randomUUID(),
            user_id: user.user_id,
            cartao_id: creditCardId,
            ciclo_key: cicloKey,
            status_manual: "paga",
            parcelamento_fatura_id: null,
            criado_em: createdAt,
          },
          {
            onConflict: "user_id,cartao_id,ciclo_key",
          }
        );

      if (statusError) throw statusError;
    } catch (error) {
      if (createdPayment?.id) {
        await supabase
          .from("invoice_payments")
          .delete()
          .eq("id", createdPayment.id)
          .eq("user_id", user.user_id);
      }

      if (createdTransaction?.id) {
        await supabase
          .from("transactions")
          .delete()
          .eq("id", createdTransaction.id)
          .eq("user_id", user.user_id);
      }

      throw new ApiError(
        500,
        "INVOICE_PAYMENT_FAILED",
        "Não foi possível registrar o pagamento da fatura com segurança. Nenhuma despesa solta foi mantida."
      );
    }

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        summary: `Fatura ${card.nome || card.bank_text || "do cartão"} paga com sucesso.`,
        payment: {
          id: createdPayment.id,
          credit_card_id: creditCardId,
          ciclo_key: cicloKey,
          amount: remainingAmount,
          payment_date: paymentDate,
          account_id: accountId,
          transaction_id: String(createdTransaction.id),
        },
        invoice: {
          invoice_month: invoiceMonth,
          previous_pending_amount: remainingAmount,
          paid_amount: remainingAmount,
          remaining_pending_amount: 0,
          status: "PAGA",
        },
      },
    };
  });
}

module.exports = withApi(async function handler(req, res) {
  validateSupplierAuth(req);

  const action = normalizeAction(req);

  if (action === "context") {
    return handleContext(req, res, getSupabaseAdmin());
  }
  if (action === "list_transactions") {
    return handleListTransactions(req, res, getSupabaseAdmin());
  }
  if (action === "pending_transactions") {
    return handlePendingTransactions(req, res, getSupabaseAdmin());
  }
  if (action === "resolve_transaction") {
    return handleResolveTransaction(req, res, getSupabaseAdmin());
  }
  if (action === "payable_invoices") {
    return handlePayableInvoices(req, res, getSupabaseAdmin());
  }
  if (action === "financial_projection") {
    return handleFinancialProjection(req, res, getSupabaseAdmin());
  }
  if (action === "financial_analytics") {
    return handleFinancialAnalytics(req, res, getSupabaseAdmin());
  }
  if (action === "financial_summary") {
    return handleFinancialSummary(req, res, getSupabaseAdmin());
  }
  if (action === "create_category") {
    return handleCreateCategory(req, res, action);
  }
  if (action === "create_credit_card_tag") {
    return handleCreateCreditCardTag(req, res, action);
  }
  if (action === "create_transaction") {
    return handleCreateTransaction(req, res, action);
  }
  if (action === "mark_paid") {
    return handleMarkPaid(req, res, action);
  }
  if (action === "mark_unpaid") {
    return handleMarkUnpaid(req, res, action);
  }
  if (action === "settle_transaction") {
    return handleSettleTransaction(req, res, action);
  }
  if (action === "create_installments") {
    return handleCreateInstallments(req, res, action);
  }
  if (action === "create_fixed") {
    return handleCreateFixed(req, res, action);
  }
  if (action === "create_transfer") {
    return handleCreateTransfer(req, res, action);
  }
  if (action === "create_credit_card_purchase") {
    return handleCreateCreditCardPurchase(req, res, action);
  }
  if (action === "create_credit_card_installments") {
    return handleCreateCreditCardInstallments(req, res, action);
  }
  if (action === "pay_credit_card_invoice") {
    return handlePayCreditCardInvoice(req, res, action);
  }

  throw new ApiError(400, "INVALID_ACTION", "action is not supported.");
});
