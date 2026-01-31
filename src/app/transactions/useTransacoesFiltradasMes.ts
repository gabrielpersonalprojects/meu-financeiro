import { useMemo } from "react";
import type { Transaction } from "../../types";
import type { LancamentoFiltro } from "./filter"; // ajuste se o type tiver outro nome/arquivo

export function useTransacoesFiltradasMes(params: {
  transactions: Transaction[] | null | undefined;
  filtroMes: string;
  filtroLancamento: LancamentoFiltro;
  passaFiltroConta: (t: Transaction) => boolean;
}) {
  const { transactions, filtroMes, filtroLancamento, passaFiltroConta } = params;

  return useMemo(() => {
    return (transactions || [])
      // mês atual
      .filter((t) => String((t as any).data ?? "").startsWith(filtroMes || ""))
      // entradas/saídas
      .filter((t: any) => {
        if (filtroLancamento === "todos") return true;
        if (filtroLancamento === "receita") return t.tipo === "receita";
        if (filtroLancamento === "despesa") return t.tipo === "despesa";
        return true;
      })
      // conta (todas / uma conta / sem_conta)
      .filter(passaFiltroConta);
  }, [transactions, filtroMes, filtroLancamento, passaFiltroConta]);
}
