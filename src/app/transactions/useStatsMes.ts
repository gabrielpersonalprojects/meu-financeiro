// src/app/transactions/useStatsMes.ts
import { useMemo } from "react";
import type { Transaction } from "../types";
import { asId } from "../../utils/asId";

const isPaidValue = (v: any) => {
  const s = String(v ?? "").toLowerCase();
  return v === true || v === 1 || s === "1" || s === "true" || s === "pago";
};

const getPaid = (t: any) => {
  // suporte aos dois nomes (paid/pago)
  if (t && "paid" in t) return isPaidValue((t as any).paid);
  return isPaidValue((t as any)?.pago);
};

const safeNumber = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const normFc = (v: any) => String(v ?? "").trim().toLowerCase();

const isTransfer = (t: any) => {
  if (!t) return false;

  // itens "mesclados" (display only) geralmente começam com tr_
  const idStr = String(t.id ?? "");
  if (idStr.startsWith("tr_")) return true;

  const cat = String(t.categoria ?? "").toLowerCase();
  const tipo = String(t.tipo ?? "").toLowerCase();

  const hasTid = Boolean(t.transferId ?? t.transferID ?? t.transfer_id);
  if (hasTid) return true;

  if (cat.includes("transfer")) return true;
  if (tipo.includes("transfer")) return true;

  return false;
};

type ProfileLike = {
  id: any;
  initialBalanceCents?: number | null;
};

function getInitialBalance(profiles: ProfileLike[], filtroConta: string) {
  const fc = normFc(filtroConta);

  // todas/vazio
  const isTodas =
    fc === "" ||
    fc === "todas" ||
    fc === "todas as contas" ||
    fc === "todas_as_contas";

  if (isTodas) {
    const totalCents = (profiles || []).reduce(
      (acc, p) => acc + safeNumber(p?.initialBalanceCents),
      0
    );
    return totalCents / 100;
  }

  // sem conta
  if (fc === "sem_conta") return 0;

  // conta específica
  const id = asId(filtroConta);
  const p = (profiles || []).find((x: any) => asId(x?.id) === id);
  return safeNumber(p?.initialBalanceCents) / 100;
}

type PassarFiltroContaFn = (
  t: any,
  filtroConta: string,
  activeProfileId: string
) => boolean;

type Params = {
  // aceitamos os 2 nomes pra não quebrar o App.tsx
  transactions?: Transaction[];
  transacoes?: Transaction[];

  filtroMes: string;
  filtroConta: string;

  profiles: ProfileLike[];

  // aceitamos os 2 nomes pra não quebrar variações
  passarFiltroConta?: PassarFiltroContaFn;
  passaFiltroConta?: PassarFiltroContaFn;
};

export function useStatsMes(params: Params) {
  return useMemo(() => {
    const txs: any[] = (params.transactions ?? params.transacoes ?? []) as any[];

    const filtroMes = String(params.filtroMes ?? "");
    const filtroConta = String(params.filtroConta ?? "");
    const profiles = (params.profiles ?? []) as any[];

    const passarFiltroConta =
      params.passarFiltroConta ?? params.passaFiltroConta;

    const fc = normFc(filtroConta);
    const activeProfileId = fc; // compat com tua fn (que usa isso)

    // aplica filtro de conta (se existir a fn)
    const txAll = passarFiltroConta
      ? txs.filter((t) => passarFiltroConta(t, filtroConta, activeProfileId))
      : txs;

    // saldo total: saldo inicial + soma de valores PAGOS (inclui transferências)
    // (ignora itens mesclados tr_ pra não distorcer caso passem por engano)
    const saldoInicial = getInitialBalance(profiles, filtroConta);

    let saldoMov = 0;
    for (const t of txAll) {
      if (!t) continue;
      if (String(t.id ?? "").startsWith("tr_")) continue; // display-only
      if (!getPaid(t)) continue;

      saldoMov += safeNumber(t.valor);
    }

    const saldoTotal = safeNumber(saldoInicial + saldoMov);

    // ====== mês: entradas/saídas (SEM transferências) ======
    const mes = String(filtroMes ?? "").slice(0, 7); // "YYYY-MM"
    const txMes = mes
      ? txAll.filter((t) => String(t?.data ?? "").slice(0, 7) === mes)
      : txAll;

    let receitasMes = 0;
    let despesasMes = 0;
    let pendenteReceita = 0;
    let pendenteDespesa = 0;

    for (const t of txMes) {
      if (!t) continue;

      // NÃO conta transferências em entradas/saídas do mês
      if (isTransfer(t)) continue;

      const valor = safeNumber(t.valor);
      const tipo = String(t.tipo ?? "").toLowerCase();

      const pago = getPaid(t);

      // receita
      const isRec = tipo === "receita" || valor > 0;
      // despesa
      const isDesp = tipo === "despesa" || valor < 0;

      if (isRec) {
        if (pago) receitasMes += Math.abs(valor);
        else pendenteReceita += Math.abs(valor);
      } else if (isDesp) {
        if (pago) despesasMes += Math.abs(valor);
        else pendenteDespesa += Math.abs(valor);
      }
    }

    return {
      saldoTotal: safeNumber(saldoTotal),
      receitasMes: safeNumber(receitasMes),
      despesasMes: safeNumber(despesasMes),
      pendenteReceita: safeNumber(pendenteReceita),
      pendenteDespesa: safeNumber(pendenteDespesa),
    };
  }, [
    params.transactions,
    params.transacoes,
    params.filtroMes,
    params.filtroConta,
    params.profiles,
    params.passarFiltroConta,
    params.passaFiltroConta,
  ]);
}
