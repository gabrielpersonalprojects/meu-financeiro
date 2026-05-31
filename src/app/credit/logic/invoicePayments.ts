import type { CreditInvoicePayment } from "../types";
import { roundMoney } from "./invoiceStatus";

export const getInvoicePaymentsByCycle = ({
  payments,
  cartaoId,
  cicloKey,
}: {
  payments: CreditInvoicePayment[];
  cartaoId: string;
  cicloKey: string;
}) => {
  const safeCartaoId = String(cartaoId ?? "").trim();
  const safeCicloKey = String(cicloKey ?? "").trim();

  if (!safeCartaoId || !safeCicloKey) return [];

  return (payments ?? [])
    .filter(
      (payment) =>
        String(payment?.cartaoId ?? "").trim() === safeCartaoId &&
        String(payment?.cicloKey ?? "").trim() === safeCicloKey
    )
    .sort((a, b) => {
      const criadoA = Number(a?.criadoEm ?? 0);
      const criadoB = Number(b?.criadoEm ?? 0);

      if (criadoA !== criadoB) return criadoB - criadoA;

      return String(b?.dataPagamento ?? "").localeCompare(
        String(a?.dataPagamento ?? "")
      );
    });
};

export const sumInvoicePayments = (payments: CreditInvoicePayment[]) => {
  return roundMoney(
    (payments ?? []).reduce(
      (acc, payment) => acc + Math.abs(Number(payment?.valor) || 0),
      0
    )
  );
};

export const getInvoiceRemainingBalance = ({
  invoiceTotal,
  paidTotal,
}: {
  invoiceTotal: number;
  paidTotal: number;
}) => {
  return roundMoney(Math.max(0, Number(invoiceTotal || 0) - Number(paidTotal || 0)));
};