const normalizeId = (value: unknown): string => String(value ?? "").trim();

const normalizeKind = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const getPayload = (transaction: any): Record<string, any> =>
  transaction?.payload && typeof transaction.payload === "object"
    ? transaction.payload
    : {};

const uniqueIds = (values: unknown[]): string[] =>
  Array.from(new Set(values.map(normalizeId).filter(Boolean)));

export const isPfPjMovementTransaction = (transaction: any): boolean => {
  const payload = getPayload(transaction);
  const movementKind = normalizeKind(
    payload?.movementKind ??
      payload?.movement_kind ??
      transaction?.movementKind ??
      transaction?.movement_kind
  );

  if (movementKind === "pf_pj") return true;

  const linkedMovementId = normalizeId(
    payload?.linkedMovementId ??
      payload?.linked_movement_id ??
      transaction?.linkedMovementId ??
      transaction?.linked_movement_id
  );
  const direction = normalizeKind(
    payload?.linkedMovementDirection ??
      payload?.linked_movement_direction ??
      transaction?.linkedMovementDirection ??
      transaction?.linked_movement_direction
  );

  return Boolean(
    linkedMovementId && (direction === "saida" || direction === "entrada")
  );
};

/**
 * Retorna somente a conta à qual a perna PF/PJ pertence.
 * - despesa/saída: conta de origem
 * - receita/entrada: conta de destino
 *
 * Os campos genéricos contaId/profileId/qualConta representam a conta da
 * própria linha e entram como fallback, sem incluir a contraparte.
 */
export const getPfPjLegAccountIds = (transaction: any): string[] => {
  const payload = getPayload(transaction);
  const type = normalizeKind(transaction?.tipo ?? transaction?.type);
  const direction = normalizeKind(
    payload?.linkedMovementDirection ??
      payload?.linked_movement_direction ??
      transaction?.linkedMovementDirection ??
      transaction?.linked_movement_direction
  );

  const ownAccountFields = [
    transaction?.contaId,
    transaction?.conta_id,
    transaction?.profileId,
    transaction?.profile_id,
    transaction?.qualConta,
    transaction?.qual_conta,
    payload?.contaId,
    payload?.conta_id,
    payload?.profileId,
    payload?.profile_id,
    payload?.qualConta,
    payload?.qual_conta,
  ];

  const isIncoming = type === "receita" || direction === "entrada";
  const isOutgoing = type === "despesa" || direction === "saida";

  if (isIncoming && !isOutgoing) {
    return uniqueIds([
      ...ownAccountFields,
      transaction?.contaDestinoId,
      transaction?.conta_destino_id,
      transaction?.transferToId,
      transaction?.transfer_to_id,
      transaction?.destinationAccountId,
      transaction?.destination_account_id,
      payload?.contaDestinoId,
      payload?.conta_destino_id,
      payload?.transferToId,
      payload?.transfer_to_id,
      payload?.destinationAccountId,
      payload?.destination_account_id,
    ]);
  }

  return uniqueIds([
    ...ownAccountFields,
    transaction?.contaOrigemId,
    transaction?.conta_origem_id,
    transaction?.transferFromId,
    transaction?.transfer_from_id,
    transaction?.originAccountId,
    transaction?.origin_account_id,
    payload?.contaOrigemId,
    payload?.conta_origem_id,
    payload?.transferFromId,
    payload?.transfer_from_id,
    payload?.originAccountId,
    payload?.origin_account_id,
  ]);
};

/**
 * Retorna as referências de conta que devem ser usadas pelos filtros de lista.
 *
 * Para movimentos PF/PJ, cada perna fica restrita à própria conta.
 * Para os demais lançamentos e transferências comuns, preserva todas as
 * referências relacionadas à linha.
 */
export const getTransactionAccountScopeIds = (transaction: any): string[] => {
  if (isPfPjMovementTransaction(transaction)) {
    return getPfPjLegAccountIds(transaction);
  }

  const payload = getPayload(transaction);

  return uniqueIds([
    transaction?.contaId,
    transaction?.conta_id,
    transaction?.profileId,
    transaction?.profile_id,
    transaction?.qualConta,
    transaction?.qual_conta,
    transaction?.contaOrigemId,
    transaction?.conta_origem_id,
    transaction?.contaDestinoId,
    transaction?.conta_destino_id,
    transaction?.transferFromId,
    transaction?.transfer_from_id,
    transaction?.transferToId,
    transaction?.transfer_to_id,
    transaction?.originAccountId,
    transaction?.origin_account_id,
    transaction?.destinationAccountId,
    transaction?.destination_account_id,
    payload?.contaId,
    payload?.conta_id,
    payload?.profileId,
    payload?.profile_id,
    payload?.qualConta,
    payload?.qual_conta,
    payload?.contaOrigemId,
    payload?.conta_origem_id,
    payload?.contaDestinoId,
    payload?.conta_destino_id,
    payload?.transferFromId,
    payload?.transfer_from_id,
    payload?.transferToId,
    payload?.transfer_to_id,
    payload?.originAccountId,
    payload?.origin_account_id,
    payload?.destinationAccountId,
    payload?.destination_account_id,
  ]);
};
