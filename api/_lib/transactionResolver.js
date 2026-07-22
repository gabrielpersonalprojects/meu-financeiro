const BROKEN_WHITESPACE = /\s+/g;

function normalizeResolveText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(BROKEN_WHITESPACE, " ");
}

function isPaidValue(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  return (
    value === true ||
    value === 1 ||
    raw === "1" ||
    raw === "true" ||
    raw === "pago" ||
    raw === "recebido"
  );
}

function toCents(value) {
  return Math.round(Math.abs(Number(value || 0)) * 100);
}

function getTransactionPayload(row) {
  return row?.payload && typeof row.payload === "object" ? row.payload : {};
}

function getTransactionAccountId(row) {
  return String(row?.conta_id ?? row?.qual_conta ?? "").trim();
}

function getMovementKind(row) {
  return String(row?.payload?.movementKind ?? row?.movementKind ?? "")
    .trim()
    .toLowerCase();
}

function getLinkedMovementId(row) {
  return String(row?.payload?.linkedMovementId ?? row?.linkedMovementId ?? "").trim();
}

function getTransferId(row) {
  return String(
    row?.payload?.transferId ??
      row?.transferId ??
      row?.transfer_id ??
      row?.payload?.transfer_id ??
      ""
  ).trim();
}

function getMovementAccountIds(row) {
  const payload = getTransactionPayload(row);
  const fromAccountId = String(
    row?.transfer_from_id ??
      row?.conta_origem_id ??
      payload?.originAccountId ??
      payload?.conta_origem_id ??
      payload?.contaOrigemId ??
      ""
  ).trim();
  const toAccountId = String(
    row?.transfer_to_id ??
      row?.conta_destino_id ??
      payload?.destinationAccountId ??
      payload?.conta_destino_id ??
      payload?.contaDestinoId ??
      ""
  ).trim();

  return { fromAccountId, toAccountId };
}

function getMovementMetadata(row) {
  const movementKind = getMovementKind(row) === "pf_pj"
    ? "pf_pj"
    : getTransferId(row)
    ? "internal_transfer"
    : "common";
  const { fromAccountId, toAccountId } = getMovementAccountIds(row);

  return {
    movementKind,
    linkedMovementId: getLinkedMovementId(row) || null,
    transferId: getTransferId(row) || null,
    fromAccountId: fromAccountId || null,
    toAccountId: toAccountId || null,
  };
}

function isInvoicePayment(row) {
  const category = normalizeResolveText(row?.categoria);
  const description = normalizeResolveText(row?.descricao);
  const payload = getTransactionPayload(row);

  return Boolean(
    category === "cartao de credito" ||
      /^fatura\s*:/.test(description) ||
      String(payload?.origemLancamento ?? "").trim().toLowerCase() ===
        "pagamento_fatura" ||
      String(payload?.invoicePaymentId ?? "").trim() ||
      String(payload?.pagamentoFaturaId ?? "").trim()
  );
}

function isSettleablePendingTransaction(row) {
  const type = String(row?.tipo ?? "").trim().toLowerCase();

  if (isPaidValue(row?.pago)) return false;
  if (type !== "receita" && type !== "despesa") return false;
  if (isInvoicePayment(row)) return false;
  if (!String(row?.id ?? "").trim()) return false;
  if (!getTransactionAccountId(row)) return false;

  return true;
}

