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
} = require("../_lib/idempotency");
const {
  addMonthsLikeUi,
  buildFixedSummary,
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
  const issuer = String(card?.bank_text ?? card?.titular ?? card?.emissor ?? "").trim() || "CartÃƒÂ£o";
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
      payment_message: `Esta fatura pode ser paga pela API somente pelo valor total Ã  vista de ${formatted}. Para continuar, escolha de qual conta bancÃ¡ria o pagamento deve sair.`,
      panel_required_reason: null,
      payment_account_required: true,
      account_selection_message:
        "Para pagar esta fatura pela API, escolha de qual conta bancÃ¡ria o pagamento deve sair.",
    };
  }

  if (status === "EM_ABERTO" && remaining > 0) {
    return {
      can_pay_via_api: false,
      api_payment_type: "full_only",
      payment_message: `Esta fatura ainda estÃ¡ em aberto. O valor gasto atÃ© agora Ã© ${formatted}. Para pagamento parcial ou antecipado, acesse o painel FluxMoney.`,
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
        "Esta fatura ainda Ã© futura. Para consultar ou gerenciar detalhes, acesse o painel FluxMoney.",
      panel_required_reason: "future_invoice",
      payment_account_required: false,
      account_selection_message: null,
    };
  }

  return {
    can_pay_via_api: false,
    api_payment_type: "full_only",
    payment_message: "Esta fatura nÃ£o possui saldo pendente para pagamento.",
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

  if (!raw || raw === "variavel" || raw === "normal") return "VariÃ¡vel";
  if (raw === "fixo") return "Fixo";

  throw new ApiError(
    400,
    "INVALID_SPENDING_TYPE",
    "spending_type must be variavel, variÃ¡vel, fixo, or omitted."
  );
}

function getCreditCardProfileId(card) {
  return String(card?.brand ?? card?.perfil ?? "")
    .trim()
    .toLowerCase() === "pj"
    ? "pj"
    : "pf";
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

function isTransferTransaction(row) {
  const type = normalizeText(row?.tipo);
  const category = normalizeText(row?.categoria);
  const payload = row?.payload && typeof row.payload === "object" ? row.payload : {};

  return (
    type === "transferencia" ||
    category === "transferencia" ||
    category.includes("transfer") ||
    Boolean(String(payload?.transferId ?? "").trim()) ||
    Boolean(String(row?.transfer_from_id ?? "").trim()) ||
    Boolean(String(row?.transfer_to_id ?? "").trim())
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
  const raw = String(card?.perfil ?? card?.brand ?? "")
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
  const type = normalizeText(row?.tipo);
  const category = normalizeText(row?.categoria);
  const description = normalizeText(row?.descricao);

  return (
    type === "transferencia" ||
    category === "transferencia" ||
    category.includes("transfer") ||
    Boolean(String(row?.payload?.transferId ?? "").trim()) ||
    Boolean(String(row?.payload?.transferenciaId ?? "").trim()) ||
    Boolean(String(row?.transfer_from_id ?? "").trim()) ||
    Boolean(String(row?.transfer_to_id ?? "").trim()) ||
    Boolean(String(row?.conta_origem_id ?? "").trim()) ||
    Boolean(String(row?.conta_destino_id ?? "").trim()) ||
    description.includes("transfer")
  );
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

async function handleContext(req, res, supabase) {
  requireMethod(req, "GET");
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
      user_id_from_supplier_body: "not_accepted",
      invoice_ref_format: "credit_card_id:YYYY-MM",
    },
  });
}

async function handlePendingTransactions(req, res, supabase) {
  requireMethod(req, "GET");
  const user = await resolveGetUser(supabase, req);
  const limit = parseLimit(req.query?.limit);
  const type = String(req.query?.type ?? "").trim();
  const accountId = String(req.query?.account_id ?? "").trim();

  let query = supabase
    .from("transactions")
    .select("id, tipo, valor, data, descricao, categoria, tag, conta_id, qual_conta, pago, payload")
    .eq("user_id", user.user_id)
    .eq("pago", false)
    .in("tipo", ["receita", "despesa"])
    .order("data", { ascending: true })
    .limit(limit);

  if (type === "receita" || type === "despesa") {
    query = query.eq("tipo", type);
  }

  if (accountId) {
    query = query.eq("conta_id", accountId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const accountIds = Array.from(
    new Set(
      (data ?? [])
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
    transactions: (data ?? []).map((row) => ({
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
          settle_confirmation_message: `Confirma marcar a ${typeText} ${description || "lanÃ§amento"} de ${formatMoneyPtBr(
            absoluteAmount
          )} como ${actionText}?`,
          paid: Boolean(row.pago),
        };
      })(),
    })),
  });
}

