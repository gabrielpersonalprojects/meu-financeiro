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
  saldoInicialBase?: number;
  perfilView?: PerfilView;
  profiles?: Profile[];
  creditCards?: any[];
}): ProjectionRow[] => {
const {
  transacoes,
  getMesAnoExtenso,
  mode = "acumulado",
  saldoInicialBase = 0,
  perfilView = "geral",
  profiles = [],
  creditCards = [],
} = params;

const perfilViewNorm = String(perfilView ?? "geral").trim().toLowerCase();

const getPerfilContaFromTransaction = (t: Transaction): "PF" | "PJ" | null => {
const cartaoId = String(
  (t as any)?.qualConta ??
    (t as any)?.qualCartao ??
    (t as any)?.cartaoId ??
    (t as any)?.creditCardId ??
    (t as any)?.selectedCreditCardId ??
    (t as any)?.payload?.qualConta ??
    (t as any)?.payload?.qualCartao ??
    (t as any)?.payload?.cartaoId ??
    (t as any)?.payload?.creditCardId ??
    (t as any)?.payload?.selectedCreditCardId ??
    ""
).trim();

if (cartaoId) {
  const cartao = (creditCards ?? []).find(
    (c: any) => String(c?.id ?? "").trim() === cartaoId
  );

  const perfilCartao = String((cartao as any)?.perfil ?? "")
    .trim()
    .toUpperCase();

  if (perfilCartao === "PF" || perfilCartao === "PJ") return perfilCartao;
}

  return null;
};

const transacoesFiltradas =
  perfilViewNorm === "geral"
    ? transacoes
    : (transacoes ?? []).filter((t) => {
        const perfilConta = getPerfilContaFromTransaction(t);
        return perfilViewNorm === "pf"
          ? perfilConta === "PF"
          : perfilConta === "PJ";
      });

  const results: ProjectionRow[] = [];
  const now = new Date();

  const debugPerfilCounts = (transacoes ?? []).reduce(
  (acc, t) => {
    const tipo = String((t as any)?.tipo ?? "").toLowerCase();
    const perfil = getPerfilContaFromTransaction(t);

    acc.total++;
    if (perfil === "PF") acc.pf++;
    if (perfil === "PJ") acc.pj++;
    if (!perfil) acc.null++;

    if (tipo === "cartao_credito") {
      acc.cartaoTotal++;
      if (perfil === "PF") acc.cartaoPf++;
      if (perfil === "PJ") acc.cartaoPj++;
      if (!perfil) acc.cartaoNull++;
    }

    return acc;
  },
  {
    total: 0,
    pf: 0,
    pj: 0,
    null: 0,
    cartaoTotal: 0,
    cartaoPf: 0,
    cartaoPj: 0,
    cartaoNull: 0,
  }
);

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

const isPgtoFatura = (t: any) => {
  const desc = String((t as any)?.descricao ?? "")
    .toLowerCase()
    .trim();

  const categoria = String((t as any)?.categoria ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    desc.startsWith("fatura:") ||
    categoria.includes("fatura")
  );
};

const fixas = monthTransactions
  .filter((t) => {
    const tipo = String((t as any).tipo ?? "").toLowerCase();
    const tipoGasto = String((t as any).tipoGasto ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return tipo === "despesa" && tipoGasto === "fixo";
  })
  .reduce((s, t) => s + Math.abs(Number((t as any).valor) || 0), 0);

const variaveis = monthTransactions
  .filter((t) => {
    const tipo = String((t as any).tipo ?? "").toLowerCase();
    const tipoGasto = String((t as any).tipoGasto ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const isCartao = tipo === "cartao_credito";
    const isDespesaVariavel = tipo === "despesa" && tipoGasto === "variavel";
    const isPagamentoFatura = isPgtoFatura(t);

    return isCartao || isDespesaVariavel || isPagamentoFatura;
  })
  .filter((t) => !isPgtoFatura(t))
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
