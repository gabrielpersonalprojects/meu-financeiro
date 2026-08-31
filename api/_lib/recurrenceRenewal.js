const crypto = require("crypto");
const { ApiError } = require("./http");
const { addMonthsLikeUi, SEM_PRAZO_MONTHS } = require("./transactionsCommon");

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_SOURCE_ROWS = 50000;
const DEFAULT_MAX_SERIES_PER_RUN = 25;
const DEFAULT_MAX_CREATED_TRANSACTIONS = 600;
const DEFAULT_TIMEOUT_MS = 45000;
const TRANSACTION_SELECT = [
  "id",
  "user_id",
  "tipo",
  "valor",
  "data",
  "descricao",
  "categoria",
  "tag",
  "pago",
  "conta_id",
  "conta_origem_id",
  "conta_destino_id",
  "cartao_id",
  "transfer_from_id",
  "transfer_to_id",
  "qual_conta",
  "criado_em",
  "payload",
].join(",");

function recurrenceIdOf(row) {
  return String(row?.payload?.recorrenciaId ?? row?.recorrenciaId ?? "").trim();
}

function isRecurringValue(value) {
  return String(value ?? "false") === "true";
}

function isRenewable(row) {
  const payload = row?.payload || {};
  return Boolean(
    recurrenceIdOf(row) &&
      isRecurringValue(payload.isRecorrente) &&
      String(payload.recurrenceKind || "") === "sem_prazo" &&
      String(payload.recurrenceStatus || "ativa") === "ativa" &&
      !payload.recurrenceCanceledAt
  );
}

