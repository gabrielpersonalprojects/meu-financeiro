import type { CreditInvoiceStatus } from "../types";

export const roundMoney = (value: number) => {
  const n = Number(value || 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
};

export const getCreditInvoiceStatus = ({
  valorFatura,
  saldoPendente,
  hoje,
  cicloInicio,
  cicloFim,
  vencimento,
}: {
  valorFatura: number;
  saldoPendente: number;
  hoje: Date;
  cicloInicio: Date;
  cicloFim: Date;
  vencimento: Date;
}): CreditInvoiceStatus => {
  const valorFaturaNum = Math.abs(Number(valorFatura || 0));
  const saldoPendenteNum = Math.max(0, Number(saldoPendente || 0));

  if (valorFaturaNum <= 0 && saldoPendenteNum <= 0) return "ZERADA";
  if (valorFaturaNum > 0 && saldoPendenteNum <= 0) return "PAGA";
  if (hoje < cicloInicio) return "FUTURA";
  if (hoje <= cicloFim) return "EM_ABERTO";
  if (hoje <= vencimento) return "FECHADA";
  return "ATRASADA";
};