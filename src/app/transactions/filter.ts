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

  list = mergeTransfers(list);
  list = list.filter(passarFiltroConta);

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
  setFiltroLancamento: Dispatch<SetStateAction<"despesa" | "receita" | "todos">>;
  setFiltroCategoria: Dispatch<SetStateAction<string>>;
  setFiltroMetodo: Dispatch<SetStateAction<string>>;
  setFiltroTipoGasto: Dispatch<SetStateAction<string>>;
}) {
  const {
    setFiltroMes,
    setFiltroLancamento,
    setFiltroCategoria,
    setFiltroMetodo,
    setFiltroTipoGasto,
  } = setters;

  setFiltroMes(getHojeLocal().substring(0, 7));
  setFiltroLancamento("todos");
  setFiltroCategoria("");
  setFiltroMetodo("");
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

  const fcRaw = String(filtroConta ?? "").trim();
  const fcN = norm(fcRaw);

  const isTodas =
    fcN === "" ||
    fcN === "todas" ||
    fcN === "todas as contas" ||
    fcN === "todas contas" ||
    fcN === "todas_as_contas";

  if (isTodas) return (_t: Transaction) => true;

  const isSemConta =
    fcN === "sem conta" || fcN === "sem contas" || fcN === "sem_conta" || fcN === "semconta";

  const list = Array.isArray(profiles) ? profiles : [];

  // resolve filtro para um profile real (id OU nome)
  const resolvedProfile =
    list.find((p: any) => String(p?.id ?? "") === fcRaw) ??
    list.find((p: any) => norm(p?.name ?? p?.banco ?? "") === fcN) ??
    list.find((p: any) => {
      const label = norm(p?.name ?? p?.banco ?? "");
      return label && (fcN.includes(label) || label.includes(fcN));
    }) ??
    null;

  const targetId = String(resolvedProfile?.id ?? "").trim();
  const targetNameN = norm(String(resolvedProfile?.name ?? resolvedProfile?.banco ?? ""));

  const pickIds = (anyT: any) => {
    const vals = [
      anyT?.profileId,
      anyT?.contaId,
      anyT?.accountId,

      anyT?.contaOrigemId,
      anyT?.contaDestinoId,

      anyT?.fromAccountId,
      anyT?.toAccountId,
    ]
      .map((v: any) => String(v ?? "").trim())
      .filter(Boolean);

    return new Set(vals);
  };

  const pickNames = (anyT: any) => {
    const vals = [
      anyT?.banco,
      anyT?.bank,
      anyT?.bankId,
      anyT?.conta,
      anyT?.contaNome,
      anyT?.profileName,
      anyT?.accountName,
      anyT?.labelConta,
      anyT?.nomeConta,

      anyT?.contaOrigem,
      anyT?.contaDestino,
      anyT?.origemLabel,
      anyT?.destinoLabel,
    ]
      .map((v: any) => String(v ?? "").trim())
      .filter(Boolean)
      .map(norm);

    return new Set(vals);
  };

  if (isSemConta) {
    return (t: Transaction) => {
      const anyT: any = t as any;
      const ids = pickIds(anyT);
      const names = pickNames(anyT);
      return ids.size === 0 && names.size === 0;
    };
  }

  return (t: Transaction) => {
    const anyT: any = t as any;
    const ids = pickIds(anyT);
    const names = pickNames(anyT);

    // 1) match por ID (quando filtro é id ou resolvemos um id)
    if (targetId && ids.has(targetId)) return true;

    // 2) match por nome (quando dropdown guarda label/nome)
    if (targetNameN && names.has(targetNameN)) return true;
    if (fcN && names.has(fcN)) return true;

    // 3) match por inclusão (ex: "PF Itau c/c" vs "Itau c/c")
    for (const n of names) {
      if (targetNameN && (n.includes(targetNameN) || targetNameN.includes(n))) return true;
      if (fcN && (n.includes(fcN) || fcN.includes(n))) return true;
    }

    return false;
  };
}
