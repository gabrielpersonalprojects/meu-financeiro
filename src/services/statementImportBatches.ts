import { supabase } from "../lib/supabase";

type InsertStatementImportBatchParams = {
  userId: string;
  mode: "conta" | "cartao";
  fileType: "csv" | "ofx";
  fileName: string;
  targetAccountId?: string | null;
  targetCreditCardId?: string | null;
  totalRows: number;
  selectedRows: number;
  validRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  invalidRows: number;
  status?: "processing" | "completed" | "failed" | "partial";
  errorMessage?: string | null;
  metadata?: Record<string, any>;
};

export async function insertStatementImportBatch(
  params: InsertStatementImportBatchParams
) {
  const payload = {
    user_id: params.userId,
    mode: params.mode,
    file_type: params.fileType,
    file_name: params.fileName,
    target_account_id:
      params.mode === "conta"
        ? String(params.targetAccountId ?? "").trim() || null
        : null,
    target_credit_card_id:
      params.mode === "cartao"
        ? String(params.targetCreditCardId ?? "").trim() || null
        : null,
    total_rows: Number(params.totalRows || 0),
    selected_rows: Number(params.selectedRows || 0),
    valid_rows: Number(params.validRows || 0),
    imported_rows: Number(params.importedRows || 0),
    skipped_rows: Number(params.skippedRows || 0),
    duplicate_rows: Number(params.duplicateRows || 0),
    invalid_rows: Number(params.invalidRows || 0),
    status: params.status ?? "completed",
    error_message: params.errorMessage ?? null,
    metadata: params.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("statement_import_batches")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}