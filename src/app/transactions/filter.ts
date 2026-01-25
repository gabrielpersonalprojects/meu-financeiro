// src/app/transactions/filter.ts
import type { PaymentMethod, SpendingType, Transaction, TransactionType } from "../types";

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
  if (filtroLancamento !== "todos") list = list.filter((t) => t.tipo === filtroLancamento);
  if (filtroCategoria) list = list.filter((t) => t.categoria === filtroCategoria);
  if (filtroMetodo) list = list.filter((t) => t.metodoPagamento === filtroMetodo);
  if (filtroTipoGasto) list = list.filter((t) => t.tipoGasto === filtroTipoGasto);

  list = mergeTransfers(list);
  list = list.filter(passarFiltroConta);

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
  params: {
    anoRef: string;
    filtroLancamento: any;
    filtroCategoria?: string;
    filtroMetodo?: string;
    filtroTipoGasto?: string;
    _filtroConta?: unknown;
  },
  passarFiltroConta: (t: Transaction) => boolean
): Transaction[] => {
  const { anoRef, filtroLancamento, filtroCategoria, filtroMetodo, filtroTipoGasto } = params;

  let list = [...transacoes];

  if (filtroLancamento !== "todos") list = list.filter((t) => t.tipo === filtroLancamento);
  if (filtroCategoria) list = list.filter((t) => t.categoria === filtroCategoria);
  if (filtroMetodo) list = list.filter((t) => t.metodoPagamento === filtroMetodo);
  if (filtroTipoGasto) list = list.filter((t) => t.tipoGasto === filtroTipoGasto);

  list = list.filter(passarFiltroConta);

  list = list.filter((t) => t.data?.startsWith(anoRef));
  return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
};
