// src/app/transactions/projection.ts
import type { Transaction } from "../types";

export type ProjectionRow = {
  mesAno: string;
  fixas: number;
  variaveis: number;
  receitas: number;
  saldo: number;
};

export const computeProjection12Months = (params: {
  transacoes: Transaction[];
  getMesAnoExtenso: (mesAno: string) => string;
}): ProjectionRow[] => {
  const { transacoes, getMesAnoExtenso } = params;

  const results: ProjectionRow[] = [];
  const now = new Date();

  for (let i = 0; i < 12; i++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const targetMonthStr = `${targetDate.getFullYear()}-${String(
      targetDate.getMonth() + 1
    ).padStart(2, "0")}`;

    const monthTransactions = (transacoes || []).filter((t) =>
      String(t.data || "").startsWith(targetMonthStr)
    );

    const fixas = monthTransactions
      .filter((t) => t.tipo === "despesa" && (t as any).tipoGasto === "Fixo")
      .reduce((s, t) => s + Math.abs(Number((t as any).valor) || 0), 0);

    const variaveis = monthTransactions
      .filter((t) => t.tipo === "despesa" && (t as any).tipoGasto === "Variável")
      .reduce((s, t) => s + Math.abs(Number((t as any).valor) || 0), 0);

    const receitas = monthTransactions
      .filter((t) => t.tipo === "receita")
      .reduce((s, t) => s + (Number((t as any).valor) || 0), 0);

    results.push({
      mesAno: getMesAnoExtenso(targetMonthStr),
      fixas,
      variaveis,
      receitas,
      saldo: receitas - (fixas + variaveis),
    });
  }

  return results;
};
