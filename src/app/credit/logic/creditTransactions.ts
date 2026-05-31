import type { CreditTransactionUI } from "../types";
import { getCreditTransactionCardRef } from "./cardRefs";
import { getInvoiceMonthKeyForTransaction } from "./cardCycles";
import { roundMoney } from "./invoiceStatus";

export const isCreditCardTransaction = (tx: any) => {
  return String(tx?.tipo ?? "").trim().toLowerCase() === "cartao_credito";
};

export const getCreditCardTransactions = ({
  transactions,
  cartaoId,
}: {
  transactions: CreditTransactionUI[];
  cartaoId: string;
}) => {
  const safeCartaoId = String(cartaoId ?? "").trim();

  if (!safeCartaoId) return [];

  return (transactions ?? []).filter((tx: any) => {
    if (!isCreditCardTransaction(tx)) return false;
    return getCreditTransactionCardRef(tx) === safeCartaoId;
  });
};

export const getCreditCardTransactionsByInvoiceMonth = ({
  transactions,
  cartaoId,
  monthKey,
  diaFechamento,
  diaVencimento,
}: {
  transactions: CreditTransactionUI[];
  cartaoId: string;
  monthKey: string;
  diaFechamento: number;
  diaVencimento: number;
}) => {
  const safeMonthKey = String(monthKey ?? "").trim();

  if (!safeMonthKey) return [];

  return getCreditCardTransactions({
    transactions,
    cartaoId,
  }).filter((tx: any) => {
    const dataTx = String(tx?.data ?? "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataTx)) {
      return false;
    }

    return (
      getInvoiceMonthKeyForTransaction({
        iso: dataTx,
        diaFechamento,
        diaVencimento,
      }) === safeMonthKey
    );
  });
};

export const sumCreditTransactionsAbs = (transactions: CreditTransactionUI[]) => {
  return roundMoney(
    (transactions ?? []).reduce(
      (acc, tx: any) => acc + Math.abs(Number(tx?.valor) || 0),
      0
    )
  );
};