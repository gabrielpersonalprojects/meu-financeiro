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

  const fcNorm = String(filtroConta ?? "").trim().toLowerCase();
const isTodas =
  fcNorm === "" ||
  fcNorm === "todas" ||
  fcNorm === "todas as contas" ||
  fcNorm === "todas_as_contas";


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
      isTodas ? mergeTransfers : (list: any[]) => list,
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
    anoRef,
{
  filtroLancamento,
  filtroCategoria,
  filtroMetodo,
  filtroTipoGasto,
  _filtroConta: filtroConta,
},
    isTodas ? mergeTransfers : ((list: any[]) => list),
    passarFiltroConta
  );
},[
  transacoes,
  anoRef,
  filtroLancamento,
  filtroCategoria,
  filtroMetodo,
  filtroTipoGasto,
  filtroConta,
  mergeTransfers,
  passarFiltroConta,
]);


  return { getFilteredTransactions, getFilteredTransactionsAno, anoRef };
}
