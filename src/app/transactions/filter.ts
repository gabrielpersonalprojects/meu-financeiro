// src/app/transactions/filter.ts
import type { Transaction, TransactionType } from "../types";
import { getHojeLocal } from "../../domain/date";
import type { Dispatch, SetStateAction } from "react";

export type LancamentoFiltro = TransactionType | "todos";

export type MergeTransfersFn = (list: Transaction[]) => Transaction[];
export type PassarFiltroContaFn = (t: Transaction) => boolean;

export const buildFilteredTransactions = (
  transacoes: Transaction[],
  params: {
    filtroMes?: string;
    filtroLancamento: LancamentoFiltro;
    filtroCategoria?: string;
    filtroMetodo?: string;
    filtroTipoGasto?: string;

    // mantido só pra você usar no dependency array do useMemo
    _filtroConta?: unknown;
  },
  mergeTransfers: MergeTransfersFn,
  passarFiltroConta: PassarFiltroContaFn
): Transaction[] => {
  const {
    filtroMes,
    filtroLancamento,
    filtroCategoria,
    filtroMetodo,
    filtroTipoGasto,
  } = params;

  let list = [...transacoes];

  if (filtroMes) list = list.filter((t) => String(t.data ?? "").startsWith(filtroMes));
  if (filtroCategoria) list = list.filter((t) => t.categoria === filtroCategoria);
  if (filtroMetodo) list = list.filter((t: any) => t.metodoPagamento === filtroMetodo);
  if (filtroTipoGasto) list = list.filter((t: any) => t.tipoGasto === filtroTipoGasto);

  list = list.filter(passarFiltroConta);
  list = mergeTransfers(list);

  if (filtroLancamento !== "todos") {
    list = list.filter((t) => t.tipo === filtroLancamento);
  }

  const order = (tipo: TransactionType) => {
    if (tipo === "receita") return 0;
    if (tipo === "despesa") return 1;
    if (tipo === "cartao_credito") return 2;
    return 3; // transferencia
  };

  return list.sort((a, b) => {
    const oa = order(a.tipo);
    const ob = order(b.tipo);
    if (oa !== ob) return oa - ob;
    return new Date(b.data).getTime() - new Date(a.data).getTime();
  });
};

export const buildFilteredTransactionsByYear = (
  transacoes: Transaction[],
  anoRef: string,
  params: {
    filtroLancamento: LancamentoFiltro;
    filtroCategoria?: string;
    filtroMetodo?: string;
    filtroTipoGasto?: string;
    _filtroConta?: unknown;
  },
  mergeTransfers: MergeTransfersFn,
  passarFiltroConta: PassarFiltroContaFn
): Transaction[] => {
  const { filtroLancamento, filtroCategoria, filtroMetodo, filtroTipoGasto } = params;

  let list = [...transacoes];

  if (filtroCategoria) list = list.filter((t) => t.categoria === filtroCategoria);
  if (filtroMetodo) list = list.filter((t: any) => t.metodoPagamento === filtroMetodo);
  if (filtroTipoGasto) list = list.filter((t: any) => t.tipoGasto === filtroTipoGasto);

  list = mergeTransfers(list);
  list = list.filter(passarFiltroConta);

  // mantém só o ano
  list = list.filter((t) => String(t.data ?? "").startsWith(anoRef));

  // filtra tipo por último (pra não atrapalhar merge/filtro)
  if (filtroLancamento !== "todos") {
    list = list.filter((t) => t.tipo === filtroLancamento);
  }

  return list.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
};

export function limparFiltros(setters: {
  setFiltroMes: Dispatch<SetStateAction<string>>;
  setFiltroLancamento: Dispatch<SetStateAction<"despesa" | "receita" | "todos" | "transferencia">>;
  setFiltroConta?: Dispatch<SetStateAction<string>>;
  setFiltroCategoria: Dispatch<SetStateAction<string>>;
  setFiltroTipoGasto: Dispatch<SetStateAction<string>>;
}) {
  const {
    setFiltroMes,
    setFiltroLancamento,
    setFiltroCategoria,
    setFiltroTipoGasto,
  } = setters;

  setFiltroMes(getHojeLocal().slice(0, 7));
  setFiltroLancamento("todos");
  setFiltroCategoria("");
  setFiltroTipoGasto("");
}

export function passaFiltroContaFactory(filtroConta: unknown, profiles: any[]) {
  const norm = (s: string) =>
    String(s ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const normId = (v: any) => String(v ?? "").trim().replace(/^acc_/, "");

  const fcRaw = String(filtroConta ?? "").trim();
  const fcN = norm(fcRaw);

  const isTodas =
    fcN === "" ||
    fcN === "todas" ||
    fcN === "todas as contas" ||
    fcN === "todas contas" ||
    fcN === "todas_as_contas";

  if (isTodas) return (_t: Transaction) => true;

  const list = Array.isArray(profiles) ? profiles : [];

  const resolvedProfile =
    list.find((p: any) => normId(p?.id) === normId(fcRaw)) ??
    list.find((p: any) => norm(p?.name ?? p?.banco ?? "") === fcN) ??
    null;

  const targetIdN = normId(resolvedProfile?.id ?? fcRaw);

  // mantém fallback em profileId/accountId para compatibilidade com dados antigos
  const getContaIdN = (t: any) => normId(t?.contaId ?? t?.profileId ?? t?.accountId ?? "");

  const getTransferIdsN = (t: any) => {
    const o = normId(t?.contaOrigemId ?? t?.fromAccountId ?? "");
    const d = normId(t?.contaDestinoId ?? t?.toAccountId ?? "");
    return { o, d };
  };

  return (t: Transaction) => {
    const anyT: any = t as any;
    const contaIdN = getContaIdN(anyT);

    if (contaIdN && contaIdN === targetIdN) return true;

    const { o, d } = getTransferIdsN(anyT);
    if (o && o === targetIdN) return true;
    if (d && d === targetIdN) return true;

    return false;
  };
}