function invoiceMonth(dateIso, closingDay, dueDay) {
  const [year, month, day] = String(dateIso).split("-").map(Number);
  const closing = Math.max(1, Math.min(31, Number(closingDay || 1)));
  const due = Math.max(1, Math.min(31, Number(dueDay || 1)));
  const base = new Date(year, month - 1, 1, 12, 0, 0, 0);
  if (day >= closing) base.setMonth(base.getMonth() + 1);
  if (due <= closing) base.setMonth(base.getMonth() + 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
}

function buildRenewalRows(group, cardById, months = SEM_PRAZO_MONTHS) {
  const sorted = [...group].sort((a, b) => String(a.data).localeCompare(String(b.data)));
  const latestDate = String(sorted.at(-1)?.data || "");
  const templates = sorted.filter((row) => String(row.data) === latestDate);
  const originDate = String(templates[0]?.payload?.recurrenceOriginDate || sorted[0]?.data || "");
  const existingDates = new Set(sorted.map((row) => String(row.data)));
  const startOffset =
    (Number(latestDate.slice(0, 4)) - Number(originDate.slice(0, 4))) * 12 +
    Number(latestDate.slice(5, 7)) -
    Number(originDate.slice(5, 7)) +
    1;
  const dates = Array.from({ length: months }, (_, index) =>
    addMonthsLikeUi(originDate, startOffset + index)
  ).filter((date) => !existingDates.has(date));
  const windowEnd = dates.at(-1) || latestDate;
  const now = Date.now();
  const actionAt = new Date(now).toISOString();

  return dates.flatMap((date, dateIndex) => {
    const linkedMovementId = `mov_${crypto.randomUUID()}`;
    return templates.map((template, legIndex) => {
      const payload = { ...(template.payload || {}) };
      payload.recurrenceWindowStart = dates[0] || date;
      payload.recurrenceWindowEnd = windowEnd;
      payload.recurrenceWindowMonths = months;
      payload.recurrenceStatus = "ativa";
      payload.recurrenceRenewalDecision = "renovada_automaticamente";
      payload.recurrenceLastActionAt = actionAt;
      if (payload.movementKind === "pf_pj") payload.linkedMovementId = linkedMovementId;
      if (template.cartao_id) {
        const card = cardById.get(String(template.cartao_id));
        payload.faturaMes = invoiceMonth(date, card?.dia_fechamento, card?.dia_vencimento);
      }
      return {
        user_id: template.user_id,
        tipo: template.tipo,
        valor: template.valor,
        data: date,
        descricao: template.descricao,
        categoria: template.categoria || "",
        tag: template.tag || "",
        pago: false,
        conta_id: template.conta_id,
        conta_origem_id: template.conta_origem_id,
        conta_destino_id: template.conta_destino_id,
        cartao_id: template.cartao_id,
        transfer_from_id: template.transfer_from_id || "",
        transfer_to_id: template.transfer_to_id || "",
        qual_conta: template.qual_conta,
        criado_em: now + dateIndex * templates.length + legIndex,
        payload,
      };
    });
  });
}

function positiveInteger(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
}

function timeoutError(label) {
  return new ApiError(
    503,
    "RECURRING_RENEWAL_TIMEOUT",
    `Automatic recurrence renewal timed out during ${label}. A retry is safe.`
  );
}

async function withDeadline(operation, deadlineAt, label) {
  const remaining = deadlineAt - Date.now();
  if (remaining <= 0) throw timeoutError(label);

  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(timeoutError(label)), remaining);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchRecurringRows({ supabase, pageSize, maxSourceRows, deadlineAt }) {
  const rows = [];
  let pageCount = 0;
  let expectedCount = null;
  let lastId = "";

  for (;;) {
    const queryBase = supabase.from("transactions");
    const selected =
      pageCount === 0
        ? queryBase.select(TRANSACTION_SELECT, { count: "exact" })
        : queryBase.select(TRANSACTION_SELECT);
    let query = selected
      .eq("payload->>recurrenceKind", "sem_prazo")
      .order("id", { ascending: true });
    if (lastId) query = query.gt("id", lastId);
    query = query.limit(pageSize);
    const result = await withDeadline(() => query, deadlineAt, "transaction scan");
    if (result.error) throw result.error;

    pageCount += 1;
    if (pageCount === 1 && result.count !== null && result.count !== undefined) {
      expectedCount = Number(result.count);
      if (!Number.isFinite(expectedCount)) expectedCount = null;
      if (expectedCount !== null && expectedCount > maxSourceRows) {
        throw new ApiError(
          503,
          "RECURRING_SOURCE_LIMIT_EXCEEDED",
          "Automatic recurrence renewal source limit was exceeded; no transactions were created."
        );
      }
    }

    const page = result.data || [];
    rows.push(...page);
    if (rows.length > maxSourceRows) {
      throw new ApiError(
        503,
        "RECURRING_SOURCE_LIMIT_EXCEEDED",
        "Automatic recurrence renewal source limit was exceeded; no transactions were created."
      );
    }
    if (page.length < pageSize) break;
    const nextLastId = String(page.at(-1)?.id || "");
    if (!nextLastId || nextLastId <= lastId) {
      throw new ApiError(
        503,
        "RECURRING_SOURCE_SCAN_INCOMPLETE",
        "Automatic recurrence renewal could not advance its source cursor; no transactions were created."
      );
    }
    lastId = nextLastId;
  }

  if (expectedCount !== null && rows.length !== expectedCount) {
    throw new ApiError(
      503,
      "RECURRING_SOURCE_SCAN_INCOMPLETE",
      "Automatic recurrence renewal did not receive the complete source set; no transactions were created."
    );
  }

  return { rows, pageCount };
}

function seriesIndexKey(row) {
  return [
    row?.user_id,
    recurrenceIdOf(row),
    row?.data,
    row?.tipo,
    row?.conta_id || "",
    row?.cartao_id || "",
  ].join("|");
}

function analyzeSeries(group) {
  const origins = new Set(
    group.map((row) => String(row?.payload?.recurrenceOriginDate || "").trim())
  );
  const kinds = new Set(group.map((row) => String(row?.payload?.recurrenceKind || "")));
  const statuses = new Set(
    group.map((row) => String(row?.payload?.recurrenceStatus || "ativa"))
  );
  const indexKeys = group.map(seriesIndexKey);
  const invalidRow = group.some(
    (row) =>
      !row?.user_id ||
      !row?.data ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(row.data)) ||
      !Number.isFinite(Number(row?.valor)) ||
      !isRecurringValue(row?.payload?.isRecorrente)
  );

  if (
    invalidRow ||
    origins.size !== 1 ||
    ![...origins][0] ||
    kinds.size !== 1 ||
    !kinds.has("sem_prazo") ||
    statuses.size !== 1 ||
    new Set(indexKeys).size !== indexKeys.length
  ) {
    return { status: "inconsistent" };
  }

  if (
    statuses.has("cancelada") ||
    group.some((row) => Boolean(row?.payload?.recurrenceCanceledAt))
  ) {
    return { status: "cancelled" };
  }
  if (!statuses.has("ativa")) return { status: "inactive" };

  const latestDate = group.map((row) => String(row.data)).sort().at(-1) || "";
  const latestRows = group.filter((row) => String(row.data) === latestDate);
  const isPfPj = group.some((row) => row?.payload?.movementKind === "pf_pj");

  if (isPfPj) {
    const directions = new Set(
      latestRows.map((row) => String(row?.payload?.linkedMovementDirection || ""))
    );
    const validLegs =
      latestRows.length === 2 &&
      latestRows.every((row) => row?.payload?.movementKind === "pf_pj") &&
      directions.has("saida") &&
      directions.has("entrada") &&
      latestRows.some((row) => Number(row.valor) < 0) &&
      latestRows.some((row) => Number(row.valor) > 0);
    if (!validLegs) return { status: "inconsistent" };
  } else if (latestRows.length !== 1) {
    return { status: "inconsistent" };
  }

  return { status: "active", latestDate };
}

