// src/app/transactions/summary.ts
import type { Transaction } from "../types";
import { sortByValueDesc } from "../utils/sort";

export type SpendingByCategoryDatum = {
  name: string;
  value: number;
  percentage: string;
};

export const computeSpendingByCategoryData = (
  transacoes: Transaction[],
  filtroMes?: string
): SpendingByCategoryDatum[] => {
  const mesPrefix = filtroMes || "";

  const currentExpenses = transacoes.filter(
    (t) => t.data?.startsWith(mesPrefix) && t.tipo === "despesa"
  );

  const totalExpense = currentExpenses.reduce(
    (s, t) => s + Math.abs(Number(t.valor) || 0),
    0
  );

  const categoriesMap: Record<string, number> = {};

  currentExpenses.forEach((t) => {
    categoriesMap[t.categoria] =
      (categoriesMap[t.categoria] || 0) + Math.abs(Number(t.valor) || 0);
  });

  return sortByValueDesc(
    Object.entries(categoriesMap).map(([name, value]) => ({
      name,
      value,
      percentage:
        totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(1) : "0",
    }))
  );
};
