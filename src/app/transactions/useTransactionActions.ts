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
  const getTransferId = (x: any) =>
    normTid(x?.transferId ?? x?.transferID ?? x?.transfer_id);

  const nextDescRaw = String(novaDesc ?? "").trim();
  const nextData = String(editDataInput ?? "").trim();
  const nextCategoria = String(editCategoriaInput ?? "").trim();

  const PARCELA_REGEX = /\((\d+)\s*\/\s*(\d+)\)\s*$/;

  const stripParcelSuffix = (value: any) =>
    String(value ?? "")
      .replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/g, "")
      .trim();

  const parseParcelInfo = (tx: any) => {
    const descricao = String(tx?.descricao ?? "").trim();
    const match = descricao.match(PARCELA_REGEX);

    const parcelaAtualEstruturada = Number(
      tx?.parcelaAtual ?? tx?.payload?.parcelaAtual ?? 0
    );

    const totalParcelasEstruturada = Number(
      tx?.totalParcelas ?? tx?.payload?.totalParcelas ?? 0
    );

    const parcelaAtual =
      parcelaAtualEstruturada > 0
        ? parcelaAtualEstruturada
        : Number(match?.[1] ?? 0);

    const totalParcelas =
      totalParcelasEstruturada > 0
        ? totalParcelasEstruturada
        : Number(match?.[2] ?? 0);

    return {
      parcelaAtual,
      totalParcelas,
      descricaoBase: stripParcelSuffix(descricao),
    };
  };

  const buildParcelDescription = (
    base: string,
    parcelaAtual: number,
    totalParcelas: number
  ) => {
    const safeBase = String(base ?? "").trim();
    if (parcelaAtual > 0 && totalParcelas > 0) {
      return `${safeBase} (${parcelaAtual}/${totalParcelas})`.trim();
    }
    return safeBase;
  };

  const getTimeSafe = (value: any) => {
    const raw = String(value ?? "").trim();
    if (!raw) return Number.NaN;

    const date = new Date(`${raw}T12:00:00`);
    return Number.isNaN(date.getTime()) ? Number.NaN : date.getTime();
  };

  const editingId = String((editingTransaction as any)?.id ?? "").trim();
  const editingRecurringId = String(
    (editingTransaction as any)?.recorrenciaId ?? ""
  ).trim();
  const editingTime = getTimeSafe((editingTransaction as any)?.data);

  const editingTipoGasto = String(
    (editingTransaction as any)?.tipoGasto ?? ""
  )
    .trim()
    .toLowerCase();

  const editingParcelInfo = parseParcelInfo(editingTransaction);
  const editingParcelaAtual = editingParcelInfo.parcelaAtual;
  const editingTotalParcelas = editingParcelInfo.totalParcelas;

  const isParcelado =
    editingTipoGasto === "parcelado" || editingTotalParcelas > 1;

  const nextDescBase = stripParcelSuffix(nextDescRaw);

  const getFinalDescription = (
    tx: Transaction,
    parcelaAtualOverride?: number,
    totalParcelasOverride?: number
  ) => {
    if (!isParcelado) return nextDescRaw;

    const txParcelInfo = parseParcelInfo(tx);

    const parcelaAtualFinal =
      Number(parcelaAtualOverride ?? 0) > 0
        ? Number(parcelaAtualOverride)
        : txParcelInfo.parcelaAtual;

    const totalParcelasFinal =
      Number(totalParcelasOverride ?? 0) > 0
        ? Number(totalParcelasOverride)
        : txParcelInfo.totalParcelas;

    const baseFinal =
      nextDescBase || txParcelInfo.descricaoBase || stripParcelSuffix(tx.descricao);

    return buildParcelDescription(baseFinal, parcelaAtualFinal, totalParcelasFinal);
  };

  const applyCurrentFields = (
    t: Transaction,
    signedValue: number
  ): Transaction => {
    const info = parseParcelInfo(t);

    return {
      ...t,
      valor: signedValue,
      descricao: getFinalDescription(
        t,
        info.parcelaAtual,
        editingTotalParcelas || info.totalParcelas
      ),
      data: nextData || t.data,
      categoria: nextCategoria || t.categoria,
      ...(isParcelado && info.parcelaAtual > 0
        ? {
            parcelaAtual: info.parcelaAtual,
            totalParcelas:
              editingTotalParcelas > 0
                ? editingTotalParcelas
                : info.totalParcelas,
          }
        : {}),
    };
  };

