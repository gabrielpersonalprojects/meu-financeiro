import type { CreditInvoiceStatus } from "../types";

export type CreditInvoiceSummaryStatus =
  | "paga"
  | "parcelada"
  | "atrasada"
  | "fechada"
  | "aberta";

export const creditInvoiceStatusLabel: Record<CreditInvoiceStatus, string> = {
  PAGA: "Paga",
  FUTURA: "Futura",
  EM_ABERTO: "Em aberto",
  PENDENTE: "Pendente",
  ATRASADA: "Em atraso",
  ZERADA: "Zerada",
  FECHADA: "Fechada",
};

export const creditInvoiceStatusClass: Record<CreditInvoiceStatus, string> = {
  PAGA:
    "border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  ZERADA:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200",
  FECHADA:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200",
  FUTURA:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200",
  EM_ABERTO:
    "border-sky-300/60 bg-sky-50 text-sky-800 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-300",
  PENDENTE:
    "border-amber-300/70 bg-amber-50 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-300",
  ATRASADA:
    "border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300",
};

export const getCreditInvoiceSummaryStatusLabel = (
  status: CreditInvoiceSummaryStatus
) => {
  if (status === "paga") return "Paga";
  if (status === "parcelada") return "Parcelada";
  if (status === "atrasada") return "Em atraso";

  return "Fatura";
};

export const getCreditInvoiceSummaryStatusClass = (
  status: CreditInvoiceSummaryStatus
) => {
  if (status === "paga") {
    return "border-emerald-300/50 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300";
  }

  if (status === "parcelada") {
    return "border-violet-300/60 bg-violet-50 text-violet-800 dark:border-violet-400/20 dark:bg-violet-500/10 dark:text-violet-300";
  }

  if (status === "atrasada") {
    return "border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300";
  }

  return "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200";
};