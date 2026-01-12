export type TransactionType = "despesa" | "receita";
export type SpendingType = "Fixo" | "Variável";
export type TabType = 'transacoes' | 'gastos' | 'projecao' | 'ajustes';

export type PaymentMethod = "" | "pix" | "credito_vista" | "debito" | "boleto";

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
  tipoGasto: SpendingType | "";
  metodoPagamento: PaymentMethod;
  qualCartao: string;
  pago: boolean;

  // opcionais
  recorrenciaId?: string;
  isRecorrente?: boolean;
}