async function fetchCardsByIds({ supabase, cardIds, deadlineAt }) {
  const cardById = new Map();
  for (let index = 0; index < cardIds.length; index += 100) {
    const ids = cardIds.slice(index, index + 100);
    const query = supabase
      .from("credit_cards")
      .select("id,dia_fechamento,dia_vencimento")
      .in("id", ids);
    const result = await withDeadline(() => query, deadlineAt, "credit-card lookup");
    if (result.error) throw result.error;
    for (const card of result.data || []) cardById.set(String(card.id), card);
  }
  return cardById;
}

async function insertBatch({ supabase, rows, deadlineAt }) {
  const query = supabase.from("transactions").insert(rows).select("id");
  return withDeadline(() => query, deadlineAt, "transaction insert");
}

async function insertRowsIdempotently({ supabase, rows, deadlineAt }) {
  const first = await insertBatch({ supabase, rows, deadlineAt });
  if (!first.error) return { created: (first.data || []).length, conflicts: 0 };
  if (String(first.error.code) !== "23505") throw first.error;

  let created = 0;
  let conflicts = 0;
  const byDate = new Map();
  for (const row of rows) {
    const date = String(row.data);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(row);
  }

  for (const dateRows of byDate.values()) {
    const dateResult = await insertBatch({ supabase, rows: dateRows, deadlineAt });
    if (!dateResult.error) {
      created += (dateResult.data || []).length;
      continue;
    }
    if (String(dateResult.error.code) !== "23505") throw dateResult.error;

    if (dateRows.length === 1) {
      conflicts += 1;
      continue;
    }
    for (const row of dateRows) {
      const rowResult = await insertBatch({ supabase, rows: [row], deadlineAt });
      if (!rowResult.error) created += (rowResult.data || []).length;
      else if (String(rowResult.error.code) === "23505") conflicts += 1;
      else throw rowResult.error;
    }
  }

  return { created, conflicts };
}

