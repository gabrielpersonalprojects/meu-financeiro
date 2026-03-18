import { supabase } from "../lib/supabase";

export type UserCategoryRow = {
  id: string;
  user_id: string;
  profile_id: string;
  tipo: "receita" | "despesa";
  nome: string;
  created_at?: string;
};

export async function fetchUserCategories(userId: string, profileId?: string) {
  let query = supabase
    .from("user_categories")
    .select("*")
    .eq("user_id", userId)
    .order("nome", { ascending: true });

  if (profileId?.trim()) {
    query = query.eq("profile_id", profileId.trim());
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as UserCategoryRow[];
}

export async function insertUserCategory(params: {
  userId: string;
  profileId: string;
  tipo: "receita" | "despesa";
  nome: string;
}) {
  const nome = params.nome.trim();
  const profileId = params.profileId.trim();

  if (!params.userId || !profileId || !params.tipo || !nome) {
    throw new Error("Dados inválidos para criar categoria.");
  }

  const payload = {
    user_id: params.userId,
    profile_id: profileId,
    tipo: params.tipo,
    nome,
  };

  const { data, error } = await supabase
    .from("user_categories")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as UserCategoryRow;
}

export async function deleteUserCategory(params: {
  userId: string;
  profileId: string;
  tipo: "receita" | "despesa";
  nome: string;
}) {
  const nome = params.nome.trim();
  const profileId = params.profileId.trim();

  const { data, error } = await supabase
    .from("user_categories")
    .delete()
    .eq("user_id", params.userId)
    .eq("profile_id", profileId)
    .eq("tipo", params.tipo)
    .ilike("nome", nome)
    .select("id, nome, tipo, profile_id");

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error(
      `Nenhuma categoria foi removida. userId=${params.userId} profileId=${profileId} tipo=${params.tipo} nome=${nome}`
    );
  }

  return data;
}