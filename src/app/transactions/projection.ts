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

const isActiveCardTransaction = (t: Transaction) => {
  const tipo = String((t as any)?.tipo ?? "").trim().toLowerCase();

  if (tipo !== "cartao_credito") return true;

  const idsCartao = [
    (t as any)?.qualCartao,
    (t as any)?.cartaoId,
    (t as any)?.creditCardId,
    (t as any)?.selectedCreditCardId,
    (t as any)?.payload?.qualCartao,
    (t as any)?.payload?.cartaoId,
    (t as any)?.payload?.creditCardId,
    (t as any)?.payload?.selectedCreditCardId,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  if (idsCartao.length === 0) return false;

  const normalize = (value: any) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const cartaoAtivo = (creditCards ?? []).find((c: any) => {
    const cardId = String(c?.id ?? "").trim();
    const cardName = String(c?.name ?? c?.nome ?? "").trim();
    const cardIssuer = String(c?.emissor ?? c?.bankText ?? "").trim();

    return idsCartao.some((ref) => {
      const refNorm = normalize(ref);

      return (
        (cardId && ref === cardId) ||
        (cardName && refNorm === normalize(cardName)) ||
        (cardIssuer && refNorm === normalize(cardIssuer))
      );
    });
  });

  return !!cartaoAtivo;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const clampDay = (year: number, monthIndex0: number, day: number) => {
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  return Math.max(1, Math.min(day, lastDay));
};

const makeDate = (year: number, monthIndex0: number, day: number) => {
  const dd = clampDay(year, monthIndex0, day);
  return new Date(year, monthIndex0, dd, 12, 0, 0, 0);
};

const parseISODateLocal = (iso: string) => {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
};

const addMonths = (base: Date, delta: number) => {
  const d = new Date(base);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return d;
};

const getCardRefFromTransaction = (t: Transaction) => {
  const refs = [
    (t as any)?.cartaoId,
    (t as any)?.qualCartao,
    (t as any)?.creditCardId,
    (t as any)?.selectedCreditCardId,
    (t as any)?.payload?.cartaoId,
    (t as any)?.payload?.qualCartao,
    (t as any)?.payload?.creditCardId,
    (t as any)?.payload?.selectedCreditCardId,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  if (!refs.length) return null;

  const normalize = (value: any) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  return (
    (creditCards ?? []).find((c: any) => {
      const cardId = String(c?.id ?? "").trim();
      const cardName = String(c?.name ?? c?.nome ?? "").trim();
      const cardIssuer = String(c?.emissor ?? c?.bankText ?? "").trim();

      return refs.some((ref) => {
        const refNorm = normalize(ref);
        return (
          (cardId && ref === cardId) ||
          (cardName && refNorm === normalize(cardName)) ||
          (cardIssuer && refNorm === normalize(cardIssuer))
        );
      });
    }) ?? null
  );
};

const getMesCompetenciaProjection = (t: Transaction) => {
  const tipo = String((t as any)?.tipo ?? "").trim().toLowerCase();
  const data = String((t as any)?.data ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "";

  if (tipo !== "cartao_credito") {
    return data.slice(0, 7);
  }

  const cartao = getCardRefFromTransaction(t);
  if (!cartao) {
    return data.slice(0, 7);
  }

const diaFechamento =
  Number((cartao as any)?.diaFechamento ?? (cartao as any)?.closingDay ?? 1) || 1;

const diaVencimento =
  Number((cartao as any)?.diaVencimento ?? (cartao as any)?.dueDay ?? 1) || 1;

const invoiceStartOffset = diaVencimento > diaFechamento ? 0 : 1;

const dt = parseISODateLocal(data);

if (Number.isNaN(dt.getTime())) {
  return data.slice(0, 7);
}

const fechamentoAtualDaData = makeDate(dt.getFullYear(), dt.getMonth(), diaFechamento);

const mesFechamento =
  dt.getTime() > fechamentoAtualDaData.getTime()
    ? addMonths(new Date(dt.getFullYear(), dt.getMonth(), 1), 1)
    : new Date(dt.getFullYear(), dt.getMonth(), 1);

const mesFatura = addMonths(mesFechamento, invoiceStartOffset);

return `${mesFatura.getFullYear()}-${pad2(mesFatura.getMonth() + 1)}`;
};

const getPerfilContaFromTransaction = (t: Transaction): "PF" | "PJ" | null => {
  const idsConta = [
    (t as any)?.profileId,
    (t as any)?.contaId,
    (t as any)?.qualConta,
    (t as any)?.contaOrigemId,
    (t as any)?.contaDestinoId,
    (t as any)?.transferFromId,
    (t as any)?.transferToId,
    (t as any)?.conta?.id,
    (t as any)?.profile?.id,
    (t as any)?.payload?.profileId,
    (t as any)?.payload?.contaId,
    (t as any)?.payload?.qualConta,
    (t as any)?.payload?.contaOrigemId,
    (t as any)?.payload?.contaDestinoId,
    (t as any)?.payload?.transferFromId,
    (t as any)?.payload?.transferToId,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  if (idsConta.length > 0) {
    const conta = (profiles ?? []).find((p: any) => {
      const profileId = String((p as any)?.id ?? "").trim();
      return profileId && idsConta.includes(profileId);
    });

    const perfilConta = String(
      (conta as any)?.perfilConta ??
      (conta as any)?.perfil ??
      (conta as any)?.brand ??
      ""
    )
      .trim()
      .toUpperCase();

    if (perfilConta === "PF" || perfilConta === "PJ") return perfilConta;
  }

  const idsCartao = [
    (t as any)?.qualCartao,
    (t as any)?.cartaoId,
    (t as any)?.creditCardId,
    (t as any)?.selectedCreditCardId,
    (t as any)?.payload?.qualCartao,
    (t as any)?.payload?.cartaoId,
    (t as any)?.payload?.creditCardId,
    (t as any)?.payload?.selectedCreditCardId,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

if (idsCartao.length > 0) {
  const normalize = (value: any) =>
    String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const cartao = (creditCards ?? []).find((c: any) => {
    const cardId = String(c?.id ?? "").trim();
    const cardName = String(c?.name ?? c?.nome ?? "").trim();
    const cardIssuer = String(c?.emissor ?? c?.bankText ?? "").trim();

    return idsCartao.some((ref) => {
      const refNorm = normalize(ref);

      return (
        (cardId && ref === cardId) ||
        (cardName && refNorm === normalize(cardName)) ||
        (cardIssuer && refNorm === normalize(cardIssuer))
      );
    });
  });

const perfilCartao = String(
  (cartao as any)?.perfil ??
  (cartao as any)?.brand ??
  ""
)
  .trim()
  .toUpperCase();

if (perfilCartao === "PF" || perfilCartao === "PJ") return perfilCartao;
}

const tipo = String((t as any)?.tipo ?? "").trim().toLowerCase();

if (tipo === "cartao_credito") {
  const perfisCartoes = Array.from(
    new Set(
      (creditCards ?? [])
        .map((c: any) => String(c?.perfil ?? "").trim().toUpperCase())
        .filter((p) => p === "PF" || p === "PJ")
    )
  );

  if (perfisCartoes.length === 1) {
    return perfisCartoes[0] as "PF" | "PJ";
  }
}

const perfisContas = Array.from(
  new Set(
    (profiles ?? [])
      .map((p: any) =>
        String(
          (p as any)?.perfilConta ??
          (p as any)?.perfil ??
          (p as any)?.brand ??
          ""
        )
          .trim()
          .toUpperCase()
      )
      .filter((p) => p === "PF" || p === "PJ")
  )
);

if (perfisContas.length === 1) {
  return perfisContas[0] as "PF" | "PJ";
}

return null;
};

const transacoesFiltradas = (transacoes ?? []).filter((t) => {
  if (!isActiveCardTransaction(t)) return false;

  if (perfilViewNorm === "geral") return true;

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
  .filter((t) => getMesCompetenciaProjection(t) === targetMonthStr)
  .filter((t) => !isTransfer(t));

const isPgtoFatura = (t: any) => {
  const desc = String((t as any)?.descricao ?? "")
    .toLowerCase()
    .trim();

  const categoriaRaw = (t as any)?.categoria;
  const categoria = String(
    typeof categoriaRaw === "string"
      ? categoriaRaw
      : categoriaRaw?.nome ?? categoriaRaw?.label ?? categoriaRaw?.value ?? ""
  )
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const origemLancamento = String(
    (t as any)?.origemLancamento ??
      (t as any)?.payload?.origemLancamento ??
      ""
  )
    .toLowerCase()
    .trim();

  const isParcelamentoFatura =
    origemLancamento === "parcelamento_fatura" ||
    desc.startsWith("parcelamento de fatura") ||
    categoria === "parcelamento de fatura";

  if (isParcelamentoFatura) return false;

  return desc.startsWith("fatura:");
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
    const tipo = String((t as any).tipo ?? "").trim().toLowerCase();

    const tipoGasto = String(
      (t as any).tipoGasto ??
        (t as any).payload?.tipoGasto ??
        ""
    )
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const origemLancamento = String(
      (t as any).origemLancamento ??
        (t as any).payload?.origemLancamento ??
        ""
    )
      .trim()
      .toLowerCase();

    const isCartao = tipo === "cartao_credito";

    const isDespesaVariavel =
      tipo === "despesa" &&
      (tipoGasto === "normal" || tipoGasto === "variavel");

    const isParcelamentoFatura =
      origemLancamento === "parcelamento_fatura";

    const isPagamentoFatura = isPgtoFatura(t);

    return (
      isCartao ||
      isDespesaVariavel ||
      isParcelamentoFatura ||
      isPagamentoFatura
    );
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
