import { supabase } from "../lib/supabase";

export type TransactionRow = {
  id: string;
  user_id: string;
  tipo: "receita" | "despesa" | "transferencia" | "cartao_credito";
  valor: number;
  data: string;
  descricao: string;
  categoria: string;
  tag: string;
  pago: boolean;

  conta_id: string | null;
  conta_origem_id: string | null;
  conta_destino_id: string | null;
  cartao_id: string | null;

  transfer_from_id: string;
  transfer_to_id: string;
  qual_conta: string;
  criado_em?: number | null;

  payload?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
};

export async function fetchTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("data", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TransactionRow[];
}

export type InsertTransactionInput = {
  user_id: string;
  tipo: "receita" | "despesa" | "transferencia" | "cartao_credito";
  valor: number;
  data: string;
  descricao?: string;
  categoria?: string;
  tag?: string;
  pago?: boolean;

  conta_id?: string | null;
  conta_origem_id?: string | null;
  conta_destino_id?: string | null;
  cartao_id?: string | null;

  transfer_from_id?: string;
  transfer_to_id?: string;
  qual_conta?: string;
  criado_em?: number | null;

  payload?: Record<string, any>;
};

export async function insertTransaction(input: InsertTransactionInput) {
  const { data, error } = await supabase
    .from("transactions")
    .insert([
      {
        user_id: input.user_id,
        tipo: input.tipo,
        valor: input.valor,
        data: input.data,
        descricao: input.descricao ?? "",
        categoria: input.categoria ?? "",
        tag: input.tag ?? "",
        pago: input.pago ?? false,

        conta_id: input.conta_id ?? null,
        conta_origem_id: input.conta_origem_id ?? null,
        conta_destino_id: input.conta_destino_id ?? null,
        cartao_id: input.cartao_id ?? null,

        transfer_from_id: input.transfer_from_id ?? "",
        transfer_to_id: input.transfer_to_id ?? "",
        qual_conta: input.qual_conta ?? "",
        criado_em: input.criado_em ?? Date.now(),

        payload: input.payload ?? {},
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as TransactionRow;
}

export function mapTransactionRowToApp(row: TransactionRow) {
  const payload = row.payload ?? {};

  return {
    id: row.id,
    tipo: row.tipo,
    valor: Number(row.valor ?? 0),
    data: row.data,
    descricao: row.descricao ?? "",
    categoria: row.categoria ?? "",
    tag: row.tag ?? "",
    pago: !!row.pago,

    contaId: row.conta_id ?? undefined,
    contaOrigemId: row.conta_origem_id ?? undefined,
    contaDestinoId: row.conta_destino_id ?? undefined,
    qualCartao: row.cartao_id ?? payload.qualCartao ?? "",

    transferFromId: row.transfer_from_id ?? "",
    transferToId: row.transfer_to_id ?? "",
    qualConta: row.qual_conta ?? "",
    criadoEm: row.criado_em ?? undefined,

    metodoPagamento: payload.metodoPagamento ?? "",
    tipoGasto: payload.tipoGasto ?? "",
    recorrenciaId: payload.recorrenciaId ?? "",
    isRecorrente: payload.isRecorrente ?? false,
    contraParte: payload.contraParte ?? "",
    transferId: payload.transferId ?? "",
    observacoes: payload.observacoes ?? "",
    parcelaAtual: payload.parcelaAtual ?? undefined,
    totalParcelas: payload.totalParcelas ?? undefined,
  };
}

export async function updateTransactionPago(id: string, pago: boolean) {
  const { data, error } = await supabase
    .from("transactions")
    .update({ pago })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as TransactionRow;
}

export async function updateTransactionById(
  id: string,
  updates: Partial<{
    valor: number;
    data: string;
    descricao: string;
    categoria: string;
    tag: string;
    pago: boolean;
    payload: Record<string, any>;
  }>
) {
  const { data, error } = await supabase
    .from("transactions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as TransactionRow;
}

export async function deleteTransactionById(id: string) {
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function updateTransactionsPagoByTransferId(
  transferId: string,
  pago: boolean
) {
  const { data: rows, error: fetchError } = await supabase
    .from("transactions")
    .select("id, payload");

  if (fetchError) throw fetchError;

  const ids = (rows ?? [])
    .filter((r: any) => String(r?.payload?.transferId ?? "") === String(transferId))
    .map((r: any) => r.id);

  if (!ids.length) return [];

  const { data, error } = await supabase
    .from("transactions")
    .update({ pago })
    .in("id", ids)
    .select();

  if (error) throw error;
  return data as TransactionRow[];
}