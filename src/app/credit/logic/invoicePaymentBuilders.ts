import type { CreditInvoicePayment } from "../types";

export const buildInvoicePayment = ({
  id,
  cartaoId,
  cicloKey,
  dataPagamento,
  valor,
  contaId,
  contaLabel,
  transacaoId,
  snapshotCreatedAtMs,
}: {
  id: string;
  cartaoId: string;
  cicloKey: string;
  dataPagamento: string;
  valor: number;
  contaId?: string | null;
  contaLabel?: string | null;
  transacaoId?: string | null;
  snapshotCreatedAtMs?: number | null;
}): CreditInvoicePayment => {
  return {
    id,
    cartaoId: String(cartaoId ?? ""),
    cicloKey: String(cicloKey ?? ""),
    dataPagamento: String(dataPagamento ?? ""),
    valor: Number(valor || 0),
    contaId: contaId ?? null,
    contaLabel: contaLabel ?? null,
    transacaoId: transacaoId ?? null,
    snapshotCreatedAtMs: snapshotCreatedAtMs ?? Date.now(),
    criadoEm: Date.now(),
  };
};

export const buildInvoicePaymentTransactionDescription = ({
  emissor,
  categoria,
}: {
  emissor?: string | null;
  categoria?: string | null;
}) => {
  const bancoFinal = String(emissor ?? "").trim() || "Cartão";
  const categoriaFinal = String(categoria ?? "").trim();

  return categoriaFinal ? `Fatura: ${bancoFinal} ${categoriaFinal}` : `Fatura: ${bancoFinal}`;
};