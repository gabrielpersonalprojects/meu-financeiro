export type CreditCardProfile = "pf" | "pj";

export type CreditInvoiceManualStatus =
  | "aberta"
  | "fechada"
  | "paga"
  | "atrasada"
  | "parcelada"
  | string;

export type CreditCardUI = {
  id: string;
  nome: string;
  titular: string;
  limiteTotal: number;
  diaFechamento: number;
  diaVencimento: number;
  bankText?: string;
  categoria?: string;
  brand: string;
  perfil?: CreditCardProfile;
  last4: string;
  gradientFrom?: string;
  gradientTo?: string;
};

export type CreditCategoryLike =
  | string
  | {
      nome?: string;
      label?: string;
      value?: string;
      id?: string;
    }
  | null
  | undefined;

export type CreditTransactionUI = {
  id: string;
  tipo: "cartao_credito" | "despesa" | "receita" | "transferencia";
  valor: number;
  data: string;
  descricao?: string;
  categoria?: CreditCategoryLike;
  tag?: string;
  criadoEm?: number;
  pago?: boolean;
  cartaoId?: string;
  qualCartao?: string;
  parcelaAtual?: number;
  totalParcelas?: number;
  parcelasTotal?: number;
  origemLancamento?: "manual" | "compra_parcelada" | "parcelamento_fatura";
  parcelamentoFaturaId?: string;
  faturaOrigemCicloKey?: string;
  payload?: any;
};

export type CreditInvoicePayment = {
  id: string;
  cartaoId: string;
  cicloKey: string;
  dataPagamento: string;
  valor: number;
  contaId?: string | null;
  contaLabel?: string | null;
  criadoEm?: number | null;
  transacaoId?: string | null;
  snapshotCreatedAtMs?: number | null;
};

export type CreditInvoiceInstallment = {
  id: string;
  cartaoId: string;
  cicloKeyOrigem: string;
  dataAcordo: string;
  valorOriginal: number;
  valorEntrada: number;
  saldoParcelado: number;
  quantidadeParcelas: number;
  valorParcela: number;
  valorTotalFinal: number;
  jurosTotal: number;
  criadoEm?: number | null;
  status: "ativo" | "cancelado" | "concluido" | "quitado" | string;
};

export type CreditInvoiceManualStatusRecord = {
  id: string;
  cartaoId: string;
  cicloKey: string;
  statusManual: CreditInvoiceManualStatus;
  parcelamentoFaturaId?: string | null;
  criadoEm?: number | null;
};

export type CreditInvoiceStatus =
  | "PAGA"
  | "ZERADA"
  | "FECHADA"
  | "FUTURA"
  | "EM_ABERTO"
  | "PENDENTE"
  | "ATRASADA";