async function getCreditInvoiceSummaries(
  supabase,
  userId,
  { creditCardId, cicloKey } = {}
) {
  const [cardsResult, txResult, paymentsResult, manualStatusResult] =
    await Promise.all([
      (() => {
        let query = supabase.from("credit_cards").select("*").eq("user_id", userId);
        if (creditCardId) query = query.eq("id", creditCardId);
        return query;
      })(),
      supabase
        .from("transactions")
        .select("id, tipo, valor, data, descricao, categoria, cartao_id, qual_conta, pago, payload")
        .eq("user_id", userId)
        .eq("tipo", "cartao_credito"),
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
    txResult,
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

  for (const tx of txResult.data ?? []) {
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

  const [accountsResult, transactionsResult, invoiceSummaries] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, banco, name, perfil_conta, initial_balance_cents")
      .eq("user_id", user.user_id)
      .order("created_at", { ascending: true }),
    supabase
      .from("transactions")
      .select(
        "id, tipo, valor, data, descricao, categoria, tag, conta_id, qual_conta, pago, payload, transfer_from_id, transfer_to_id"
      )
      .eq("user_id", user.user_id),
    getCreditInvoiceSummaries(supabase, user.user_id),
  ]);

  for (const result of [accountsResult, transactionsResult]) {
    if (result.error) throw result.error;
  }

  const accounts = accountsResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
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
  const today = getSaoPauloTodayIso();
  const months = normalizeProjectionMonths(req.query?.months);
  const startPeriod = normalizeProjectionStartPeriod(req.query?.start_period, today);
  const mode = normalizeProjectionMode(req.query?.mode);
  const profile = normalizeProjectionProfile(req.query?.profile);
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
    req.query?.include_credit_cards,
    true,
    "INCLUDE_CREDIT_CARDS_INVALID",
    "include_credit_cards"
  );
  const includeTransfers = parseProjectionBoolean(
    req.query?.include_transfers,
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

  const [accountsResult, cardsResult, transactionsResult] = await Promise.all([
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
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.user_id),
  ]);

  for (const result of [accountsResult, cardsResult, transactionsResult]) {
    if (result.error) throw result.error;
  }

  const accounts = accountsResult.data ?? [];
  const cards = cardsResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
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
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    const transactionId = requireString(
      body.transaction_id,
      "TRANSACTION_ID_REQUIRED",
      "transaction_id is required."
    );
    const paidAt = parseIsoDate(body.paid_at, "INVALID_PAID_DATE", "paid_at");
    if (isFutureDate(paidAt)) {
      throw new ApiError(
        400,
        "INVALID_PAID_DATE",
        "paid_at cannot be in the future."
      );
    }
    const paymentMethod = normalizePaymentMethod(body.payment_method);
    const transaction = await requireOwnedCommonTransaction(
      supabase,
      user.user_id,
      transactionId
    );

    if (body.account_id !== undefined && String(body.account_id ?? "").trim()) {
      await requireOwnedAccount(supabase, user.user_id, body.account_id);
    }

    if (transaction.pago === true) {
      return {
        statusCode: 200,
        body: {
          ok: true,
          status: "already_paid",
          summary: "Esse lanÃƒÂ§amento jÃƒÂ¡ estava marcado como pago.",
          transaction: {
            id: transaction.id,
            paid: true,
          },
        },
      };
    }

    const payload = {
      ...(transaction.payload && typeof transaction.payload === "object"
        ? transaction.payload
        : {}),
      paidAt,
    };

    if (paymentMethod) {
      payload.metodoPagamento = paymentMethod;
    }

    const { data: updated, error } = await supabase
      .from("transactions")
      .update({
        pago: true,
        payload,
      })
      .eq("id", transaction.id)
      .eq("user_id", user.user_id)
      .select("id, tipo, descricao, pago, payload")
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      body: {
        ok: true,
        status: "updated",
        summary: `${typeLabel(updated.tipo)} ${updated.descricao || "lanÃƒÂ§amento"} marcada como paga.`,
        transaction: {
          id: updated.id,
          paid: true,
          paid_at: updated.payload?.paidAt || paidAt,
        },
      },
    };
  });
}

