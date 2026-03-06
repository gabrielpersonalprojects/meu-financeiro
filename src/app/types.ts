export type TransactionType =
  | "despesa"
  | "receita"
  | "transferencia"
  | "cartao_credito";

export type SpendingType = "Fixo" | "Variável";

export type TabType = "transacoes" | "gastos" | "projecao" | "ajustes";

export type PaymentMethod =
  | "pix"
  | "transferencia_bancaria"
  | "debito_conta"
  | "boleto"
  | "dinheiro";

export type Categories = {
  despesa: string[];
  receita: string[];
};

export type PaymentMethods = {
  credito: string[];
  debito: string[];
};

export interface Transaction {
  id: number;
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
  metodoPagamento?: PaymentMethod;

  qualCartao: string;
  pago: boolean;

  // opcionais
  recorrenciaId?: string;
  isRecorrente?: boolean;
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

