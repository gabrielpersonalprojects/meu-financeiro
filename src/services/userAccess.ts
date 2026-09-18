import { supabase } from "../lib/supabase";
import { normalizeWhatsappForStorage } from "../utils/whatsapp";

export type OnboardingWhatsappStatus = "pending" | "done" | "skipped";
export const WHATSAPP_ALREADY_LINKED_MESSAGE =
  "Este WhatsApp já está vinculado a outra conta.";

export type NimbleWelcomeNotificationResult = {
  ok: boolean;
  status?: "sent" | "already_sent_or_in_progress";
  event_id?: string;
};

export async function notifyNimbleUserRegistration(
  accessToken: string
): Promise<NimbleWelcomeNotificationResult> {
  const token = String(accessToken ?? "").trim();
  if (!token) {
    throw new Error("Sessão inválida para notificar integração do WhatsApp.");
  }

  const response = await fetch("/api/nimble/user-registration", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok !== true) {
    const error = new Error(
      String(data?.error || "Não foi possível notificar a Nimble.")
    );
    (error as any).code = data?.error;
    (error as any).retryable = data?.retryable === true;
    throw error;
  }

  return data as NimbleWelcomeNotificationResult;
}

const isUniqueViolation = (error: any): boolean =>
  String(error?.code ?? "") === "23505";

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
  onboardingWhatsappStatus: OnboardingWhatsappStatus | null;
  nimbleWelcomeStatus: "sending" | "sent" | "failed" | null;
};

export async function getUserContactInfo(
  userId: string
): Promise<UserContactInfo> {
  const cleanUserId = String(userId ?? "").trim();

  if (!cleanUserId) {
    return {
      whatsappNumber: "",
      whatsappUpdatedAt: null,
      onboardingWhatsappStatus: null,
      nimbleWelcomeStatus: null,
    };
  }

  const { data, error } = await supabase
    .from("user_access")
    .select(
      "whatsapp_number, whatsapp_updated_at, onboarding_whatsapp_status, nimble_welcome_status"
    )
    .eq("user_id", cleanUserId)
    .maybeSingle();

  if (error) throw error;

  return {
    whatsappNumber: String(data?.whatsapp_number ?? "").trim(),
    whatsappUpdatedAt: data?.whatsapp_updated_at ?? null,
    onboardingWhatsappStatus:
      data?.onboarding_whatsapp_status === "pending" ||
      data?.onboarding_whatsapp_status === "done" ||
      data?.onboarding_whatsapp_status === "skipped"
        ? data.onboarding_whatsapp_status
        : null,
    nimbleWelcomeStatus:
      data?.nimble_welcome_status === "sending" ||
      data?.nimble_welcome_status === "sent" ||
      data?.nimble_welcome_status === "failed"
        ? data.nimble_welcome_status
        : null,
  };
}

export async function setUserWhatsapp(
  userId: string,
  whatsappNumber: string
) {
  const cleanUserId = String(userId ?? "").trim();
  const cleanWhatsapp = normalizeWhatsappForStorage(whatsappNumber);

  if (!cleanUserId) {
    throw new Error("Usuário inválido para salvar WhatsApp.");
  }

  try {
    const { error } = await supabase
      .from("user_access")
      .upsert(
        {
          user_id: cleanUserId,
          whatsapp_number: cleanWhatsapp || null,
          whatsapp_number_normalized: cleanWhatsapp || null,
          whatsapp_updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) throw error;
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      throw new Error(WHATSAPP_ALREADY_LINKED_MESSAGE);
    }
    throw error;
  }
}

