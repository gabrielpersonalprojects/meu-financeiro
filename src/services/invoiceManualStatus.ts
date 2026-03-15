import { supabase } from "../lib/supabase";

export type InvoiceManualStatusValue =
  | "aberta"
  | "fechada"
  | "paga"
  | "atrasada"
  | "parcelada"
  | string;

export type InvoiceManualStatusRow = {
  id: string;
  user_id: string;
  cartao_id: string;
  ciclo_key: string;
  status_manual: InvoiceManualStatusValue;
  parcelamento_fatura_id: string | null;
  criado_em?: number | null;
  created_at?: string;
};

export type InvoiceManualStatusApp = {
  id: string;
  cartaoId: string;
  cicloKey: string;
  statusManual: InvoiceManualStatusValue;
  parcelamentoFaturaId?: string | null;
  criadoEm?: number | null;
};

export const mapInvoiceManualStatusRowToApp = (
  row: InvoiceManualStatusRow
): InvoiceManualStatusApp => {
  return {
    id: row.id,
    cartaoId: row.cartao_id,
    cicloKey: row.ciclo_key,
    statusManual: row.status_manual,
    parcelamentoFaturaId: row.parcelamento_fatura_id ?? null,
    criadoEm: row.criado_em ?? null,
  };
};

export const mapInvoiceManualStatusAppToInsert = (
  statusItem: InvoiceManualStatusApp,
  userId: string
) => {
  return {
    id: statusItem.id,
    user_id: userId,
    cartao_id: statusItem.cartaoId,
    ciclo_key: statusItem.cicloKey,
    status_manual: statusItem.statusManual,
    parcelamento_fatura_id: statusItem.parcelamentoFaturaId ?? null,
    criado_em: statusItem.criadoEm ?? null,
  };
};

export async function fetchInvoiceManualStatus(
  userId: string
): Promise<InvoiceManualStatusRow[]> {
  const { data, error } = await supabase
    .from("invoice_manual_status")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InvoiceManualStatusRow[];
}

export async function upsertInvoiceManualStatus(
  row: ReturnType<typeof mapInvoiceManualStatusAppToInsert>
) {
  const { data, error } = await supabase
    .from("invoice_manual_status")
    .upsert(row, {
      onConflict: "user_id,cartao_id,ciclo_key",
    })
    .select()
    .single();

  if (error) throw error;
  return data as InvoiceManualStatusRow;
}

export async function deleteInvoiceManualStatusById(id: string, userId: string) {
  const { error } = await supabase
    .from("invoice_manual_status")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteInvoiceManualStatusByCycle(
  cartaoId: string,
  cicloKey: string,
  userId: string
) {
  const { error } = await supabase
    .from("invoice_manual_status")
    .delete()
    .eq("cartao_id", cartaoId)
    .eq("ciclo_key", cicloKey)
    .eq("user_id", userId);

  if (error) throw error;
}