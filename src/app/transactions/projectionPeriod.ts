import type { Transaction } from "../types";

const pad2 = (value: number) => String(value).padStart(2, "0");

const normalizeReference = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const findProjectionCard = (transaction: any, creditCards: any[]) => {
  const references = [
    transaction?.cartaoId,
    transaction?.qualCartao,
    transaction?.creditCardId,
    transaction?.selectedCreditCardId,
    transaction?.payload?.cartaoId,
    transaction?.payload?.qualCartao,
    transaction?.payload?.creditCardId,
    transaction?.payload?.selectedCreditCardId,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return (creditCards ?? []).find((card: any) => {
    const candidates = [card?.id, card?.name, card?.nome, card?.emissor, card?.bankText]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);

    return references.some((reference) =>
      candidates.some((candidate) => normalizeReference(candidate) === normalizeReference(reference))
    );
  }) ?? null;
};

/**
 * Retorna o mesmo mês de competência usado pela tabela de projeção.
 * Para contas, usa a data do lançamento. Para cartões, respeita faturaMes
 * ou calcula a fatura a partir do fechamento/vencimento do cartão.
 */
export const getProjectionTransactionPeriod = (
  transaction: Transaction | any,
  creditCards: any[] = []
) => {
  const type = String(transaction?.tipo ?? "").trim().toLowerCase();
  const date = String(transaction?.data ?? "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  if (type !== "cartao_credito") return date.slice(0, 7);

  const savedInvoiceMonth = String(
    transaction?.faturaMes ?? transaction?.payload?.faturaMes ?? ""
  ).trim();

  if (/^\d{4}-\d{2}$/.test(savedInvoiceMonth)) return savedInvoiceMonth;

  const card = findProjectionCard(transaction, creditCards);
  if (!card) return date.slice(0, 7);

  const closingDay = Math.max(
    1,
    Math.min(31, Number(card?.diaFechamento ?? card?.closingDay ?? 1) || 1)
  );
  const dueDay = Math.max(
    1,
    Math.min(31, Number(card?.diaVencimento ?? card?.dueDay ?? 1) || 1)
  );
  const [year, month, day] = date.split("-").map(Number);
  const invoiceDate = new Date(year, month - 1, 1, 12, 0, 0, 0);

  if (day >= closingDay) invoiceDate.setMonth(invoiceDate.getMonth() + 1);
  if (dueDay <= closingDay) invoiceDate.setMonth(invoiceDate.getMonth() + 1);

  return `${invoiceDate.getFullYear()}-${pad2(invoiceDate.getMonth() + 1)}`;
};

export const isProjectionPeriodWithinRange = (
  period: string,
  startPeriod?: string,
  endPeriod?: string
) => {
  if (!/^\d{4}-\d{2}$/.test(period)) return false;
  if (startPeriod && period < startPeriod) return false;
  if (endPeriod && period > endPeriod) return false;
  return true;
};

export const formatProjectionPeriod = (period: string) => {
  if (!/^\d{4}-\d{2}$/.test(period)) return "Período inválido";
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1, 1, 12, 0, 0, 0);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};
