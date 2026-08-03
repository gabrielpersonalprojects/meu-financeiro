import type { Transaction } from "../types";

export type ProjectionProfile = "pf" | "pj";

export type ProjectionPreferences = {
  version: 1;
  excludedAccountIds: string[];
  excludedCardIds: string[];
  excludedTransactionIds: string[];
  excludedGroupIds: string[];
};

export const EMPTY_PROJECTION_PREFERENCES: ProjectionPreferences = {
  version: 1,
  excludedAccountIds: [],
  excludedCardIds: [],
  excludedTransactionIds: [],
  excludedGroupIds: [],
};

const uniqueIds = (value: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    )
  );

export const normalizeProjectionPreferences = (
  value: unknown
): ProjectionPreferences => {
  const source = value && typeof value === "object" ? (value as any) : {};
  return {
    version: 1,
    excludedAccountIds: uniqueIds(source.excludedAccountIds),
    excludedCardIds: uniqueIds(source.excludedCardIds),
    excludedTransactionIds: uniqueIds(source.excludedTransactionIds),
    excludedGroupIds: uniqueIds(source.excludedGroupIds),
  };
};

export const isProjectionPreferencesActive = (value: ProjectionPreferences) =>
  value.excludedAccountIds.length > 0 ||
  value.excludedCardIds.length > 0 ||
  value.excludedTransactionIds.length > 0 ||
  value.excludedGroupIds.length > 0;

export const getProjectionPreferencesSummary = (value: ProjectionPreferences) => ({
  accounts: value.excludedAccountIds.length,
  cards: value.excludedCardIds.length,
  transactions: value.excludedTransactionIds.length + value.excludedGroupIds.length,
});

export const formatProjectionPreferencesMessage = (summary: {
  accounts: number;
  cards: number;
  transactions: number;
}): string | null => {
  const parts = [
    summary.accounts > 0
      ? `${summary.accounts} ${summary.accounts === 1 ? "conta" : "contas"}`
      : "",
    summary.cards > 0
      ? `${summary.cards} ${summary.cards === 1 ? "cartão" : "cartões"}`
      : "",
    summary.transactions > 0
      ? `${summary.transactions} ${summary.transactions === 1 ? "lançamento" : "lançamentos"}`
      : "",
  ].filter(Boolean);

  if (!parts.length) return null;
  const subject = parts.length === 1
    ? parts[0]
    : `${parts.slice(0, -1).join(", ")} e ${parts[parts.length - 1]}`;
  const onlyAccounts = parts.length === 1 && summary.accounts > 0;
  const participle = onlyAccounts
    ? summary.accounts === 1 ? "excluída" : "excluídas"
    : parts.length === 1 && summary.cards + summary.transactions === 1
      ? "excluído"
      : "excluídos";
  return `${subject} ${participle} da projeção.`;
};

const storageKey = (userId: string, profile: ProjectionProfile) =>
  `fluxmoney:projection-preferences:v1:${String(userId).trim()}:${profile}`;

export const loadProjectionPreferences = (
  userId: string,
  profile: ProjectionProfile,
  storage: Pick<Storage, "getItem"> = localStorage
) => {
  if (!String(userId ?? "").trim()) return { ...EMPTY_PROJECTION_PREFERENCES };
  try {
    return normalizeProjectionPreferences(
      JSON.parse(storage.getItem(storageKey(userId, profile)) ?? "null")
    );
  } catch {
    return { ...EMPTY_PROJECTION_PREFERENCES };
  }
};

export const saveProjectionPreferences = (
  userId: string,
  profile: ProjectionProfile,
  value: ProjectionPreferences,
  storage: Pick<Storage, "setItem" | "removeItem"> = localStorage
) => {
  const key = storageKey(userId, profile);
  const normalized = normalizeProjectionPreferences(value);
  if (!String(userId ?? "").trim()) return normalized;
  if (isProjectionPreferencesActive(normalized)) {
    storage.setItem(key, JSON.stringify(normalized));
  } else {
    storage.removeItem(key);
  }
  return normalized;
};

const firstId = (...values: unknown[]) =>
  values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";

export const getProjectionTransactionId = (transaction: any) =>
  firstId(transaction?.id, transaction?.transactionId, transaction?.transaction_id);

// Registros legados sem id nem identificador de grupo permanecem incluídos.
// Eles não recebem chave textual frágil e não podem ser excluídos individualmente.
export const getProjectionTransactionGroupKey = (transaction: any) => {
  const payload = transaction?.payload && typeof transaction.payload === "object"
    ? transaction.payload
    : {};
  const recurrenceId = firstId(
    transaction?.recorrenciaId,
    transaction?.recurrenceId,
    payload?.recorrenciaId,
    payload?.recurrenceId
  );
  if (recurrenceId) return `recurrence:${recurrenceId}`;

  const installmentId = firstId(
    transaction?.installmentGroupId,
    transaction?.parcelamentoId,
    transaction?.parcelamentoFaturaId,
    payload?.installmentGroupId,
    payload?.parcelamentoId,
    payload?.parcelamentoFaturaId
  );
  if (installmentId) return `installment:${installmentId}`;

  const parentId = firstId(
    transaction?.parentId,
    transaction?.parent_id,
    transaction?.groupId,
    transaction?.group_id,
    payload?.parentId,
    payload?.parent_id,
    payload?.groupId,
    payload?.group_id
  );
  if (parentId) return `group:${parentId}`;

  const linkedId = firstId(
    transaction?.linkedMovementId,
    transaction?.transferId,
    transaction?.transfer_id,
    payload?.linkedMovementId,
    payload?.transferId,
    payload?.transfer_id
  );
  return linkedId ? `linked:${linkedId}` : "";
};

