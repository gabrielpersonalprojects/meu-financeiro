import { newId } from "../app/utils/ids";
import type {
  StatementImportDraftItem,
  Transaction,
} from "../app/types";

type BuildParams = {
  draftItems: StatementImportDraftItem[];
  selectedCardLabel?: string;
};

export function buildTransactionsFromStatementImportDraft({
  draftItems,
  selectedCardLabel = "",
}: BuildParams): Transaction[] {
  return draftItems.map((item, index) => {
    if (item.mode === "credit_card") {
      return {
        id: newId(),
        tipo: "cartao_credito",
        descricao: item.descricao,
        valor: Math.abs(Number(item.valor || 0)),
        data: item.data,
        categoria: item.categoria,
        qualConta: "",
        contaId: undefined,
        profileId: undefined,
        tipoGasto: "",
        qualCartao: selectedCardLabel,
        cartaoId: item.targetId,
        pago: false,
        createdAt: Date.now() + index,
      } satisfies Transaction;
    }

    const isReceita = item.transactionType === "receita";

    return {
      id: newId(),
      tipo: isReceita ? "receita" : "despesa",
      descricao: item.descricao,
      valor: isReceita
        ? Math.abs(Number(item.valor || 0))
        : -Math.abs(Number(item.valor || 0)),
      data: item.data,
      categoria: item.categoria,
      qualConta: item.targetId,
      contaId: item.targetId,
      profileId: item.targetId,
      tipoGasto: "",
      qualCartao: "",
      pago: true,
      createdAt: Date.now() + index,
    } satisfies Transaction;
  });
}