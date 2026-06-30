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

async function resolveGetUser(supabase, req) {
  const whatsappPhone = requireString(
    req.query?.whatsapp_phone,
    "WHATSAPP_PHONE_REQUIRED",
    "whatsapp_phone query parameter is required."
  );
  return resolveWhatsappUser(supabase, whatsappPhone);
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

  json(res, 200, {
    ok: true,
    transactions: (data ?? []).map((row) => ({
      id: row.id,
      type: row.tipo,
      amount: Number(row.valor || 0),
      date: row.data,
      description: row.descricao || "",
      category: row.categoria || "",
      tag: row.tag || "",
      account_id: row.conta_id || row.qual_conta || null,
      paid: Boolean(row.pago),
    })),
  });
}

async function handlePayableInvoices(req, res, supabase) {
  requireMethod(req, "GET");
  const user = await resolveGetUser(supabase, req);

  const [cardsResult, txResult, paymentsResult, manualStatusResult] =
    await Promise.all([
      supabase
        .from("credit_cards")
        .select("id, nome, dia_fechamento, dia_vencimento, is_active")
        .eq("user_id", user.user_id),
      supabase
        .from("transactions")
        .select("id, tipo, valor, data, descricao, categoria, cartao_id, pago, payload")
        .eq("user_id", user.user_id)
        .eq("tipo", "cartao_credito"),
      supabase
        .from("invoice_payments")
        .select("credit_card_id, ciclo_key, amount")
        .eq("user_id", user.user_id),
      supabase
        .from("invoice_manual_status")
        .select("cartao_id, ciclo_key, status_manual")
        .eq("user_id", user.user_id),
    ]);

  for (const result of [cardsResult, txResult, paymentsResult, manualStatusResult]) {
    if (result.error) throw result.error;
  }

  const cardsById = new Map(
    (cardsResult.data ?? []).map((card) => [String(card.id), card])
  );
  const paidRefs = new Set(
    (manualStatusResult.data ?? [])
      .filter((row) => String(row?.status_manual ?? "") === "paga")
      .map((row) => `${row.cartao_id}:${row.ciclo_key}`)
  );
  const paymentTotals = new Map();

  for (const payment of paymentsResult.data ?? []) {
    const ref = `${payment.credit_card_id}:${payment.ciclo_key}`;
    paymentTotals.set(ref, (paymentTotals.get(ref) || 0) + Number(payment.amount || 0));
  }

  const invoices = new Map();

  for (const tx of txResult.data ?? []) {
    const cardId = String(tx.cartao_id || tx?.payload?.cartaoId || tx?.payload?.qualCartao || "").trim();
    const card = cardsById.get(cardId);
    if (!card || card.is_active === false) continue;

    const invoiceMonth = getInvoiceMonth(tx.data, card.dia_fechamento);
    if (!invoiceMonth) continue;

    const invoiceRef = `${cardId}:${invoiceMonth}`;
    const current = invoices.get(invoiceRef) ?? {
      invoice_ref: invoiceRef,
      credit_card_id: cardId,
      credit_card_name: card.nome || "",
      invoice_month: invoiceMonth,
      due_date: invoiceDueDate(invoiceMonth, card.dia_vencimento),
      amount: 0,
      transaction_count: 0,
    };

    current.amount += Math.abs(Number(tx.valor || 0));
    current.transaction_count += 1;
    invoices.set(invoiceRef, current);
  }

  const today = todayIso();
  const payable = Array.from(invoices.values())
    .filter((invoice) => invoice.amount > 0)
    .map((invoice) => {
      const paidAmount = Number(paymentTotals.get(invoice.invoice_ref) || 0);
      return {
        ...invoice,
        paid_amount: paidAmount,
        remaining_amount: Math.max(0, invoice.amount - paidAmount),
        status: invoice.due_date && invoice.due_date < today ? "overdue" : "closed",
      };
    })
    .filter((invoice) => {
      if (paidRefs.has(invoice.invoice_ref)) return false;
      if (invoice.remaining_amount <= 0) return false;
      return invoice.due_date && invoice.due_date <= today;
    })
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

  json(res, 200, {
    ok: true,
    representation: {
      invoice_id_available: false,
      invoice_ref_format: "credit_card_id:YYYY-MM",
    },
    invoices: payable,
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
    execute: () => execute({ body, supabase, user }),
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
          summary: "Esse lanÃ§amento jÃ¡ estava marcado como pago.",
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
        summary: `${typeLabel(updated.tipo)} ${updated.descricao || "lanÃ§amento"} marcada como paga.`,
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
          summary: "Esse lanÃ§amento jÃ¡ estava marcado como nÃ£o pago.",
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
        summary: "LanÃ§amento marcado como nÃ£o pago.",
        transaction: {
          id: updated.id,
          paid: false,
        },
      },
    };
  });
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
  if (action === "create_installments") {
    return handleCreateInstallments(req, res, action);
  }

  throw new ApiError(400, "INVALID_ACTION", "action is not supported.");
});
