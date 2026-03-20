import { supabase } from "../lib/supabase";

export type InvoiceInstallmentRow = {
  id: string;
  user_id: string;
  cartao_id: string;
  ciclo_key_origem: string;
  data_acordo: string;
  valor_original: number | string;
  valor_entrada: number | string;
  saldo_parcelado: number | string;
  quantidade_parcelas: number;
  valor_parcela: number | string;
  valor_total_final: number | string;
  juros_total: number | string;
  status: "ativo" | "cancelado" | "concluido" | string;
  criado_em?: number | null;
  created_at?: string;
};

export type InvoiceInstallmentApp = {
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
  status: "ativo" | "cancelado" | "concluido" | string;
  criadoEm?: number | null;
};

export const mapInvoiceInstallmentRowToApp = (
  row: InvoiceInstallmentRow
): InvoiceInstallmentApp => {
  return {
    id: row.id,
    cartaoId: row.cartao_id,
    cicloKeyOrigem: row.ciclo_key_origem,
    dataAcordo: row.data_acordo,
    valorOriginal: Number(row.valor_original ?? 0),
    valorEntrada: Number(row.valor_entrada ?? 0),
    saldoParcelado: Number(row.saldo_parcelado ?? 0),
    quantidadeParcelas: Number(row.quantidade_parcelas ?? 0),
    valorParcela: Number(row.valor_parcela ?? 0),
    valorTotalFinal: Number(row.valor_total_final ?? 0),
    jurosTotal: Number(row.juros_total ?? 0),
    status: row.status ?? "ativo",
    criadoEm: row.criado_em ?? null,
  };
};

export const mapInvoiceInstallmentAppToInsert = (
  installment: InvoiceInstallmentApp,
  userId: string
) => {
  return {
    id: installment.id,
    user_id: userId,
    cartao_id: installment.cartaoId,
    ciclo_key_origem: installment.cicloKeyOrigem,
    data_acordo: installment.dataAcordo,
    valor_original: Number(installment.valorOriginal ?? 0),
    valor_entrada: Number(installment.valorEntrada ?? 0),
    saldo_parcelado: Number(installment.saldoParcelado ?? 0),
    quantidade_parcelas: Number(installment.quantidadeParcelas ?? 0),
    valor_parcela: Number(installment.valorParcela ?? 0),
    valor_total_final: Number(installment.valorTotalFinal ?? 0),
    juros_total: Number(installment.jurosTotal ?? 0),
    status: installment.status ?? "ativo",
    criado_em: installment.criadoEm ?? null,
  };
};

export async function fetchInvoiceInstallments(
  userId: string
): Promise<InvoiceInstallmentRow[]> {
  const { data, error } = await supabase
    .from("invoice_installments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as InvoiceInstallmentRow[];
}

export async function insertInvoiceInstallment(
  row: ReturnType<typeof mapInvoiceInstallmentAppToInsert>
) {
  const { data, error } = await supabase
    .from("invoice_installments")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data as InvoiceInstallmentRow;
}

export async function updateInvoiceInstallmentStatusById(
  id: string,
  userId: string,
  status: "ativo" | "cancelado" | "concluido" | string
) {
  const { data, error } = await supabase
    .from("invoice_installments")
    .update({ status })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as InvoiceInstallmentRow;
}

export async function deleteInvoiceInstallmentById(
  id: string,
  userId: string
) {
  const cleanId = String(id ?? "").trim();
  const cleanUserId = String(userId ?? "").trim();

  if (!cleanId) throw new Error("ID do parcelamento não informado.");
  if (!cleanUserId) throw new Error("Usuário não informado.");

  const { error } = await supabase
    .from("invoice_installments")
    .delete()
    .eq("id", cleanId)
    .eq("user_id", cleanUserId);

  if (error) throw error;
}