const applyRelatedFutureFields = (
  t: Transaction,
  signedValue: number,
  nextParcelaAtual?: number
): Transaction => {
  const info = parseParcelInfo(t);

  const totalFinal =
    editingTotalParcelas > 0 ? editingTotalParcelas : info.totalParcelas;

  const currentDateRaw = String((t as any)?.data ?? "").trim();
  const nextDateRaw = String(nextData ?? "").trim();

  let replicatedDate = currentDateRaw;

  if (/^\d{4}-\d{2}-\d{2}$/.test(currentDateRaw) && /^\d{4}-\d{2}-\d{2}$/.test(nextDateRaw)) {
const year = currentDateRaw.slice(0, 4);
const month = currentDateRaw.slice(5, 7);
const desiredDay = Number(nextDateRaw.slice(8, 10));
const lastDayOfMonth = new Date(Number(year), Number(month), 0).getDate();
const safeDay = String(Math.min(desiredDay, lastDayOfMonth)).padStart(2, "0");

replicatedDate = `${year}-${month}-${safeDay}`;
  }

  return {
    ...t,
    valor: signedValue,
    descricao: getFinalDescription(t, nextParcelaAtual, totalFinal),
    data: replicatedDate,
    categoria: nextCategoria || t.categoria,
    ...(isParcelado && Number(nextParcelaAtual ?? 0) > 0
      ? {
          parcelaAtual: Number(nextParcelaAtual),
          totalParcelas: totalFinal,
        }
      : {}),
  };
};

  // transferência continua aplicando nas duas pernas
  const tid =
    getTransferId(editingTransaction as any) ||
    (editingId.startsWith("tr_") ? normTid(editingId.slice(3)) : "");

  if (tid) {
    const abs = Math.abs(Number(novoValorAbs || 0)) || 0;

    return prev.map((t: any) => {
      if (getTransferId(t) !== tid) return t;

      const tipo = String(t?.tipo ?? "");
      const curr = Number(t?.valor ?? 0);

      let signed = curr < 0 ? -abs : abs;
      if (tipo === "despesa") signed = -abs;
      if (tipo === "receita") signed = abs;

      return applyCurrentFields(t as Transaction, signed);
    });
  }

  const sign = (editingTransaction as any).tipo === "receita" ? 1 : -1;
  const valor = sign * novoValorAbs;

  const futureRelatedIdsOrdered =
    applyToAllRelated && editingRecurringId
      ? [...prev]
          .filter((t: any) => {
            const currentId = String((t as any)?.id ?? "").trim();
            const recurringId = String((t as any)?.recorrenciaId ?? "").trim();
            const currentTime = getTimeSafe((t as any)?.data);

            return (
              currentId !== editingId &&
              recurringId === editingRecurringId &&
              !Number.isNaN(editingTime) &&
              !Number.isNaN(currentTime) &&
              currentTime > editingTime
            );
          })
          .sort((a: any, b: any) => {
            const diff =
              getTimeSafe((a as any)?.data) - getTimeSafe((b as any)?.data);

            if (diff !== 0) return diff;

            const aCreated = Number(
              (a as any)?.criadoEm ?? (a as any)?.createdAt ?? 0
            );
            const bCreated = Number(
              (b as any)?.criadoEm ?? (b as any)?.createdAt ?? 0
            );

            if (aCreated !== bCreated) return aCreated - bCreated;

            return String((a as any)?.id ?? "").localeCompare(
              String((b as any)?.id ?? "")
            );
          })
          .map((t: any) => String((t as any)?.id ?? "").trim())
      : [];

  const parcelaAtualPorId = new Map<string, number>();

  if (isParcelado && editingParcelaAtual > 0) {
    futureRelatedIdsOrdered.forEach((id, index) => {
      parcelaAtualPorId.set(id, editingParcelaAtual + index + 1);
    });
  }

  return prev.map((t: any) => {
    const currentId = String((t as any)?.id ?? "").trim();

    // atual
    if (currentId === editingId) {
      return applyCurrentFields(t as Transaction, valor);
    }

    // futuras da mesma série
    if (
      applyToAllRelated &&
      editingRecurringId &&
      String((t as any)?.recorrenciaId ?? "").trim() === editingRecurringId
    ) {
      const currentTime = getTimeSafe((t as any)?.data);

      if (
        !Number.isNaN(editingTime) &&
        !Number.isNaN(currentTime) &&
        currentTime > editingTime
      ) {
        const nextParcelaAtual = parcelaAtualPorId.get(currentId);
        return applyRelatedFutureFields(
          t as Transaction,
          valor,
          nextParcelaAtual
        );
      }
    }

    return t;
  });
}