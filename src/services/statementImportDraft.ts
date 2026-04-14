import type {
  StatementImportDraftItem,
  StatementImportPreviewState,
} from "../app/types";

export function buildStatementImportDraft(
  preview: StatementImportPreviewState
): StatementImportDraftItem[] {
const rows = (preview.rows ?? []).filter(
  (row) =>
    row.selected === true &&
    row.parseStatus === "valid" &&
    !!row.normalizedDate &&
    !!row.normalizedDescription &&
    row.amount !== null &&
    (row.direction === "entrada" || row.direction === "saida")
);

  return rows.map((row) => {
    const amountAbs = Math.abs(Number(row.amount ?? 0));

    return {
      externalRowHash: row.rowHash,
      targetId: preview.targetId,
      mode: preview.mode,
      transactionType:
        preview.mode === "credit_card"
          ? "cartao_credito"
          : row.direction === "entrada"
          ? "receita"
          : "despesa",
      descricao: String(row.normalizedDescription ?? "").trim(),
      valor: amountAbs,
      data: String(row.normalizedDate ?? "").trim(),
      direction: row.direction as "entrada" | "saida",
    };
  });
}