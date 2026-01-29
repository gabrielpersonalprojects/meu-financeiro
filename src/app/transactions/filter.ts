// src/app/transactions/filter.ts
import type { PaymentMethod, SpendingType, Transaction, TransactionType } from "../types";
import { getHojeLocal } from "../../domain/date";
import type { Dispatch, SetStateAction } from "react";



export type LancamentoFiltro = TransactionType | "todos";

export type MergeTransfersFn = (list: Transaction[]) => Transaction[];
export type PassarFiltroContaFn = (t: Transaction) => boolean;

export const buildFilteredTransactions = (
  transacoes: Transaction[],
  params: {
    filtroMes?: string;
    filtroLancamento: LancamentoFiltro;
    filtroCategoria?: string;
    filtroMetodo?: string;
    filtroTipoGasto?: string;

    // mantido só pra você usar no dependency array do useMemo
    _filtroConta?: unknown;
  },
  mergeTransfers: MergeTransfersFn,
  passarFiltroConta: PassarFiltroContaFn
): Transaction[] => {
  const {
    filtroMes,
    filtroLancamento,
    filtroCategoria,
    filtroMetodo,
    filtroTipoGasto,
  } = params;

  let list = [...transacoes];

  if (filtroMes) list = list.filter((t) => t.data?.startsWith(filtroMes));
  if (filtroCategoria) list = list.filter((t) => t.categoria === filtroCategoria);
  if (filtroMetodo) list = list.filter((t) => t.metodoPagamento === filtroMetodo);
  if (filtroTipoGasto) list = list.filter((t) => t.tipoGasto === filtroTipoGasto);

  list = mergeTransfers(list);
  list = list.filter(passarFiltroConta);

  if (filtroLancamento !== "todos") list = list.filter((t) => t.tipo === filtroLancamento);
  
  const order = (tipo: TransactionType) => {
    if (tipo === "receita") return 0;
    if (tipo === "despesa") return 1;
    if (tipo === "cartao_credito") return 2;
    return 3; // transferencia
  };

  return list.sort((a, b) => {
    const oa = order(a.tipo);
    const ob = order(b.tipo);
    if (oa !== ob) return oa - ob;
    return new Date(b.data).getTime() - new Date(a.data).getTime();
  });
};

export const buildFilteredTransactionsByYear = (
  transacoes: Transaction[],
  anoRef: string,
  params: {
    filtroLancamento: any;
    filtroCategoria?: string;
    filtroMetodo?: string;
    filtroTipoGasto?: string;
    _filtroConta?: unknown;
  },
  mergeTransfers: MergeTransfersFn,
  passarFiltroConta: PassarFiltroContaFn
): Transaction[] => {
  const { filtroLancamento, filtroCategoria, filtroMetodo, filtroTipoGasto } = params;

  let list = [...transacoes];

  // filtros do ano
  if (filtroLancamento && filtroLancamento !== "todos") {
    list = list.filter((t) => t.tipo === filtroLancamento);
  }
  if (filtroCategoria) list = list.filter((t) => t.categoria === filtroCategoria);
  if (filtroMetodo) list = list.filter((t: any) => t.metodoPagamento === filtroMetodo);
  if (filtroTipoGasto) list = list.filter((t: any) => t.tipoGasto === filtroTipoGasto);

  // 1) merge (se quiser)
  list = mergeTransfers(list);

  // 2) filtro por conta (origem OU destino – sua regra)
  list = list.filter(passarFiltroConta);

  // 3) mantém só o ano e ordena
  list = list.filter((t) => String(t.data ?? "").startsWith(anoRef));
  return list.sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
};


export function limparFiltros(setters: {
  setFiltroMes: Dispatch<SetStateAction<string>>;
  setFiltroLancamento: Dispatch<SetStateAction<"despesa" | "receita" | "todos">>;
  setFiltroCategoria: Dispatch<SetStateAction<string>>;
  setFiltroMetodo: Dispatch<SetStateAction<string>>;
  setFiltroTipoGasto: Dispatch<SetStateAction<string>>;
}) {
  const {
    setFiltroMes,
    setFiltroLancamento,
    setFiltroCategoria,
    setFiltroMetodo,
    setFiltroTipoGasto,
  } = setters;

  setFiltroMes(getHojeLocal().substring(0, 7));
  setFiltroLancamento("todos");
  setFiltroCategoria("");
  setFiltroMetodo("");
  setFiltroTipoGasto("");
}


