import { useMemo } from "react";
import type { Transaction } from "../../types";
import type { Profile } from "../../types";
import { computeStatsMes } from "./stats";

export function useStatsMes(params: {
  transactions: Transaction[] | null | undefined;
  filtroMes: string;
  filtroConta: unknown;
  profiles: Profile[] | null | undefined;
  passaFiltroConta: (t: Transaction) => boolean;
}) {
  const { transactions, filtroMes, filtroConta, profiles, passaFiltroConta } = params;

  return useMemo(() => {
    return computeStatsMes({
      transactions: transactions || [],
      filtroMes,
      filtroConta,
      profiles: profiles || [],
      passaFiltroConta: passaFiltroConta,
    });
  }, [transactions, filtroMes, filtroConta, profiles, passaFiltroConta]);
}