async function handleMarkUnpaid(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
    const transactionId = requireString(
      body.transaction_id,
      "TRANSACTION_ID_REQUIRED",
      "transaction_id is required."
    );
    const transaction = await requireOwnedCommonTransaction(
      supabase,
      user.user_id,
      transactionId
    );

    if (transaction.pago !== true) {
      return {
        statusCode: 200,
        body: {
          ok: true,
          status: "already_unpaid",
          summary: "Esse lanÃƒÂ§amento jÃƒÂ¡ estava marcado como nÃƒÂ£o pago.",
          transaction: {
            id: transaction.id,
            paid: false,
          },
        },
      };
    }

    const payload =
      transaction.payload && typeof transaction.payload === "object"
        ? { ...transaction.payload }
        : {};
    delete payload.paidAt;

    const { data: updated, error } = await supabase
      .from("transactions")
      .update({
        pago: false,
        payload,
      })
      .eq("id", transaction.id)
      .eq("user_id", user.user_id)
      .select("id, pago")
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      body: {
        ok: true,
        status: "updated",
        summary: "LanÃƒÂ§amento marcado como nÃƒÂ£o pago.",
        transaction: {
          id: updated.id,
          paid: false,
        },
      },
    };
  });
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
      "Pela API, a baixa nÃ£o altera valor, conta, data ou categoria. Para editar, acesse o painel FluxMoney."
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
      "Compras no cartÃ£o de crÃ©dito nÃ£o podem ser baixadas por esta action."
    );
  }

  const hasTransferSignal =
    type === "transferencia" ||
    category === "transferencia" ||
    category.includes("transfer") ||
    String(payload?.transferId ?? "").trim() ||
    String(transaction?.transfer_from_id ?? "").trim() ||
    String(transaction?.transfer_to_id ?? "").trim();

  if (hasTransferSignal) {
    throw new ApiError(
      400,
      "TRANSFER_NOT_SETTLEABLE_VIA_API",
      "TransferÃªncias nÃ£o podem ser baixadas por esta action."
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
      "Pagamentos de fatura nÃ£o podem ser baixados por esta action."
    );
  }

  if (type !== "receita" && type !== "despesa") {
    throw new ApiError(
      400,
      "UNSUPPORTED_TRANSACTION_TYPE",
      "Esta action aceita apenas receitas e despesas comuns."
    );
  }
}

async function handleSettleTransaction(req, res, action) {
  await runPostCommand(
    req,
    res,
    action,
    async ({ body, providerMessageId, supabase, user }) => {
      rejectUnsupportedSettlementFields(body);

      if (body.confirmed !== true) {
        throw new ApiError(
          400,
          "CONFIRMATION_REQUIRED",
          "Confirme com o usuÃ¡rio antes de marcar esta transaÃ§Ã£o como paga ou recebida."
        );
      }

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
          "Esta transaÃ§Ã£o nÃ£o possui conta bancÃ¡ria vinculada. Corrija pelo painel FluxMoney antes de baixar pela API."
        );
      }

      if (transaction.pago === true) {
        throw new ApiError(
          409,
          "TRANSACTION_ALREADY_SETTLED",
          "Esta transaÃ§Ã£o jÃ¡ estÃ¡ marcada como paga ou recebida."
        );
      }

      const payload =
        transaction.payload && typeof transaction.payload === "object"
          ? { ...transaction.payload }
          : {};

      payload.settledAt = settlementDate;
      payload.settlementNotes = String(body.notes ?? "").trim();
      payload.settledBy = "whatsapp_api";
      payload.providerMessageId = providerMessageId;

      const { data: updated, error } = await supabase
        .from("transactions")
        .update({
          pago: true,
          payload,
        })
        .eq("id", transaction.id)
        .eq("user_id", user.user_id)
        .select("id, tipo, descricao, valor, data, conta_id, qual_conta, pago, payload")
        .single();

      if (error) throw error;

      const type = String(updated.tipo ?? "").trim().toLowerCase();
      const description = updated.descricao || "lanÃ§amento";

      return {
        statusCode: 200,
        body: {
          ok: true,
          status: "settled",
          summary: `${typeLabel(type)} ${description} marcada como ${settledVerb(type)}.`,
          transaction: {
            id: updated.id,
            type,
            description,
            amount: Number(updated.valor || 0),
            date: updated.data,
            account_id: updated.conta_id || updated.qual_conta || null,
            paid: true,
            settled_at: updated.payload?.settledAt || settlementDate,
          },
        },
      };
    }
  );
}

