// src/app/transactions/projection.ts
import type { Profile, Transaction } from "../types";

export type ProjectionRow = {
  mesAno: string;
  fixas: number;
  variaveis: number;
  receitas: number;
  saldo: number; // no modo acumulado = saldo final acumulado; no mensal = resultado do mês
};

export type ProjectionMode = "acumulado" | "mensal";
type PerfilView = "geral" | "pf" | "pj";

const isTransfer = (t: any) => {
  const tipo = String(t?.tipo ?? "").toLowerCase();
  const categoria = String(t?.categoria ?? "").toLowerCase();
  const desc = String(t?.descricao ?? "").toLowerCase();

  return (
    // se existir um tipo específico
    tipo === "transferencia" ||
    tipo === "transferência" ||

    // se vocês marcam por categoria
    categoria === "transferencia" ||
    categoria === "transferência" ||

    // marcadores comuns (se existirem no seu modelo)
    Boolean(t?.isTransfer) ||
    Boolean(t?.transferId) ||
    Boolean(t?.transferenciaId) ||
    (t?.origem && t?.destino) ||

    // último fallback (se vocês colocam a palavra na descrição)
    desc.includes("transfer")
  );
};

export const computeProjection12Months = (params: {
  transacoes: Transaction[];
  getMesAnoExtenso: (mesAno: string) => string;
  mode?: ProjectionMode;
  saldoInicialBase?: number; // em REAIS
  perfilView?: PerfilView;
  profiles?: Profile[];
}): ProjectionRow[] => {
const {
  transacoes,
  getMesAnoExtenso,
  mode = "acumulado",
  saldoInicialBase = 0,
  perfilView = "geral",
  profiles = [],
} = params;

const getPerfilContaFromTransaction = (t: Transaction): "PF" | "PJ" | null => {
  const profileId = String(
    (t as any)?.profileId ??
      (t as any)?.contaId ??
      (t as any)?.qualConta ??
      (t as any)?.conta?.id ??
      (t as any)?.profile?.id ??
      ""
  ).trim();

  if (!profileId) return null;

  const profile = (profiles ?? []).find(
    (p) => String((p as any)?.id ?? "").trim() === profileId
  );

  const perfil = String((profile as any)?.perfilConta ?? "")
    .trim()
    .toUpperCase();

  if (perfil === "PF" || perfil === "PJ") return perfil;
  return null;
};

const transacoesFiltradas =
  perfilView === "geral"
    ? transacoes
    : (transacoes ?? []).filter((t) => {
        const perfilConta = getPerfilContaFromTransaction(t);
        return perfilView === "pf"
          ? perfilConta === "PF"
          : perfilConta === "PJ";
      });

  const results: ProjectionRow[] = [];
  const now = new Date();

  // saldo acumulado (começa no saldo inicial das contas, respeitando filtro)
  let runningSaldo = Number(saldoInicialBase) || 0;

  for (let i = 0; i < 12; i++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const targetMonthStr = `${targetDate.getFullYear()}-${String(
      targetDate.getMonth() + 1
    ).padStart(2, "0")}`;

const monthTransactions = (transacoesFiltradas || [])
  .filter((t) => String((t as any).data || "").startsWith(targetMonthStr))
  .filter((t) => !isTransfer(t));

const isPgtoFatura = (t: any) =>
  String((t as any)?.descricao ?? "")
    .toLowerCase()
    .trim()
    .startsWith("fatura:");
    const fixas = monthTransactions
      .filter((t) => (t as any).tipo === "despesa" && (t as any).tipoGasto === "Fixo")
      .reduce((s, t) => s + Math.abs(Number((t as any).valor) || 0), 0);

const variaveis = monthTransactions
  .filter((t) => {
    const tipo = String((t as any).tipo ?? "").toLowerCase();
    const tipoGasto = String((t as any).tipoGasto ?? "");
    return (
      tipo === "despesa" &&
      (tipoGasto === "Variável" || isPgtoFatura(t))
    );
  })
  .reduce((s, t) => s + Math.abs(Number((t as any).valor) || 0), 0);

    const receitas = monthTransactions
      .filter((t) => (t as any).tipo === "receita")
      .reduce((s, t) => s + (Number((t as any).valor) || 0), 0);

    const resultadoMes = receitas - (fixas + variaveis);

    if (mode === "acumulado") {
      runningSaldo += resultadoMes;
      results.push({
        mesAno: getMesAnoExtenso(targetMonthStr),
        fixas,
        variaveis,
        receitas, // receita do 1º mês inclui saldo inicial
        saldo: runningSaldo,
      });
    } else {
      // mensal (não acumulado): mostra só o resultado do mês
      results.push({
        mesAno: getMesAnoExtenso(targetMonthStr),
        fixas,
        variaveis,
        receitas,
        saldo: resultadoMes,
      });
    }
  }

  return results;
};
