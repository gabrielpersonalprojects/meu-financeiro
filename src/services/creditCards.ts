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
    validade: "",
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
  name?: string;
  brand?: string | null;
  limit_cents?: number;
  due_day?: number;
  closing_day?: number;
  color?: string | null;
  perfil_cartao?: string | null;
  active?: boolean;
};

export async function updateCreditCardById(
  id: string,
  userId: string,
  input: UpdateCreditCardInput
) {
  
  const { data, error } = await supabase
    .from("credit_cards")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.limit_cents !== undefined ? { limit_cents: input.limit_cents } : {}),
      ...(input.due_day !== undefined ? { due_day: input.due_day } : {}),
      ...(input.closing_day !== undefined ? { closing_day: input.closing_day } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.perfil_cartao !== undefined ? { perfil_cartao: input.perfil_cartao } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
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