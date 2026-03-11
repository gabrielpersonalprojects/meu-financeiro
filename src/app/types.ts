export type TransactionType =
  | "despesa"
  | "receita"
  | "transferencia"
  | "cartao_credito";

export type SpendingType = "normal" | "fixo" | "parcelado";

export type TabType = "transacoes" | "gastos" | "projecao" | "ajustes";

export type PaymentMethod =
  | "pix"
  | "boleto"
  | "dinheiro"
  | "debito"
  | "credito";

export type Categories = {
  despesa: string[];
  receita: string[];
};

export type PaymentMethods = {
  credito: string[];
  debito: string[];
};

export interface Transaction {
  id: string | number;
  tipo: TransactionType;
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
  categoria: string;
  qualConta?: string;

  // conta/banco (id da conta/profile)
  contaId?: string;
  profileId?: string;

  tipoGasto: SpendingType | "";
  paymentMethod?: PaymentMethod;
  metodoPagamento?: PaymentMethod;
  tag?: string;

  qualCartao: string;
  pago: boolean;
  paid?: boolean;

  // opcionais
  recorrenciaId?: string;
  isRecorrente?: boolean;
  recorrente?: boolean;
  createdAt?: number;

  // cartão / parcelamento
  cartaoId?: string;
  parcelaAtual?: number;
  totalParcelas?: number;
  origemLancamento?: "manual" | "compra_parcelada" | "parcelamento_fatura";
  parcelamentoFaturaId?: string;
  faturaOrigemCicloKey?: string;
}

export type PagamentoFaturaApp = {
  id: string;
  cartaoId: string;
  cicloKey: string;
  dataPagamento: string; // YYYY-MM-DD
  valor: number;
  contaId: string;
  contaLabel: string;
  criadoEm: number;
  transacaoId?: number;
};

export type ParcelamentoFaturaApp = {
  id: string;
  cartaoId: string;
  cicloKeyOrigem: string;
  dataAcordo: string; // YYYY-MM-DD

  valorOriginal: number;
  valorEntrada: number;
  saldoParcelado: number;

  quantidadeParcelas: number;
  valorParcela: number;
  valorTotalFinal: number;
  jurosTotal: number;

  criadoEm: number;
  status: "ativo" | "quitado";
};

export type FaturaStatusManualApp = {
  id: string;
  cartaoId: string;
  cicloKey: string;
  statusManual: "parcelada";
  parcelamentoFaturaId: string;
  criadoEm: number;
};

export type Profile = {
  id: string;
  name: string;

  banco?: string;
  numeroConta?: string;
  numeroAgencia?: string;

  initialBalanceCents?: number;

  perfilConta?: "PF" | "PJ";
  tipoConta?: string;
  possuiCartaoCredito?: boolean;
  limiteCartao?: number;
  diaFechamento?: number;
  diaVencimento?: number;
};