export const getProjectionAccountId = (transaction: any) =>
  firstId(
    transaction?.profileId,
    transaction?.contaId,
    transaction?.qualConta,
    transaction?.conta?.id,
    transaction?.profile?.id,
    transaction?.payload?.profileId,
    transaction?.payload?.contaId,
    transaction?.payload?.qualConta
  );

export const getProjectionCardId = (transaction: any, creditCards: any[]) => {
  const refs = [
    transaction?.cartaoId,
    transaction?.qualCartao,
    transaction?.creditCardId,
    transaction?.selectedCreditCardId,
    transaction?.payload?.cartaoId,
    transaction?.payload?.qualCartao,
    transaction?.payload?.creditCardId,
    transaction?.payload?.selectedCreditCardId,
  ].map((value) => String(value ?? "").trim()).filter(Boolean);
  const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase();
  const card = (creditCards ?? []).find((item: any) => {
    const candidates = [item?.id, item?.name, item?.nome, item?.emissor, item?.bankText]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean);
    return refs.some((ref) => candidates.some((candidate) => normalize(candidate) === normalize(ref)));
  });
  return String(card?.id ?? "").trim();
};

const profileOf = (entity: any) =>
  String(entity?.perfilConta ?? entity?.perfil ?? entity?.brand ?? "").trim().toLowerCase();

export const transactionBelongsToProjectionProfile = (params: {
  transaction: any;
  profile: ProjectionProfile;
  profiles: any[];
  creditCards: any[];
}) => {
  const { transaction, profile, profiles, creditCards } = params;
  const isCard = String(transaction?.tipo ?? "").trim().toLowerCase() === "cartao_credito";
  if (isCard) {
    const cardId = getProjectionCardId(transaction, creditCards);
    const card = (creditCards ?? []).find((item: any) => String(item?.id ?? "").trim() === cardId);
    return !!card && profileOf(card) === profile;
  }
  const accountId = getProjectionAccountId(transaction);
  const account = (profiles ?? []).find((item: any) => String(item?.id ?? "").trim() === accountId);
  return !!account && profileOf(account) === profile;
};

export const filterTransactionsForProjection = (params: {
  transactions: readonly Transaction[];
  profile: "geral" | ProjectionProfile;
  profiles: any[];
  creditCards: any[];
  preferences: ProjectionPreferences;
}) => {
  const { transactions, profile, profiles, creditCards } = params;
  const preferences = normalizeProjectionPreferences(params.preferences);
  if (profile === "geral") return [...transactions];

  const excludedAccounts = new Set(preferences.excludedAccountIds);
  const excludedCards = new Set(preferences.excludedCardIds);
  const excludedTransactions = new Set(preferences.excludedTransactionIds);
  const excludedGroups = new Set(preferences.excludedGroupIds);

  return transactions.filter((transaction: any) => {
    if (!transactionBelongsToProjectionProfile({ transaction, profile, profiles, creditCards })) {
      return false;
    }
    const isCard = String(transaction?.tipo ?? "").trim().toLowerCase() === "cartao_credito";
    if (isCard && excludedCards.has(getProjectionCardId(transaction, creditCards))) return false;
    if (!isCard && excludedAccounts.has(getProjectionAccountId(transaction))) return false;
    const groupKey = getProjectionTransactionGroupKey(transaction);
    if (groupKey) return !excludedGroups.has(groupKey);
    return !excludedTransactions.has(getProjectionTransactionId(transaction));
  });
};

export const sanitizeProjectionPreferences = (params: {
  preferences: ProjectionPreferences;
  profile: ProjectionProfile;
  profiles: any[];
  creditCards: any[];
  transactions: readonly Transaction[];
}) => {
  const { profile, profiles, creditCards, transactions } = params;
  const preferences = normalizeProjectionPreferences(params.preferences);
  const validAccounts = new Set((profiles ?? []).filter((item) => profileOf(item) === profile).map((item) => String(item?.id ?? "").trim()));
  const validCards = new Set((creditCards ?? []).filter((item) => profileOf(item) === profile).map((item) => String(item?.id ?? "").trim()));
  const profileTransactions = transactions.filter((transaction) =>
    transactionBelongsToProjectionProfile({ transaction, profile, profiles, creditCards })
  );
  const validTransactionIds = new Set(profileTransactions.map(getProjectionTransactionId).filter(Boolean));
  const validGroupIds = new Set(profileTransactions.map(getProjectionTransactionGroupKey).filter(Boolean));
  return normalizeProjectionPreferences({
    excludedAccountIds: preferences.excludedAccountIds.filter((id) => validAccounts.has(id)),
    excludedCardIds: preferences.excludedCardIds.filter((id) => validCards.has(id)),
    excludedTransactionIds: preferences.excludedTransactionIds.filter((id) => validTransactionIds.has(id)),
    excludedGroupIds: preferences.excludedGroupIds.filter((id) => validGroupIds.has(id)),
  });
};
