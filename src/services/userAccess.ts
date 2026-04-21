import { supabase } from "../lib/supabase";

export async function getUserFavoriteAccount(userId: string) {
  const { data, error } = await supabase
    .from("user_access")
    .select("favorite_account_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return data?.favorite_account_id ?? null;
}

export async function setUserFavoriteAccount(
  userId: string,
  accountId: string | null
) {
  const { error } = await supabase
    .from("user_access")
    .update({ favorite_account_id: accountId })
    .eq("user_id", userId);

  if (error) throw error;
}

export async function getUserHiddenAccounts(userId: string) {
  const { data, error } = await supabase
    .from("user_access")
    .select("hidden_account_ids")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return Array.isArray(data?.hidden_account_ids)
    ? data.hidden_account_ids.filter(Boolean)
    : [];
}

export async function setUserHiddenAccounts(
  userId: string,
  accountIds: string[]
) {
  const safeIds = Array.isArray(accountIds)
    ? accountIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];

  const { error } = await supabase
    .from("user_access")
    .update({ hidden_account_ids: safeIds })
    .eq("user_id", userId);

  if (error) throw error;
}