async function handleCreateInstallments(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
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
        tipoGasto: type === "despesa" ? "fixo" : "",
        recorrenciaId,
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

async function handleCreateTransfer(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
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

    const transferId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `tr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const createdAt = Date.now();
    const effectivePaid = date <= todayIso() ? paid : false;

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
      categoria: "TransferÃªncia",
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
      categoria: "TransferÃªncia",
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

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        summary: `TransferÃªncia ${description} lanÃ§ada com sucesso.`,
        transfer_group: {
          transfer_id: transferId,
          from_account_id: fromAccount.id,
          to_account_id: toAccount.id,
          amount: amountAbs,
          paid: effectivePaid,
        },
        transactions: (created ?? []).map(mapTransactionResponse),
      },
    };
  });
}

async function handleCreateCreditCardPurchase(req, res, action) {
  await runPostCommand(req, res, action, async ({ body, supabase, user }) => {
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
        summary: `Compra ${description} lanÃ§ada no cartÃ£o com sucesso.`,
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
          tipoGasto: "fixo",
          recorrenciaId,
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
          parcelaAtual: installmentNumber,
          totalParcelas: installments,
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
        summary: `Compra ${description} parcelada em ${installments}x lanÃ§ada no cartÃ£o com sucesso.`,
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
        "Para pagar a fatura, informe de qual conta bancÃƒÂ¡ria o valor deve sair."
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
          "Pela API, sÃƒÂ³ ÃƒÂ© permitido pagar o valor total da fatura. Para pagamento parcial, acesse o painel FluxMoney."
        );
      }
    }

    if (remainingAmount <= 0 || status === "PAGA" || status === "ZERADA") {
      throw new ApiError(
        400,
        "INVOICE_ALREADY_PAID",
        "Esta fatura nÃƒÂ£o possui saldo pendente para pagamento."
      );
    }

    if (status !== "FECHADA" && status !== "ATRASADA") {
      throw new ApiError(
        400,
        "INVOICE_NOT_PAYABLE_VIA_API",
        "Esta fatura ainda nÃƒÂ£o estÃƒÂ¡ fechada. Pela API, o pagamento ÃƒÂ© permitido apenas para fatura fechada/atrasada e pelo valor total. Para consultar ou pagar parcialmente, acesse o painel FluxMoney.",
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
          categoria: "CartÃƒÂ£o de CrÃƒÂ©dito",
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
        "NÃƒÂ£o foi possÃƒÂ­vel registrar o pagamento da fatura com seguranÃƒÂ§a. Nenhuma despesa solta foi mantida."
      );
    }

    return {
      statusCode: 201,
      body: {
        ok: true,
        status: "created",
        summary: `Fatura ${card.nome || card.bank_text || "do cartÃƒÂ£o"} paga com sucesso.`,
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
  if (action === "pending_transactions") {
    return handlePendingTransactions(req, res, getSupabaseAdmin());
  }
  if (action === "payable_invoices") {
    return handlePayableInvoices(req, res, getSupabaseAdmin());
  }
  if (action === "financial_projection") {
    return handleFinancialProjection(req, res, getSupabaseAdmin());
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
