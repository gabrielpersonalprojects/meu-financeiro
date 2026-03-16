import { supabase } from "../lib/supabase";

export type CreditCardRow = {
  id: string;
  user_id: string;
  nome: string;
  titular: string | null;
  limite_total: number | string;
  dia_fechamento: number;
  dia_vencimento: number;
  bank_text: string | null;
  categoria: string | null;
  brand: string | null;
  last4: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CreditCardApp = {
  id: string;
  name: string;
  emissor: string;
  validade?: string;
  diaFechamento: number;
  diaVencimento: number;
  limite: number;
  limiteDisponivel?: number;
  contaVinculadaId?: string | null;
  gradientFrom?: string;
  gradientTo?: string;
  categoria?: string;
  perfil: "pf" | "pj";
};

export const mapCreditCardRowToApp = (row: CreditCardRow): CreditCardApp => {
  return {
    id: row.id,
    name: row.nome,
    emissor: row.bank_text ?? row.titular ?? "",
    validade: String((row as any).validade ?? ""),
    diaFechamento: Number(row.dia_fechamento ?? 1),
    diaVencimento: Number(row.dia_vencimento ?? 10),
    limite: Number(row.limite_total ?? 0),
    limiteDisponivel: undefined,
    contaVinculadaId: null,
    gradientFrom: row.gradient_from ?? "#220055",
    gradientTo: row.gradient_to ?? "#4600ac",
    categoria: row.categoria ?? "",
    perfil: row.categoria?.toLowerCase() === "pj" ? "pj" : "pf",
  };
};

export const mapCreditCardAppToInsert = (
  card: CreditCardApp,
  userId: string
) => {
  return {
    id: card.id,
    user_id: userId,
    nome: card.name,
    titular: card.emissor || null,
    limite_total: Number(card.limite ?? 0),
    dia_fechamento: Number(card.diaFechamento ?? 1),
    dia_vencimento: Number(card.diaVencimento ?? 10),
    bank_text: card.emissor || null,
    categoria: card.categoria || null,
brand: "",
last4: "",
    gradient_from: card.gradientFrom || "#220055",
    gradient_to: card.gradientTo || "#4600ac",
  };
};

export async function fetchCreditCards(userId: string): Promise<CreditCardRow[]> {
  const { data, error } = await supabase
    .from("credit_cards")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CreditCardRow[];
}

export async function insertCreditCard(row: ReturnType<typeof mapCreditCardAppToInsert>) {
  const { data, error } = await supabase
    .from("credit_cards")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data as CreditCardRow;
}

type UpdateCreditCardInput = {
  nome?: string;
  titular?: string | null;
  limite_total?: number;
  dia_vencimento?: number;
  dia_fechamento?: number;
  bank_text?: string | null;
  categoria?: string | null;
  validade?: string | null;
  gradient_from?: string | null;
  gradient_to?: string | null;
};

export async function updateCreditCardById(
  id: string,
  userId: string,
  input: UpdateCreditCardInput
) {
  
  const { data, error } = await supabase
    .from("credit_cards")
.update({
  ...(input.nome !== undefined ? { nome: input.nome } : {}),
  ...(input.titular !== undefined ? { titular: input.titular } : {}),
  ...(input.limite_total !== undefined ? { limite_total: input.limite_total } : {}),
  ...(input.dia_vencimento !== undefined ? { dia_vencimento: input.dia_vencimento } : {}),
  ...(input.dia_fechamento !== undefined ? { dia_fechamento: input.dia_fechamento } : {}),
  ...(input.bank_text !== undefined ? { bank_text: input.bank_text } : {}),
  ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
  ...(input.validade !== undefined ? { validade: input.validade } : {}),
  ...(input.gradient_from !== undefined ? { gradient_from: input.gradient_from } : {}),
  ...(input.gradient_to !== undefined ? { gradient_to: input.gradient_to } : {}),
})
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return data as CreditCardRow;
}

export async function deleteCreditCardById(id: string, userId: string) {
  const { error } = await supabase
    .from("credit_cards")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}