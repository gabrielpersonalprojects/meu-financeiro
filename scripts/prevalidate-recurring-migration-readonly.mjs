import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(line))
    .map((line) => {
      const separator = line.indexOf("=");
      return [
        line.slice(0, separator),
        line.slice(separator + 1).replace(/^['"]|['"]$/g, ""),
      ];
    })
);

if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local.");
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PAGE_SIZE = 1000;
const MAX_ROWS = 100000;
const columns =
  "id,user_id,tipo,valor,data,conta_id,cartao_id,transfer_from_id,transfer_to_id,payload";
const rows = [];
let serverCount = null;
let queriesExecuted = 0;
let lastId = "";

// Todas as operacoes remotas deste script sao SELECT paginados e ordenados.
for (;;) {
  const base = supabase.from("transactions");
  const selected =
    queriesExecuted === 0 ? base.select(columns, { count: "exact" }) : base.select(columns);
  let query = selected.order("id", { ascending: true });
  if (lastId) query = query.gt("id", lastId);
  const result = await query.limit(PAGE_SIZE);
  queriesExecuted += 1;

  if (result.error) throw result.error;
  if (queriesExecuted === 1) {
    serverCount = Number(result.count);
    if (!Number.isFinite(serverCount)) {
      throw new Error("The server did not return an exact transaction count.");
    }
    if (serverCount > MAX_ROWS) {
      throw new Error(`Read-only prevalidation limit exceeded: ${serverCount} > ${MAX_ROWS}.`);
    }
  }

  const page = result.data || [];
  rows.push(...page);
  if (rows.length > MAX_ROWS) throw new Error("Read-only prevalidation limit exceeded.");
  if (page.length < PAGE_SIZE) break;
  const nextLastId = String(page.at(-1)?.id || "");
  if (!nextLastId || nextLastId <= lastId) {
    throw new Error("Read-only prevalidation could not advance its transaction cursor.");
  }
  lastId = nextLastId;
}

const resultTruncated = serverCount !== rows.length;
const recurrenceId = (row) => String(row.payload?.recorrenciaId ?? "").trim();
const isRecurring = (row) => String(row.payload?.isRecorrente ?? "false") === "true";
const indexKey = (row) =>
  [
    row.user_id,
    recurrenceId(row),
    row.data,
    row.tipo,
    row.conta_id || "",
    row.cartao_id || "",
  ].join("|");

const indexedRows = rows.filter((row) => isRecurring(row) && recurrenceId(row));
const indexCounts = new Map();
for (const row of indexedRows) {
  const key = indexKey(row);
  indexCounts.set(key, (indexCounts.get(key) || 0) + 1);
}
const duplicateGroups = [...indexCounts.values()].filter((count) => count > 1);
const incompleteKeys = rows.filter(
  (row) =>
    isRecurring(row) &&
    (!recurrenceId(row) ||
      !row.user_id ||
      !row.data ||
      !row.tipo ||
      (!row.conta_id && !row.cartao_id))
).length;

const series = new Map();
const renewableRows = indexedRows.filter(
  (row) => String(row.payload?.recurrenceKind || "") === "sem_prazo"
);
for (const row of renewableRows) {
  const key = `${row.user_id}|${recurrenceId(row)}`;
  if (!series.has(key)) series.set(key, []);
  series.get(key).push(row);
}
const inconsistentSeries = [];
for (const [key, group] of series) {
  const origins = [...new Set(group.map((row) => String(row.payload?.recurrenceOriginDate || "")))];
  const kinds = [...new Set(group.map((row) => String(row.payload?.recurrenceKind || "")))];
  const statuses = [...new Set(group.map((row) => String(row.payload?.recurrenceStatus || "ativa")))];
  if (
    origins.length !== 1 ||
    !origins[0] ||
    kinds.length !== 1 ||
    statuses.length !== 1 ||
    group.some((row) => !row.data || !Number.isFinite(Number(row.valor)))
  ) {
    const separator = key.indexOf("|");
    inconsistentSeries.push({
      user_id: key.slice(0, separator),
      recurrence_id: key.slice(separator + 1),
      row_count: group.length,
      origins,
      kinds,
      statuses,
    });
  }
}

function movementGroups(field) {
  const groups = new Map();
  for (const row of rows) {
    const value = String(row.payload?.[field] || "").trim();
    if (!value) continue;
    const key = `${row.user_id}|${value}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

function countOrphans(groups) {
  return [...groups.values()].filter(
    (group) =>
      group.length !== 2 ||
      !group.some((row) => Number(row.valor) < 0) ||
      !group.some((row) => Number(row.valor) > 0)
  ).length;
}

const orphanLinked = countOrphans(movementGroups("linkedMovementId"));
const orphanInternal = countOrphans(movementGroups("transferId"));
console.log(
  JSON.stringify(
    {
      query: "paginated read-only SELECT via PostgREST",
      queries_executed: queriesExecuted,
      server_count: serverCount,
      rows_received: rows.length,
      result_truncated: resultTruncated,
      migration_duplicate_groups: duplicateGroups.length,
      migration_duplicate_rows: duplicateGroups.reduce((sum, count) => sum + count, 0),
      recurring_null_or_incomplete_keys: incompleteKeys,
      inconsistent_series: inconsistentSeries.length,
      inconsistent_series_details: inconsistentSeries,
      orphan_linked_movement_groups: orphanLinked,
      orphan_internal_transfer_groups: orphanInternal,
      migration_blocked: duplicateGroups.length > 0 || resultTruncated,
      cron_blocked:
        duplicateGroups.length > 0 ||
        incompleteKeys > 0 ||
        inconsistentSeries.length > 0 ||
        resultTruncated,
    },
    null,
    2
  )
);
