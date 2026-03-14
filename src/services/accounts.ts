import { supabase } from "../lib/supabase";

export type AccountRow = {
  id: string;
  user_id: string;
  banco: string;
  name: string;
  numero_conta: string;
  numero_agencia: string;
  perfil_conta: string;
  tipo_conta: string;
  initial_balance_cents: number;
  created_at?: string;
  updated_at?: string;
};

export async function fetchAccounts() {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AccountRow[];
}

export type InsertAccountInput = {
  banco: string;
  name: string;
  numero_conta?: string;
  numero_agencia?: string;
  perfil_conta?: string;
  tipo_conta?: string;
  initial_balance_cents?: number;
  user_id: string;
};

export async function insertAccount(input: InsertAccountInput) {
  const { data, error } = await supabase
    .from("accounts")
    .insert([
      {
        user_id: input.user_id,
        banco: input.banco,
        name: input.name,
        numero_conta: input.numero_conta ?? "",
        numero_agencia: input.numero_agencia ?? "",
        perfil_conta: input.perfil_conta ?? "PF",
        tipo_conta: input.tipo_conta ?? "Conta Corrente",
        initial_balance_cents: input.initial_balance_cents ?? 0,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data as AccountRow;
}

export async function createAccountAndReturnProfile(input: InsertAccountInput) {
  const row = await insertAccount(input);
  return mapAccountRowToProfile(row);
}

export function mapAccountRowToProfile(row: AccountRow) {
  return {
    id: row.id,
    name: row.name || row.banco || "Conta",
    banco: row.banco || row.name || "Conta",
    numeroConta: row.numero_conta || "",
    numeroAgencia: row.numero_agencia || "",
    perfilConta: row.perfil_conta || "PF",
    tipoConta: row.tipo_conta || "Conta Corrente",
    initialBalanceCents: Number(row.initial_balance_cents ?? 0),
  };
}

export async function deleteAccountById(id: string) {
  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export type UpdateAccountInput = {
  banco?: string;
  name?: string;
  numero_conta?: string;
  numero_agencia?: string;
  perfil_conta?: string;
  tipo_conta?: string;
  initial_balance_cents?: number;
};

export async function updateAccountById(id: string, input: UpdateAccountInput) {
  const { data, error } = await supabase
    .from("accounts")
    .update({
      ...(input.banco !== undefined ? { banco: input.banco } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.numero_conta !== undefined
        ? { numero_conta: input.numero_conta }
        : {}),
      ...(input.numero_agencia !== undefined
        ? { numero_agencia: input.numero_agencia }
        : {}),
      ...(input.perfil_conta !== undefined
        ? { perfil_conta: input.perfil_conta }
        : {}),
      ...(input.tipo_conta !== undefined ? { tipo_conta: input.tipo_conta } : {}),
      ...(input.initial_balance_cents !== undefined
        ? { initial_balance_cents: input.initial_balance_cents }
        : {}),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as AccountRow;
}