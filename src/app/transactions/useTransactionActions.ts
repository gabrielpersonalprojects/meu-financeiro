// src/app/transactions/useTransactionActions.ts
import type { Transaction } from "../types";

const isPaid = (v: any) => {
  const s = String(v ?? "").toLowerCase();
  return v === true || v === 1 || s === "1" || s === "true" || s === "pago";
};

export function togglePagoById(prev: Transaction[], payload: any): Transaction[] {
  const normTid = (v: any) => String(v ?? "").trim().replace(/^tr_+/g, "");

  const getIdStr = (x: any) => {
    if (typeof x === "string" || typeof x === "number") return String(x);
    if (x?.id != null) return String(x.id);
    return "";
  };

  const getTransferId = (x: any) => {
    const v = x?.transferId ?? x?.transferID ?? x?.transfer_id;
    return normTid(v);
  };

  const idStr = getIdStr(payload);

  // ✅ 0) PRIORIDADE MÁXIMA: se vier _sourceIds do item mesclado, toggle por eles
  const sourceIds = Array.isArray(payload?._sourceIds)
    ? payload._sourceIds.map((x: any) => String(x)).filter(Boolean)
    : [];

  if (sourceIds.length > 0) {
    const group = prev.filter((t: any) => sourceIds.includes(String(t?.id)));

    if (group.length > 0) {
      const allPaid = group.every((t: any) => isPaid(t?.pago));
      const nextPaid = !allPaid;

      return prev.map((t: any) =>
        sourceIds.includes(String(t?.id)) ? ({ ...t, pago: nextPaid } as Transaction) : t
      );
    }
  }

  // 1) tenta resolver transferId (normalizado)
  let transferId = getTransferId(payload);

  // se clicou no item mesclado e veio só id "tr_<tid>"
  if (!transferId && idStr.startsWith("tr_")) {
    transferId = normTid(idStr.slice(3));
  }

  // 2) se for transferência, marca/desmarca TODAS as pernas pelo transferId
  if (transferId) {
    const group = prev.filter((t: any) => getTransferId(t) === transferId);

    if (group.length > 0) {
      const allPaid = group.every((t: any) => isPaid(t?.pago));
      const nextPaid = !allPaid;

      return prev.map((t: any) =>
        getTransferId(t) === transferId ? ({ ...t, pago: nextPaid } as Transaction) : t
      );
    }
  }

  // 3) fallback: toggle normal por id
  if (!idStr) return prev;

  const exists = prev.some((t: any) => String(t?.id) === idStr);
  if (!exists) return prev;

  return prev.map((t: any) =>
    String(t?.id) === idStr ? ({ ...t, pago: !isPaid(t?.pago) } as Transaction) : t
  );
}


/**
 * Editar transação (mantém teu comportamento atual):
 * - Atualiza 1 item por id
 * - Opcionalmente aplica em todos relacionados (recorrenciaId)
 */
export function applyEditToTransactions(
  prev: Transaction[],
  editingTransaction: Transaction,
  novoValorAbs: number,
  novaDesc: string,
  applyToAllRelated: boolean,
  editDataInput: string,
  editCategoriaInput: string
): Transaction[] {
  const normTid = (v: any) => String(v ?? "").trim().replace(/^tr_+/g, "");
  const getTransferId = (x: any) => normTid(x?.transferId ?? x?.transferID ?? x?.transfer_id);

  const nextDesc = String(novaDesc ?? "").trim();
  const nextData = String(editDataInput ?? "").trim();
  const nextCategoria = String(editCategoriaInput ?? "").trim();

const applyCommonFields = (t: Transaction, signedValue: number): Transaction => ({
  ...t,
  valor: signedValue,
  descricao: nextDesc,
  data: nextData || t.data,
  categoria: nextCategoria || t.categoria,
});

  // ✅ se for transferência mesclada, aplica nas duas pernas
  const tid =
    getTransferId(editingTransaction as any) ||
    (String((editingTransaction as any)?.id ?? "").startsWith("tr_")
      ? normTid(String((editingTransaction as any).id).slice(3))
      : "");

  if (tid) {
    const abs = Math.abs(Number(novoValorAbs || 0)) || 0;

    return prev.map((t: any) => {
      if (getTransferId(t) !== tid) return t;

      const tipo = String(t?.tipo ?? "");
      const curr = Number(t?.valor ?? 0);

      let signed = curr < 0 ? -abs : abs;
      if (tipo === "despesa") signed = -abs;
      if (tipo === "receita") signed = abs;

      return applyCommonFields(t as Transaction, signed);
    });
  }

  // comportamento para não-transferências
  const sign = (editingTransaction as any).tipo === "receita" ? 1 : -1;
  const valor = sign * novoValorAbs;

  return prev.map((t: any) => {
    if (
      applyToAllRelated &&
      editingTransaction &&
      (editingTransaction as any).recorrenciaId &&
      t.recorrenciaId === (editingTransaction as any).recorrenciaId
    ) {
      return applyCommonFields(t as Transaction, valor);
    }

    if (String(t?.id) === String((editingTransaction as any).id)) {
      return applyCommonFields(t as Transaction, valor);
    }

    return t;
  });
}
