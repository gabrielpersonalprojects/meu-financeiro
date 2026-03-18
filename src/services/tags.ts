import { supabase } from "../lib/supabase";

export type UserTagRow = {
  id: string;
  user_id: string;
  nome: string;
  created_at?: string;
};

export async function fetchUserTags(userId: string) {
  const { data, error } = await supabase
    .from("user_tags")
    .select("*")
    .eq("user_id", userId)
    .order("nome", { ascending: true });

  if (error) throw error;
  return (data ?? []) as UserTagRow[];
}

export async function insertUserTag(params: {
  userId: string;
  nome: string;
}) {
  const nome = params.nome.trim();

  if (!params.userId || !nome) {
    throw new Error("Dados inválidos para criar tag.");
  }

  const payload = {
    user_id: params.userId,
    nome,
  };

  const { data, error } = await supabase
    .from("user_tags")
    .insert(payload)
    .select()
    .single();

  if (error) throw error;
  return data as UserTagRow;
}

export async function deleteUserTag(params: {
  userId: string;
  nome: string;
}) {
  const nome = params.nome.trim();

  const { error } = await supabase
    .from("user_tags")
    .delete()
    .eq("user_id", params.userId)
    .eq("nome", nome);

  if (error) throw error;
}