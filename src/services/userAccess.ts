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

export async function getUserAccountOrder(userId: string) {
  const { data, error } = await supabase
    .from("user_access")
    .select("account_order_ids")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  return Array.isArray(data?.account_order_ids)
    ? data.account_order_ids.map((id: any) => String(id ?? "").trim()).filter(Boolean)
    : [];
}

export async function setUserAccountOrder(
  userId: string,
  accountIds: string[]
) {
  const safeIds = Array.isArray(accountIds)
    ? accountIds.map((id) => String(id ?? "").trim()).filter(Boolean)
    : [];

  const { error } = await supabase
    .from("user_access")
    .update({ account_order_ids: safeIds })
    .eq("user_id", userId);

  if (error) throw error;
}

export type UserContactInfo = {
  whatsappNumber: string;
  whatsappUpdatedAt: string | null;
};

export async function getUserContactInfo(
  userId: string
): Promise<UserContactInfo> {
  const cleanUserId = String(userId ?? "").trim();

  if (!cleanUserId) {
    return {
      whatsappNumber: "",
      whatsappUpdatedAt: null,
    };
  }

  const { data, error } = await supabase
    .from("user_access")
    .select("whatsapp_number, whatsapp_updated_at")
    .eq("user_id", cleanUserId)
    .maybeSingle();

  if (error) throw error;

  return {
    whatsappNumber: String(data?.whatsapp_number ?? "").trim(),
    whatsappUpdatedAt: data?.whatsapp_updated_at ?? null,
  };
}

export async function setUserWhatsapp(
  userId: string,
  whatsappNumber: string
) {
  const cleanUserId = String(userId ?? "").trim();
  const cleanWhatsapp = String(whatsappNumber ?? "").trim();

  if (!cleanUserId) {
    throw new Error("Usuário inválido para salvar WhatsApp.");
  }

  const { error } = await supabase
    .from("user_access")
    .upsert(
      {
        user_id: cleanUserId,
        whatsapp_number: cleanWhatsapp || null,
        whatsapp_updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) throw error;
}