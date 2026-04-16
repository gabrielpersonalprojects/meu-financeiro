import type {
  StatementImportDraftItem,
  StatementImportPreviewState,
} from "../app/types";

import { buildStatementImportSourceHash } from "./statementImportHash";

export async function buildStatementImportDraft(
  preview: StatementImportPreviewState,
  userId: string
): Promise<StatementImportDraftItem[]> {
const rows = (preview.rows ?? []).filter(
  (row) =>
    row.selected === true &&
    row.parseStatus === "valid" &&
    !!row.normalizedDate &&
    !!row.normalizedDescription &&
    row.amount !== null &&
    (row.direction === "entrada" || row.direction === "saida") &&
    !(
      row.planning?.type === "mensal_com_prazo" &&
      !String(row.planning?.endDate ?? "").trim()
    ) &&
    !(
      row.planning?.type === "parcelado" &&
      (
        !Number.isInteger(Number(row.planning?.installment?.current)) ||
        !Number.isInteger(Number(row.planning?.installment?.total)) ||
        Number(row.planning?.installment?.current) < 1 ||
        Number(row.planning?.installment?.total) < 2 ||
        Number(row.planning?.installment?.current) >
          Number(row.planning?.installment?.total)
      )
    )
);

  const items = await Promise.all(
    rows.map(async (row) => {
      const amountAbs = Math.abs(Number(row.amount ?? 0));
      const descricao = String(
        row.editedDescription ?? row.normalizedDescription ?? ""
      ).trim();
      const categoria =
        String(row.selectedCategory ?? "").trim() || "Importação de Extrato";

      const sourceHash = await buildStatementImportSourceHash({
        userId,
        mode: preview.mode === "account" ? "conta" : "cartao",
        targetAccountId: preview.mode === "account" ? preview.targetId : null,
        targetCreditCardId:
          preview.mode === "credit_card" ? preview.targetId : null,
        occurredOn: String(row.normalizedDate ?? "").trim(),
        amountCents: Math.round(amountAbs * 100),
        direction: row.direction as "entrada" | "saida",
        description: descricao,
        category: categoria,
      });

return {
  externalRowHash: row.rowHash,
  sourceHash,
  targetId: preview.targetId,
  mode: preview.mode,
  transactionType:
    preview.mode === "credit_card"
      ? "cartao_credito"
      : row.direction === "entrada"
      ? "receita"
      : "despesa",
  descricao,
  categoria,
  valor: amountAbs,
  data: String(row.normalizedDate ?? "").trim(),
  direction: row.direction as "entrada" | "saida",
  planningType: row.planning?.type ?? "normal",
  planningEndDate:
    row.planning?.type === "mensal_com_prazo"
      ? String(row.planning?.endDate ?? "").trim() || null
      : null,
  installmentCurrent:
    row.planning?.type === "parcelado"
      ? Number(row.planning?.installment?.current ?? 0) || null
      : null,
  installmentTotal:
    row.planning?.type === "parcelado"
      ? Number(row.planning?.installment?.total ?? 0) || null
      : null,
} satisfies StatementImportDraftItem;
    })
  );

  return items;
}