function formatMoneyPtBr(value) {
  return `R$ ${Math.abs(Number(value || 0)).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDatePtBr(isoDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate ?? "").trim());
  if (!match) return String(isoDate ?? "").trim();
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function buildAccountMap(accounts) {
  return new Map(
    (Array.isArray(accounts) ? accounts : [])
      .filter((account) => String(account?.id ?? "").trim())
      .map((account) => [String(account.id), account])
  );
}

function getAccountProfileId(account) {
  const raw = String(account?.perfil_conta ?? account?.profile_id ?? "")
    .trim()
    .toLowerCase();
  return raw === "pj" ? "pj" : raw === "pf" ? "pf" : null;
}

function getAccountName(account) {
  return String(account?.name ?? account?.banco ?? "Conta").trim() || "Conta";
}

function buildResolveCandidate(row, account) {
  const type = String(row?.tipo ?? "").trim().toLowerCase();
  const description = String(row?.descricao ?? "").trim();
  const amount = Math.abs(Number(row?.valor || 0));
  const date = String(row?.data ?? "").trim();
  const profileId = getAccountProfileId(account);
  const movement = getMovementMetadata(row);
  const actionText = type === "receita" ? "recebida" : "paga";
  const typeText = type === "receita" ? "receita" : "despesa";

  return {
    transaction_id: String(row.id),
    description,
    amount,
    date,
    type,
    profile_id: profileId,
    account_id: getTransactionAccountId(row) || null,
    account_name: account ? getAccountName(account) : null,
    movement_kind: movement.movementKind,
    linked_movement_id: movement.linkedMovementId,
    transfer_id: movement.transferId,
    from_account_id: movement.fromAccountId,
    to_account_id: movement.toAccountId,
    settle_affects_linked_legs:
      movement.movementKind === "pf_pj" || movement.movementKind === "internal_transfer",
    settle_confirmation_message: `Confirma marcar a ${typeText} ${
      description || "lançamento"
    } de ${formatMoneyPtBr(amount)} como ${actionText}?`,
    selection_label: `${description || "Lançamento"} — ${formatMoneyPtBr(
      amount
    )} — ${formatDatePtBr(date)}`,
  };
}

function compareCandidates(left, right) {
  const dateCompare = String(left?.date ?? "").localeCompare(String(right?.date ?? ""));
  if (dateCompare !== 0) return dateCompare;

  const descriptionCompare = normalizeResolveText(left?.description).localeCompare(
    normalizeResolveText(right?.description)
  );
  if (descriptionCompare !== 0) return descriptionCompare;

  return String(left?.transaction_id ?? "").localeCompare(
    String(right?.transaction_id ?? "")
  );
}

function resolvePendingTransaction({
  rows,
  accounts,
  description,
  amount,
  date,
  type,
  profileId,
}) {
  const queryDescription = normalizeResolveText(description);
  const accountMap = buildAccountMap(accounts);
  const requestedType = String(type ?? "").trim().toLowerCase();
  const requestedProfile = String(profileId ?? "").trim().toLowerCase();
  const requestedDate = String(date ?? "").trim();
  const amountCents = amount == null || amount === "" ? null : toCents(amount);

  const eligible = (Array.isArray(rows) ? rows : [])
    .filter(isSettleablePendingTransaction)
    .map((row) => {
      const account = accountMap.get(getTransactionAccountId(row)) || null;
      return {
        row,
        account,
        candidate: buildResolveCandidate(row, account),
        normalizedDescription: normalizeResolveText(row?.descricao),
      };
    })
    .filter(({ candidate }) => {
      if (requestedType && candidate.type !== requestedType) return false;
      if (requestedDate && candidate.date !== requestedDate) return false;
      if (amountCents != null && toCents(candidate.amount) !== amountCents) return false;
      if (requestedProfile && candidate.profile_id !== requestedProfile) return false;
      return true;
    });

  const exactMatches = eligible.filter(
    ({ normalizedDescription }) => normalizedDescription === queryDescription
  );

  const matched = exactMatches.length > 0
    ? exactMatches
    : eligible.filter(({ normalizedDescription }) =>
        Boolean(
          queryDescription &&
            normalizedDescription &&
            (normalizedDescription.includes(queryDescription) ||
              queryDescription.includes(normalizedDescription))
        )
      );

  const candidates = matched.map(({ candidate }) => candidate).sort(compareCandidates);

  if (candidates.length === 0) {
    return {
      status: "not_found",
      match_strategy: exactMatches.length > 0 ? "exact" : "partial",
      candidates: [],
    };
  }

  if (candidates.length === 1) {
    return {
      status: "selected",
      match_strategy: exactMatches.length > 0 ? "exact" : "partial",
      selected_transaction: candidates[0],
      candidates,
    };
  }

  return {
    status: "multiple_matches",
    match_strategy: exactMatches.length > 0 ? "exact" : "partial",
    candidates,
  };
}

module.exports = {
  buildResolveCandidate,
  formatDatePtBr,
  formatMoneyPtBr,
  isSettleablePendingTransaction,
  normalizeResolveText,
  resolvePendingTransaction,
};
