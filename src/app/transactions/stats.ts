// src/app/transactions/stats.ts
import type { Transaction, Profile } from "../types";

type StatsResult = {
  receitasMes: number;
  despesasMes: number;
  saldoMes: number;
  saldoTotal: number;
  pendenteReceita: number;
  pendenteDespesa: number;
};

const signedPago = (t: any) => {
  if (!t?.pago) return 0;
  const v = Number(t.valor || 0);
  if (t.tipo === "receita") return v;
  if (t.tipo === "despesa") return -Math.abs(v);
  return 0;
};

const initialReais = (p: any) => {
  if (p?.initialBalanceCents != null) return Number(p.initialBalanceCents) / 100;
  return Number(p?.initialBalance ?? 0);
};

export const computeStatsMes = (params: {
  transactions: Transaction[];
  filtroMes: string;
  filtroConta: unknown;
  profiles: Profile[];
  passaFiltroConta: (t: Transaction) => boolean;
}): StatsResult => {
  const { transactions, filtroMes, filtroConta, profiles, passaFiltroConta } = params;

  // transações do mês atual, sem transferências e respeitando filtroConta
  const transMesSemTransfer = (transactions || [])
    .filter((t) => String(t.data || "").startsWith(filtroMes || ""))
    .filter(passaFiltroConta)
    .filter((t: any) => !t.transferId && String(t.categoria || "").toLowerCase() !== "transferência");

  const receitasMes = transMesSemTransfer
    .filter((t) => t.tipo === "receita" && (t as any).pago)
    .reduce((s, t: any) => s + Number(t.valor || 0), 0);

  const despesasMes = transMesSemTransfer
    .filter((t) => t.tipo === "despesa" && (t as any).pago)
    .reduce((s, t: any) => s + Math.abs(Number(t.valor || 0)), 0);

  const pendenteReceita = transMesSemTransfer
    .filter((t) => t.tipo === "receita" && !(t as any).pago)
    .reduce((s, t: any) => s + Number(t.valor || 0), 0);

  const pendenteDespesa = transMesSemTransfer
    .filter((t) => t.tipo === "despesa" && !(t as any).pago)
    .reduce((s, t: any) => s + Math.abs(Number(t.valor || 0)), 0);

  // saldo inicial do filtro atual (todas ou conta específica)
  const initialForFilter = () => {
    const fcRaw = String(filtroConta ?? "").trim().toLowerCase();

    const isTodas =
      fcRaw === "" ||
      fcRaw === "todas" ||
      fcRaw === "todas as contas" ||
      fcRaw === "todas_as_contas" ||
      fcRaw === "todas_contas";

    if (isTodas) return (profiles || []).reduce((s, p: any) => s + initialReais(p), 0);

    // conta específica (filtroConta guarda o id)
    const p = (profiles || []).find((x: any) => String(x.id) === String(filtroConta));
    return p ? initialReais(p) : 0;
  };

  // saldo anterior = tudo pago antes do mês atual (respeita filtroConta)
  const primeiroDiaMes = `${filtroMes}-01`;
  const saldoAnterior = (transactions || [])
    .filter((t: any) => String(t.data || "") < primeiroDiaMes)
    .filter(passaFiltroConta)
    .reduce((s: number, t: any) => s + signedPago(t), 0);

  const saldoMes = receitasMes - despesasMes;
  const saldoTotal = initialForFilter() + saldoAnterior + saldoMes;

  return {
    receitasMes,
    despesasMes,
    saldoMes,
    saldoTotal,
    pendenteReceita,
    pendenteDespesa,
  };
};
