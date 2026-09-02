import type { Transaction } from "../../app/types";
import {
  getProjectionTransactionPeriod,
  isProjectionPeriodWithinRange,
} from "../../app/transactions/projectionPeriod";
import {
  getProjectionAccountId,
  getProjectionCardId,
  getProjectionTransactionGroupKey,
  getProjectionTransactionId,
  normalizeProjectionPreferences,
  transactionBelongsToProjectionProfile,
  type ProjectionPreferences,
  type ProjectionProfile,
} from "../../app/transactions/projectionPreferences";

export type ProjectionSelectionStats = {
  total: number;
  selected: number;
  allSelected: boolean;
  noneSelected: boolean;
  indeterminate: boolean;
};

export const buildProjectionSelectionKeysForProfile = (params: {
  transactions: readonly Transaction[];
  profile: ProjectionProfile;
  profiles: any[];
  creditCards: any[];
  preferences: ProjectionPreferences;
  projectionPeriodStart?: string;
  projectionPeriodEnd?: string;
}) => {
  const {
    transactions,
    profile,
    profiles,
    creditCards,
    preferences,
    projectionPeriodStart,
    projectionPeriodEnd,
  } = params;
  const normalized = normalizeProjectionPreferences(preferences);
  const excludedAccounts = new Set(normalized.excludedAccountIds);
  const excludedCards = new Set(normalized.excludedCardIds);
  const keys = new Set<string>();

  for (const transaction of transactions ?? []) {
    if (!transactionBelongsToProjectionProfile({ transaction, profile, profiles, creditCards })) {
      continue;
    }

    if (projectionPeriodStart || projectionPeriodEnd) {
      const period = getProjectionTransactionPeriod(transaction, creditCards);
      if (!isProjectionPeriodWithinRange(period, projectionPeriodStart, projectionPeriodEnd)) {
        continue;
      }
    }

    const isCard = String((transaction as any)?.tipo ?? "").toLowerCase() === "cartao_credito";
    const originId = isCard
      ? getProjectionCardId(transaction, creditCards)
      : getProjectionAccountId(transaction);

    if (!originId || (isCard ? excludedCards.has(originId) : excludedAccounts.has(originId))) {
      continue;
    }

    const groupKey = getProjectionTransactionGroupKey(transaction);
    if (groupKey) {
      keys.add(groupKey);
      continue;
    }

    const transactionId = getProjectionTransactionId(transaction);
    if (transactionId) {
      keys.add(`transaction:${transactionId}`);
    }
  }

  return Array.from(keys);
};

export const computeProjectionSelectionStats = (params: {
  selectionKeys: readonly string[];
  preferences: ProjectionPreferences;
}): ProjectionSelectionStats => {
  const normalized = normalizeProjectionPreferences(params.preferences);
  const excludedGroups = new Set(normalized.excludedGroupIds);
  const excludedTransactions = new Set(normalized.excludedTransactionIds);

  const total = params.selectionKeys.length;
  let selected = 0;

  for (const key of params.selectionKeys) {
    const excluded = key.startsWith("transaction:")
      ? excludedTransactions.has(key.slice("transaction:".length))
      : excludedGroups.has(key);
    if (!excluded) selected += 1;
  }

  const allSelected = total > 0 && selected === total;
  const noneSelected = total === 0 || selected === 0;

  return {
    total,
    selected,
    allSelected,
    noneSelected,
    indeterminate: !allSelected && !noneSelected,
  };
};
