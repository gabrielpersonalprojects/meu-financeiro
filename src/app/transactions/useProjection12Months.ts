import { useMemo } from "react";
import type { Profile, Transaction } from "../types";
import { computeProjection12Months } from "./projection";
import type { ProjectionMode, ProjectionRow } from "./projection";

type Params = {
  transactions: Transaction[];
  getMesAnoExtenso: (mesAno: string) => string;
  saldoInicialBase?: number;
  perfilView?: "geral" | "pf" | "pj";
  profiles?: Profile[];
  creditCards?: any[];
  mode: ProjectionMode;
};

export function useProjection12Months({
  transactions,
  getMesAnoExtenso,
  saldoInicialBase = 0,
  perfilView = "geral",
  profiles = [],
  creditCards = [],
  mode,
}: Params): ProjectionRow[] {
  return useMemo(() => {
    return computeProjection12Months({
      transacoes: transactions,
      getMesAnoExtenso,
      saldoInicialBase,
      perfilView,
      profiles,
      creditCards,
      mode,
    });
  }, [transactions, getMesAnoExtenso, saldoInicialBase, perfilView, profiles, mode]);
}
