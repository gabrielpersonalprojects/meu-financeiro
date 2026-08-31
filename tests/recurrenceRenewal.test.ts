import assert from "node:assert/strict";
import test from "node:test";

const {
  analyzeSeries,
  buildRenewalRows,
  isRenewable,
  renewOpenEndedRecurrences,
} = require("../api/_lib/recurrenceRenewal");

const base = {
  id: "tx-1",
  user_id: "user-1",
  tipo: "despesa",
  valor: -100,
  data: "2026-01-31",
  descricao: "Mensal",
  categoria: "Moradia",
  pago: true,
  conta_id: "account-1",
  qual_conta: "account-1",
  payload: {
    tipoGasto: "fixo",
    recorrenciaId: "rec-1",
    isRecorrente: true,
    recurrenceKind: "sem_prazo",
    recurrenceOriginDate: "2026-01-31",
    recurrenceStatus: "ativa",
  },
};

test("automatic renewal creates only the missing safe monthly window", () => {
  const existing = Array.from({ length: 12 }, (_, index) => ({
    ...base,
    id: `tx-${index + 1}`,
    data: require("../api/_lib/transactionsCommon").addMonthsLikeUi("2026-01-31", index),
    pago: index === 0,
  }));
  const rows = buildRenewalRows(existing, new Map(), 3);
  assert.deepEqual(rows.map((row: any) => row.data), ["2027-01-31", "2027-02-28", "2027-03-31"]);
  assert.ok(rows.every((row: any) => row.pago === false));
  assert.ok(rows.every((row: any) => row.payload.recorrenciaId === "rec-1"));
});

test("cancelled open-ended series is not renewable", () => {
  assert.equal(isRenewable(base), true);
  assert.equal(isRenewable({ ...base, payload: { ...base.payload, recurrenceStatus: "cancelada" } }), false);
  assert.equal(isRenewable({ ...base, payload: { ...base.payload, recurrenceCanceledAt: "2026-08-26" } }), false);
});

function uniqueKey(row: any) {
  if (String(row?.payload?.isRecorrente ?? "false") !== "true") return "";
  const recurrenceId = String(row?.payload?.recorrenciaId || "");
  if (!recurrenceId) return "";
  return [
    row.user_id,
    recurrenceId,
    row.data,
    row.tipo,
    row.conta_id || "",
    row.cartao_id || "",
  ].join("|");
}

function createSupabase(initialTransactions: any[], options: any = {}) {
  const transactions = initialTransactions.map((row) => ({ ...row, payload: { ...(row.payload || {}) } }));
  const cards = options.cards || [];
  let insertCalls = 0;

  const from = (table: string) => {
    const state: any = {
      operation: "",
      filters: [],
      gtFilters: [],
      inFilters: [],
      limit: null,
      countExact: false,
      insertRows: [],
    };
    const builder: any = {};

    builder.select = (_columns: string, selectOptions?: any) => {
      if (!state.operation) state.operation = "select";
      state.countExact = state.countExact || selectOptions?.count === "exact";
      return builder;
    };
    builder.eq = (field: string, value: any) => {
      state.filters.push([field, value]);
      return builder;
    };
    builder.in = (field: string, values: any[]) => {
      state.inFilters.push([field, values.map(String)]);
      return builder;
    };
    builder.gt = (field: string, value: any) => {
      state.gtFilters.push([field, value]);
      return builder;
    };
    builder.order = () => builder;
    builder.limit = (count: number) => {
      state.limit = count;
      return builder;
    };
    builder.insert = (rows: any[]) => {
      state.operation = "insert";
      state.insertRows = rows.map((row) => ({ ...row, payload: { ...(row.payload || {}) } }));
      return builder;
    };

    const execute = async () => {
      if (options.hangSelect && state.operation === "select" && table === "transactions") {
        return new Promise(() => {});
      }
      if (state.operation === "insert") {
        insertCalls += 1;
        if (options.conflictFirstInsert && insertCalls === 1) {
          state.insertRows.forEach((row: any, index: number) =>
            transactions.push({ ...row, id: `concurrent-${index}` })
          );
          return { data: null, error: { code: "23505" } };
        }

        const existingKeys = new Set(transactions.map(uniqueKey).filter(Boolean));
        const hasConflict = state.insertRows.some((row: any) => {
          const key = uniqueKey(row);
          return key && existingKeys.has(key);
        });
        if (hasConflict) return { data: null, error: { code: "23505" } };

        const inserted = state.insertRows.map((row: any, index: number) => ({
          ...row,
          id: `inserted-${insertCalls}-${index}`,
        }));
        transactions.push(...inserted);
        return { data: inserted.map((row: any) => ({ id: row.id })), error: null };
      }

      let rows = table === "transactions" ? [...transactions] : [...cards];
      for (const [field, value] of state.filters) {
        rows = rows.filter((row: any) => {
          if (field === "payload->>recurrenceKind") {
            return String(row?.payload?.recurrenceKind || "") === String(value);
          }
          return String(row?.[field]) === String(value);
        });
      }
      for (const [field, values] of state.inFilters) {
        rows = rows.filter((row: any) => values.includes(String(row?.[field])));
      }
      for (const [field, value] of state.gtFilters) {
        rows = rows.filter((row: any) => String(row?.[field]) > String(value));
      }
      rows.sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)));
      const count = rows.length;
      if (state.limit) rows = rows.slice(0, state.limit);
      return { data: rows, error: null, count: state.countExact ? count : null };
    };

    builder.then = (resolve: any, reject: any) => execute().then(resolve, reject);
    return builder;
  };

  return { from, transactions };
}

