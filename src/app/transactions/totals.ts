// src/app/transactions/totals.ts
import type { Transaction } from "../types";

export const sumReceitas = (list: Transaction[]) => {
  return list
    .filter((t) => t.tipo === "receita")
    .reduce((s, t) => s + (Number(t.valor) || 0), 0);
};

export const sumDespesasAbs = (list: Transaction[]) => {
  return list
    .filter((t) => t.tipo === "despesa")
    .reduce((s, t) => s + Math.abs(Number(t.valor) || 0), 0);
};
