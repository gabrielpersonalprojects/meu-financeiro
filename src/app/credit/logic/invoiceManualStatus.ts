import type {
  CreditInvoiceManualStatus,
  CreditInvoiceManualStatusRecord,
} from "../types";

export const isInvoiceManualStatusResolved = (
  status: CreditInvoiceManualStatus | null | undefined
) => {
  const normalized = String(status ?? "").trim().toLowerCase();

  return normalized === "paga" || normalized === "parcelada";
};

export const isInvoiceManualStatusPaid = (
  status: CreditInvoiceManualStatus | null | undefined
) => {
  return String(status ?? "").trim().toLowerCase() === "paga";
};

export const isInvoiceManualStatusInstallment = (
  status: CreditInvoiceManualStatus | null | undefined
) => {
  return String(status ?? "").trim().toLowerCase() === "parcelada";
};

export const findInvoiceManualStatusByCycle = ({
  items,
  cartaoId,
  cicloKey,
}: {
  items: CreditInvoiceManualStatusRecord[];
  cartaoId: string;
  cicloKey: string;
}) => {
  const safeCartaoId = String(cartaoId ?? "").trim();
  const safeCicloKey = String(cicloKey ?? "").trim();

  if (!safeCartaoId || !safeCicloKey) return null;

  return (
    (items ?? []).find(
      (item) =>
        String(item?.cartaoId ?? "").trim() === safeCartaoId &&
        String(item?.cicloKey ?? "").trim() === safeCicloKey
    ) ?? null
  );
};

export const buildInvoiceManualStatusRecord = ({
  id,
  cartaoId,
  cicloKey,
  statusManual,
  parcelamentoFaturaId = null,
  criadoEm,
}: {
  id: string;
  cartaoId: string;
  cicloKey: string;
  statusManual: CreditInvoiceManualStatus;
  parcelamentoFaturaId?: string | null;
  criadoEm: number;
}): CreditInvoiceManualStatusRecord => {
  return {
    id,
    cartaoId: String(cartaoId),
    cicloKey: String(cicloKey),
    statusManual,
    parcelamentoFaturaId,
    criadoEm,
  };
};