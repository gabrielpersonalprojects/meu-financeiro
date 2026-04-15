import { supabase } from "../lib/supabase";

type FindExistingStatementImportSourceHashesParams = {
  userId: string;
  mode: "conta" | "cartao";
  targetAccountId?: string | null;
  targetCreditCardId?: string | null;
  sourceHashes: string[];
};

export async function findExistingStatementImportSourceHashes({
  userId,
  mode,
  targetAccountId,
  targetCreditCardId,
  sourceHashes,
}: FindExistingStatementImportSourceHashesParams) {
  const hashes = Array.from(
    new Set(
      (sourceHashes ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );

  if (!userId || !hashes.length) {
    return new Set<string>();
  }

  let query = supabase
    .from("statement_import_entries")
    .select("source_hash, transaction_id")
    .eq("user_id", userId)
    .eq("mode", mode)
    .in("source_hash", hashes);

  if (mode === "conta") {
    query = query.eq("target_account_id", String(targetAccountId ?? "").trim());
  } else {
    query = query.eq(
      "target_credit_card_id",
      String(targetCreditCardId ?? "").trim()
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];

  const transactionIds = Array.from(
    new Set(
      rows
        .map((row: any) => String(row?.transaction_id ?? "").trim())
        .filter(Boolean)
    )
  );

  if (!transactionIds.length) {
    return new Set<string>();
  }

  const { data: activeTransactions, error: activeTransactionsError } =
    await supabase
      .from("transactions")
      .select("id")
      .in("id", transactionIds);

  if (activeTransactionsError) {
    throw activeTransactionsError;
  }

  const activeTransactionIds = new Set(
    (activeTransactions ?? [])
      .map((row: any) => String(row?.id ?? "").trim())
      .filter(Boolean)
  );

  return new Set(
    rows
      .filter((row: any) =>
        activeTransactionIds.has(String(row?.transaction_id ?? "").trim())
      )
      .map((row: any) => String(row?.source_hash ?? "").trim())
      .filter(Boolean)
  );
}

type InsertStatementImportEntriesParams = {
  batchId: string;
  userId: string;
  mode: "conta" | "cartao";
  targetAccountId?: string | null;
  targetCreditCardId?: string | null;
  entries: Array<{
    sourceLineIndex: number;
    sourceHash: string;
    occurredOn: string;
    description: string;
    amountCents: number;
    direction: "entrada" | "saida";
    category: string;
    transactionId?: string | null;
    wasImported?: boolean;
    wasDuplicate?: boolean;
    wasInvalid?: boolean;
    invalidReason?: string | null;
    rawPayload?: Record<string, any>;
    normalizedPayload?: Record<string, any>;
  }>;
};

export async function insertStatementImportEntries({
  batchId,
  userId,
  mode,
  targetAccountId,
  targetCreditCardId,
  entries,
}: InsertStatementImportEntriesParams) {
  const rows = (entries ?? []).map((entry) => ({
    batch_id: batchId,
    user_id: userId,
    mode,
    target_account_id:
      mode === "conta"
        ? String(targetAccountId ?? "").trim() || null
        : null,
    target_credit_card_id:
      mode === "cartao"
        ? String(targetCreditCardId ?? "").trim() || null
        : null,
    source_line_index: Number(entry.sourceLineIndex),
    source_hash: String(entry.sourceHash ?? "").trim(),
    occurred_on: String(entry.occurredOn ?? "").trim(),
    description: String(entry.description ?? "").trim(),
    amount_cents: Number(entry.amountCents || 0),
    direction: entry.direction,
    category: String(entry.category ?? "").trim(),
    transaction_id: String(entry.transactionId ?? "").trim() || null,
    was_imported: entry.wasImported ?? true,
    was_duplicate: entry.wasDuplicate ?? false,
    was_invalid: entry.wasInvalid ?? false,
    invalid_reason: entry.invalidReason ?? null,
    raw_payload: entry.rawPayload ?? {},
    normalized_payload: entry.normalizedPayload ?? {},
  }));

  if (!rows.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("statement_import_entries")
    .insert(rows)
    .select("*");

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function clearStatementImportEntryTransactionLink(
  userId: string,
  transactionId: string
) {
  const safeUserId = String(userId ?? "").trim();
  const safeTransactionId = String(transactionId ?? "").trim();

  if (!safeUserId || !safeTransactionId) {
    return;
  }

  const { error } = await supabase
    .from("statement_import_entries")
    .update({ transaction_id: null })
    .eq("user_id", safeUserId)
    .eq("transaction_id", safeTransactionId);

  if (error) {
    throw error;
  }
}

export async function findStatementImportEntriesBySourceHashes({
  userId,
  mode,
  targetAccountId,
  targetCreditCardId,
  sourceHashes,
}: {
  userId: string;
  mode: "conta" | "cartao";
  targetAccountId?: string | null;
  targetCreditCardId?: string | null;
  sourceHashes: string[];
}) {
  const hashes = Array.from(
    new Set(
      (sourceHashes ?? [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );

  if (!userId || !hashes.length) {
    return [];
  }

  let query = supabase
    .from("statement_import_entries")
    .select("id, source_hash, transaction_id")
    .eq("user_id", userId)
    .eq("mode", mode)
    .in("source_hash", hashes);

  if (mode === "conta") {
    query = query.eq("target_account_id", String(targetAccountId ?? "").trim());
  } else {
    query = query.eq(
      "target_credit_card_id",
      String(targetCreditCardId ?? "").trim()
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function relinkStatementImportEntries(params: {
  userId: string;
  mode: "conta" | "cartao";
  targetAccountId?: string | null;
  targetCreditCardId?: string | null;
  entries: Array<{
    sourceHash: string;
    transactionId?: string | null;
    description: string;
    category: string;
    occurredOn: string;
    amountCents: number;
    direction: "entrada" | "saida";
    rawPayload?: Record<string, any>;
    normalizedPayload?: Record<string, any>;
    sourceLineIndex: number;
  }>;
}) {
  const safeEntries = Array.isArray(params.entries) ? params.entries : [];
  if (!safeEntries.length) return [];

  const updatedRows: any[] = [];

  for (const entry of safeEntries) {
    let query = supabase
      .from("statement_import_entries")
      .update({
        transaction_id: String(entry.transactionId ?? "").trim() || null,
        description: String(entry.description ?? "").trim(),
        category: String(entry.category ?? "").trim(),
        occurred_on: String(entry.occurredOn ?? "").trim(),
        amount_cents: Number(entry.amountCents || 0),
        direction: entry.direction,
        was_imported: true,
        was_duplicate: false,
        was_invalid: false,
        invalid_reason: null,
        raw_payload: entry.rawPayload ?? {},
        normalized_payload: entry.normalizedPayload ?? {},
        source_line_index: Number(entry.sourceLineIndex ?? -1),
      })
      .eq("user_id", String(params.userId ?? "").trim())
      .eq("mode", params.mode)
      .eq("source_hash", String(entry.sourceHash ?? "").trim());

    if (params.mode === "conta") {
      query = query.eq(
        "target_account_id",
        String(params.targetAccountId ?? "").trim()
      );
    } else {
      query = query.eq(
        "target_credit_card_id",
        String(params.targetCreditCardId ?? "").trim()
      );
    }

    const { data, error } = await query.select("*");

    if (error) {
      throw error;
    }

    if (Array.isArray(data)) {
      updatedRows.push(...data);
    }
  }

  return updatedRows;
}