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