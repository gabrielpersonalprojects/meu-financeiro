import { supabase } from "../lib/supabase";

export type InvoicePaymentRow = {
  id: string;
  user_id: string;
  credit_card_id: string;
  ciclo_key: string;
  payment_date: string;
  amount: number | string;
  account_id: string | null;
  account_label: string | null;
  transaction_id: string | null;
  created_at?: string;
  updated_at?: string;
};

export type InvoicePaymentApp = {
  id: string;
  cartaoId: string;
  cicloKey: string;
  dataPagamento: string;
  valor: number;
  contaId?: string | null;
  contaLabel?: string | null;
  transacaoId?: string | null;
};

export const mapInvoicePaymentRowToApp = (
  row: InvoicePaymentRow
): InvoicePaymentApp => {
  return {
    id: row.id,
    cartaoId: row.credit_card_id,
    cicloKey: row.ciclo_key,
    dataPagamento: row.payment_date,
    valor: Number(row.amount ?? 0),
    contaId: row.account_id ?? null,
    contaLabel: row.account_label ?? null,
    transacaoId: row.transaction_id ?? null,
  };
};

export const mapInvoicePaymentAppToInsert = (
  payment: InvoicePaymentApp,
  userId: string
) => {
  return {
    id: payment.id,
    user_id: userId,
    credit_card_id: payment.cartaoId,
    ciclo_key: payment.cicloKey,
    payment_date: payment.dataPagamento,
    amount: Number(payment.valor ?? 0),
    account_id: payment.contaId ?? null,
    account_label: payment.contaLabel ?? null,
    transaction_id: payment.transacaoId ?? null,
  };
};

export async function fetchInvoicePayments(): Promise<InvoicePaymentRow[]> {
  const { data, error } = await supabase
    .from("invoice_payments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InvoicePaymentRow[];
}

export async function insertInvoicePayment(
  row: ReturnType<typeof mapInvoicePaymentAppToInsert>
) {
  const { data, error } = await supabase
    .from("invoice_payments")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data as InvoicePaymentRow;
}

export async function deleteInvoicePaymentById(id: string) {
  const { error } = await supabase
    .from("invoice_payments")
    .delete()
    .eq("id", id);

  if (error) throw error;
}