function seriesRow(index: number, overrides: any = {}) {
  const recurrenceId = overrides.recurrenceId || `rec-${index}`;
  const date = overrides.data || "2030-01-01";
  return {
    ...base,
    id: `tx-${String(index).padStart(5, "0")}`,
    data: date,
    payload: {
      ...base.payload,
      recorrenciaId: recurrenceId,
      recurrenceOriginDate: overrides.origin || date,
      ...(overrides.payload || {}),
    },
    ...overrides.row,
  };
}

test("renewal paginates past the PostgREST 1000-row ceiling", async () => {
  const rows = Array.from({ length: 1002 }, (_, index) => seriesRow(index + 1));
  const supabase = createSupabase(rows);
  const result = await renewOpenEndedRecurrences({
    supabase,
    today: "2026-08-26",
    pageSize: 1000,
  });

  assert.equal(result.scanned_rows, 1002);
  assert.equal(result.scan_pages, 2);
  assert.equal(result.scanned_series, 1002);
  assert.equal(result.created_transactions, 0);
});

test("renewal enforces deterministic per-run series and transaction limits", async () => {
  const rows = [1, 2, 3].map((index) =>
    seriesRow(index, { data: "2025-01-31", origin: "2025-01-31" })
  );
  const supabase = createSupabase(rows);
  const result = await renewOpenEndedRecurrences({
    supabase,
    today: "2026-08-26",
    months: 1,
    maxSeriesPerRun: 1,
    maxCreatedTransactions: 1,
  });

  assert.equal(result.due_series, 3);
  assert.equal(result.processed_series, 1);
  assert.equal(result.deferred_series, 2);
  assert.equal(result.created_transactions, 1);
  assert.equal(result.has_more, true);
});

test("23505 concurrency conflicts are recovered without duplicate occurrences", async () => {
  const supabase = createSupabase(
    [seriesRow(1, { data: "2025-01-31", origin: "2025-01-31" })],
    { conflictFirstInsert: true }
  );
  const result = await renewOpenEndedRecurrences({
    supabase,
    today: "2026-08-26",
    months: 2,
  });

  assert.equal(result.created_transactions, 0);
  assert.equal(result.duplicate_conflicts_ignored, 2);
  assert.equal(supabase.transactions.length, 3);
  assert.equal(new Set(supabase.transactions.map(uniqueKey)).size, 3);
});

test("inconsistent series are reported and never written", async () => {
  const first = seriesRow(1, {
    recurrenceId: "same-series",
    data: "2025-01-31",
    origin: "2025-01-31",
  });
  const second = seriesRow(2, {
    recurrenceId: "same-series",
    data: "2025-02-28",
    origin: "2025-02-01",
  });
  assert.equal(analyzeSeries([first, second]).status, "inconsistent");

  const supabase = createSupabase([first, second]);
  const result = await renewOpenEndedRecurrences({ supabase, today: "2026-08-26" });
  assert.equal(result.skipped_inconsistent_series, 1);
  assert.equal(result.created_transactions, 0);
  assert.equal(supabase.transactions.length, 2);
});

test("source limit fails closed before any transaction is created", async () => {
  const supabase = createSupabase([seriesRow(1), seriesRow(2), seriesRow(3)]);
  await assert.rejects(
    renewOpenEndedRecurrences({
      supabase,
      today: "2031-01-01",
      maxSourceRows: 2,
    }),
    (error: any) => error?.code === "RECURRING_SOURCE_LIMIT_EXCEEDED"
  );
  assert.equal(supabase.transactions.length, 3);
});

test("explicit timeout aborts the run with a retry-safe error", async () => {
  const supabase = createSupabase([], { hangSelect: true });
  await assert.rejects(
    renewOpenEndedRecurrences({
      supabase,
      today: "2026-08-26",
      timeoutMs: 5,
    }),
    (error: any) => error?.code === "RECURRING_RENEWAL_TIMEOUT"
  );
});
