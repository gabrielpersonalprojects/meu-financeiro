import { useMemo } from "react";
import type { Transaction } from "../types";
import { computeProjection12Months } from "./projection";
import type { ProjectionMode, ProjectionRow } from "./projection";

type Params = {
  transactions: Transaction[];
  getMesAnoExtenso: (mesAno: string) => string;
  saldoInicialBase?: number;
  mode: ProjectionMode;
};

export function useProjection12Months({
  transactions,
  getMesAnoExtenso,
  saldoInicialBase = 0,
  mode,
}: Params): ProjectionRow[] {
  return useMemo(() => {
    return computeProjection12Months({
      transacoes: transactions,
      getMesAnoExtenso,
      saldoInicialBase,
      mode, // <- ESSENCIAL
    });
  }, [transactions, getMesAnoExtenso, saldoInicialBase, mode]); // <- ESSENCIAL
}
