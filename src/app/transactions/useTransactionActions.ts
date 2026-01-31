import type { Transaction } from "../../types";

export function togglePagoById(prev: Transaction[], id: number): Transaction[] {
  return prev.map((t) => (t.id === id ? { ...t, pago: !t.pago } : t));
}

export function applyEditToTransactions(
  prev: Transaction[],
  editingTransaction: Transaction,
  novoValorAbs: number,
  novaDesc: string,
  applyToAllRelated: boolean
): Transaction[] {
  const sign = editingTransaction.tipo === "receita" ? 1 : -1;
  const valor = sign * novoValorAbs;

  return prev.map((t) => {
    if (
      applyToAllRelated &&
      editingTransaction.recorrenciaId &&
      t.recorrenciaId === editingTransaction.recorrenciaId
    ) {
      return { ...t, valor, descricao: novaDesc };
    }

    if (t.id === editingTransaction.id) {
      return { ...t, valor, descricao: novaDesc };
    }

    return t;
  });
}
