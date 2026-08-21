import type { CreditInvoicePayment, CreditTransactionUI } from "../types";
import {
  getCreditCardTransactionsByInvoiceMonth,
  sumCreditTransactionsAbs,
} from "./creditTransactions";
import {
  getInvoicePaymentsByCycle,
  getInvoiceRemainingBalance,
  sumInvoicePayments,
} from "./invoicePayments";

export const calculateCreditInvoice = ({
  transactions,
  payments,
  cartaoId,
  monthKey,
  cicloKey,
  diaFechamento,
  diaVencimento,
}: {
  transactions: CreditTransactionUI[];
  payments: CreditInvoicePayment[];
  cartaoId: string;
  monthKey: string;
  cicloKey: string;
  diaFechamento: number;
  diaVencimento: number;
}) => {
  const invoiceTransactions = getCreditCardTransactionsByInvoiceMonth({
    transactions,
    cartaoId,
    monthKey,
    diaFechamento,
    diaVencimento,
  });
  const invoicePayments = getInvoicePaymentsByCycle({
    payments,
    cartaoId,
    cicloKey,
  });
  const total = sumCreditTransactionsAbs(invoiceTransactions);
  const paid = sumInvoicePayments(invoicePayments);

  return {
    transactions: invoiceTransactions,
    payments: invoicePayments,
    total,
    paid,
    remaining: getInvoiceRemainingBalance({ invoiceTotal: total, paidTotal: paid }),
  };
};