export async function setOnboardingWhatsappStatus(
  userId: string,
  status: OnboardingWhatsappStatus
) {
  const cleanUserId = String(userId ?? "").trim();

  if (!cleanUserId) {
    throw new Error("Usuário inválido para atualizar onboarding do WhatsApp.");
  }

  const { error } = await supabase
    .from("user_access")
    .upsert(
      {
        user_id: cleanUserId,
        onboarding_whatsapp_status: status,
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) throw error;
}

export async function setUserWhatsappAndOnboardingStatus(
  userId: string,
  whatsappNumber: string,
  status: Extract<OnboardingWhatsappStatus, "done">
) {
  const cleanUserId = String(userId ?? "").trim();
  const cleanWhatsapp = normalizeWhatsappForStorage(whatsappNumber);

  if (!cleanUserId) {
    throw new Error("Usuário inválido para salvar WhatsApp.");
  }

  try {
    const { error } = await supabase
      .from("user_access")
      .upsert(
        {
          user_id: cleanUserId,
          whatsapp_number: cleanWhatsapp || null,
          whatsapp_number_normalized: cleanWhatsapp || null,
          whatsapp_updated_at: new Date().toISOString(),
          onboarding_whatsapp_status: status,
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) throw error;
  } catch (error: any) {
    if (isUniqueViolation(error)) {
      throw new Error(WHATSAPP_ALREADY_LINKED_MESSAGE);
    }
    throw error;
  }
}

export async function clearUserWhatsappOnboardingData(userId: string) {
  const cleanUserId = String(userId ?? "").trim();

  if (!cleanUserId) {
    throw new Error("Usuário inválido para limpar dados de WhatsApp.");
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("user_access")
    .update({
      whatsapp_number: null,
      whatsapp_number_normalized: null,
      whatsapp_updated_at: null,
      onboarding_whatsapp_status: null,
    })
    .eq("user_id", cleanUserId)
    .select(
      "user_id, whatsapp_number, whatsapp_number_normalized, whatsapp_updated_at, onboarding_whatsapp_status"
    );

  const updatedCount = Array.isArray(updatedRows) ? updatedRows.length : 0;

  if (updateError) {
    throw updateError;
  }

  if (updatedCount !== 1) {
    throw new Error(
      `Limpeza de WhatsApp não atualizou 1 linha em user_access (linhas afetadas: ${updatedCount}).`
    );
  }

  const { data: confirmationRow, error: confirmationError } = await supabase
    .from("user_access")
    .select(
      "user_id, whatsapp_number, whatsapp_number_normalized, whatsapp_updated_at, onboarding_whatsapp_status"
    )
    .eq("user_id", cleanUserId)
    .maybeSingle();

  if (confirmationError) {
    throw confirmationError;
  }

  if (!confirmationRow) {
    throw new Error("Linha de user_access não encontrada após limpeza de WhatsApp.");
  }

  const hasWhatsappNumber =
    String(confirmationRow?.whatsapp_number ?? "").trim().length > 0;
  const hasWhatsappNumberNormalized =
    String(confirmationRow?.whatsapp_number_normalized ?? "").trim().length > 0;
  const hasWhatsappUpdatedAt = !!confirmationRow?.whatsapp_updated_at;
  const hasOnboardingStatus =
    confirmationRow?.onboarding_whatsapp_status !== null &&
    confirmationRow?.onboarding_whatsapp_status !== undefined;

  if (
    hasWhatsappNumber ||
    hasWhatsappNumberNormalized ||
    hasWhatsappUpdatedAt ||
    hasOnboardingStatus
  ) {
    throw new Error(
      "A limpeza de WhatsApp/onboarding não foi confirmada no banco para user_access."
    );
  }
}

export async function clearUserWhatsappFromSettings(userId: string) {
  const cleanUserId = String(userId ?? "").trim();

  if (!cleanUserId) {
    throw new Error("Usuário inválido para remover WhatsApp.");
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from("user_access")
    .update({
      whatsapp_number: null,
      whatsapp_number_normalized: null,
      whatsapp_updated_at: null,
    })
    .eq("user_id", cleanUserId)
    .select(
      "user_id, whatsapp_number, whatsapp_number_normalized, whatsapp_updated_at"
    );

  const updatedCount = Array.isArray(updatedRows) ? updatedRows.length : 0;

  if (updateError) {
    throw updateError;
  }

  if (updatedCount !== 1) {
    throw new Error(
      `Remoção de WhatsApp não atualizou 1 linha em user_access (linhas afetadas: ${updatedCount}).`
    );
  }

  const { data: confirmationRow, error: confirmationError } = await supabase
    .from("user_access")
    .select("whatsapp_number, whatsapp_number_normalized, whatsapp_updated_at")
    .eq("user_id", cleanUserId)
    .maybeSingle();

  if (confirmationError) {
    throw confirmationError;
  }

  if (!confirmationRow) {
    throw new Error("Linha de user_access não encontrada após remover WhatsApp.");
  }

  const hasWhatsappNumber =
    String(confirmationRow?.whatsapp_number ?? "").trim().length > 0;
  const hasWhatsappNumberNormalized =
    String(confirmationRow?.whatsapp_number_normalized ?? "").trim().length > 0;
  const hasWhatsappUpdatedAt = !!confirmationRow?.whatsapp_updated_at;

  if (hasWhatsappNumber || hasWhatsappNumberNormalized || hasWhatsappUpdatedAt) {
    throw new Error("A remoção de WhatsApp não foi confirmada no banco.");
  }
}

export async function assertWhatsappAvailableForUser(
  userId: string,
  whatsappNumber: string
) {
  const cleanUserId = String(userId ?? "").trim();
  const canonicalWhatsapp = normalizeWhatsappForStorage(whatsappNumber);

  if (!cleanUserId || !canonicalWhatsapp) {
    return;
  }

  const { data, error } = await supabase.rpc("check_whatsapp_available", {
    p_user_id: cleanUserId,
    p_whatsapp: canonicalWhatsapp,
  });

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error(WHATSAPP_ALREADY_LINKED_MESSAGE);
    }
    throw error;
  }

  if (data === false) {
    throw new Error(WHATSAPP_ALREADY_LINKED_MESSAGE);
  }
}

export const isWhatsappAlreadyLinkedError = (error: unknown): boolean =>
  String((error as any)?.message ?? "") === WHATSAPP_ALREADY_LINKED_MESSAGE ||
  String((error as any)?.code ?? "") === "23505";
