import { useMemo } from "react";
import {
  buildFilteredTransactions,
  buildFilteredTransactionsByYear,
} from "./filter";

export function useFilteredTransactions(params: any) {
  const {
    transacoes,
    filtroMes,
    filtroLancamento,
    filtroCategoria,
    filtroMetodo,
    filtroTipoGasto,
    filtroConta,
    mergeTransfers,
    passarFiltroConta,
  } = params;

  const getFilteredTransactions = useMemo(() => {
    return buildFilteredTransactions(
      transacoes,
      {
        filtroMes,
        filtroLancamento,
        filtroCategoria,
        filtroMetodo,
        filtroTipoGasto,
        _filtroConta: filtroConta,
      },
      filtroConta === "todas" ? mergeTransfers : (list: any[]) => list,
      passarFiltroConta
    );
  }, [
    transacoes,
    filtroMes,
    filtroLancamento,
    filtroCategoria,
    filtroMetodo,
    filtroTipoGasto,
    filtroConta,
    mergeTransfers,
    passarFiltroConta,
  ]);

  const anoRef = (filtroMes || new Date().toISOString().substring(0, 7)).slice(0, 4);

  const getFilteredTransactionsAno = useMemo(() => {
return buildFilteredTransactionsByYear(
  transacoes,
  {
    anoRef,
    filtroLancamento,
    filtroCategoria,
    filtroMetodo,
    _filtroConta: filtroConta,
  },
  mergeTransfers
);

  }, [
    transacoes,
    anoRef,
    filtroLancamento,
    filtroCategoria,
    filtroMetodo,
    filtroConta,
    mergeTransfers,
    passarFiltroConta,
  ]);

  return { getFilteredTransactions, getFilteredTransactionsAno, anoRef };
}
