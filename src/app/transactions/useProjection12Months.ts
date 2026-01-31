import { useMemo } from "react";
import type { Transaction } from "../../types";
import { getMesAnoExtenso } from "../../domain/date";// ajuste o caminho se necessário
import { computeProjection12Months } from "./projection";

export function useProjection12Months(params: {
  transactions: Transaction[] | null | undefined;
}) {
  const { transactions } = params;

  return useMemo(() => {
    return computeProjection12Months({
      transacoes: transactions || [],
      getMesAnoExtenso,
    });
  }, [transactions]);
}

