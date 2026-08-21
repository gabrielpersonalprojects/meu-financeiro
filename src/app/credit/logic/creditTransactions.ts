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

  const cardTransactions = getCreditCardTransactions({
    transactions,
    cartaoId,
  });
  const referencedParentIds = new Set(
    cardTransactions
      .map((tx: any) =>
        String(
          tx?.parentId ??
            tx?.parent_id ??
            tx?.payload?.parentId ??
            tx?.payload?.parent_id ??
            ""
        ).trim()
      )
      .filter(Boolean)
  );

  return cardTransactions.filter((tx: any) => {
    if (referencedParentIds.has(String(tx?.id ?? "").trim())) return false;

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