async function renewOpenEndedRecurrences(options) {
  const {
    supabase,
    today,
    months = SEM_PRAZO_MONTHS,
    pageSize = DEFAULT_PAGE_SIZE,
    maxSourceRows = DEFAULT_MAX_SOURCE_ROWS,
    maxSeriesPerRun = DEFAULT_MAX_SERIES_PER_RUN,
    maxCreatedTransactions = DEFAULT_MAX_CREATED_TRANSACTIONS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options || {};
  const safePageSize = positiveInteger(pageSize, DEFAULT_PAGE_SIZE, 1000);
  const safeMaxSourceRows = positiveInteger(maxSourceRows, DEFAULT_MAX_SOURCE_ROWS, 200000);
  const safeMaxSeries = positiveInteger(maxSeriesPerRun, DEFAULT_MAX_SERIES_PER_RUN, 500);
  const safeMaxCreated = positiveInteger(
    maxCreatedTransactions,
    DEFAULT_MAX_CREATED_TRANSACTIONS,
    12000
  );
  const safeTimeoutMs = positiveInteger(timeoutMs, DEFAULT_TIMEOUT_MS, 55000);
  const deadlineAt = Date.now() + safeTimeoutMs;

  const source = await fetchRecurringRows({
    supabase,
    pageSize: safePageSize,
    maxSourceRows: safeMaxSourceRows,
    deadlineAt,
  });
  const groups = new Map();
  let skippedInvalidRows = 0;
  for (const row of source.rows) {
    const recurrenceId = recurrenceIdOf(row);
    if (!recurrenceId || !row?.user_id) {
      skippedInvalidRows += 1;
      continue;
    }
    const key = `${row.user_id}:${recurrenceId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const dueSeries = [];
  let inconsistentSeries = 0;
  let cancelledSeries = 0;
  let inactiveSeries = 0;
  for (const [key, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const analysis = analyzeSeries(group);
    if (analysis.status === "inconsistent") {
      inconsistentSeries += 1;
      continue;
    }
    if (analysis.status === "cancelled") {
      cancelledSeries += 1;
      continue;
    }
    if (analysis.status === "inactive") {
      inactiveSeries += 1;
      continue;
    }
    if (analysis.latestDate && analysis.latestDate <= today) dueSeries.push({ key, group });
  }

  const dueCardIds = [
    ...new Set(
      dueSeries
        .flatMap(({ group }) => group.map((row) => row.cartao_id))
        .filter(Boolean)
        .map(String)
    ),
  ];
  const cardById = await fetchCardsByIds({ supabase, cardIds: dueCardIds, deadlineAt });

  let createdCount = 0;
  let plannedCount = 0;
  let processedSeries = 0;
  let renewedSeries = 0;
  let deferredSeries = 0;
  let missingCardSeries = 0;
  let conflictCount = 0;

  for (const { group } of dueSeries) {
    if (processedSeries >= safeMaxSeries) {
      deferredSeries += 1;
      continue;
    }

    const cardIds = [...new Set(group.map((row) => row.cartao_id).filter(Boolean).map(String))];
    if (cardIds.some((id) => !cardById.has(id))) {
      missingCardSeries += 1;
      continue;
    }

    const rows = buildRenewalRows(group, cardById, months);
    if (!rows.length) continue;
    if (plannedCount + rows.length > safeMaxCreated) {
      deferredSeries += 1;
      continue;
    }

    plannedCount += rows.length;
    processedSeries += 1;
    const inserted = await insertRowsIdempotently({ supabase, rows, deadlineAt });
    createdCount += inserted.created;
    conflictCount += inserted.conflicts;
    if (inserted.created > 0) renewedSeries += 1;
  }

  return {
    scanned_rows: source.rows.length,
    scan_pages: source.pageCount,
    scanned_series: groups.size,
    due_series: dueSeries.length,
    processed_series: processedSeries,
    renewed_series: renewedSeries,
    deferred_series: deferredSeries,
    created_transactions: createdCount,
    duplicate_conflicts_ignored: conflictCount,
    skipped_inconsistent_series: inconsistentSeries,
    skipped_cancelled_series: cancelledSeries,
    skipped_inactive_series: inactiveSeries,
    skipped_missing_card_series: missingCardSeries,
    skipped_invalid_rows: skippedInvalidRows,
    has_more: deferredSeries > 0,
  };
}

module.exports = {
  analyzeSeries,
  buildRenewalRows,
  fetchRecurringRows,
  isRenewable,
  renewOpenEndedRecurrences,
};
