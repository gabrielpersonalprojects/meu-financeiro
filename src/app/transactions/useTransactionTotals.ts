import { useMemo } from "react";

export function useTransactionTotals(params: any) {
  const {
    getFilteredTransactions,
    getFilteredTransactionsAno,
    sumReceitas,      // (ou o nome que você está usando aí)
    sumDespesasAbs,   // <- este aqui
  } = params;

  const totalFiltradoReceitas = useMemo(() => sumReceitas(getFilteredTransactions), [
    getFilteredTransactions,
    sumReceitas,
  ]);

  const totalFiltradoDespesas = useMemo(() => sumDespesasAbs(getFilteredTransactions), [
    getFilteredTransactions,
    sumDespesasAbs,
  ]);

  const totalAnualReceitas = useMemo(() => sumReceitas(getFilteredTransactionsAno), [
    getFilteredTransactionsAno,
    sumReceitas,
  ]);

  const totalAnualDespesas = useMemo(() => sumDespesasAbs(getFilteredTransactionsAno), [
    getFilteredTransactionsAno,
    sumDespesasAbs,
  ]);

  return { totalFiltradoReceitas, totalFiltradoDespesas, totalAnualReceitas, totalAnualDespesas };
}
