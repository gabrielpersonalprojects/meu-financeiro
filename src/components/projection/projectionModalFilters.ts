import {
  getProjectionAccountId,
} from "../../app/transactions/projectionPreferences";
import { isPfPjMovementTransaction } from "../../app/transactions/transactionAccountScope";

export type ProjectionOriginType = "contas" | "cartoes";
export type ProjectionOriginFilter = "todos" | ProjectionOriginType;
export type ProjectionMovementFilter = "todos" | "entradas" | "saidas";
export type ProjectionMovementDirection = "entrada" | "saida" | null;

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const firstId = (...values: unknown[]) =>
  values.map((value) => String(value ?? "").trim()).find(Boolean) ?? "";

const getPayload = (transaction: any): Record<string, any> =>
  transaction?.payload && typeof transaction.payload === "object"
    ? transaction.payload
    : {};

const getLinkedDirection = (transaction: any): ProjectionMovementDirection => {
  const payload = getPayload(transaction);
  const direction = normalizeText(
    payload?.linkedMovementDirection ??
      payload?.linked_movement_direction ??
      transaction?.linkedMovementDirection ??
      transaction?.linked_movement_direction
  );

  if (direction === "entrada") return "entrada";
  if (direction === "saida") return "saida";
  return null;
};

const hasTransferMarkers = (transaction: any): boolean => {
  const payload = getPayload(transaction);
  return Boolean(
    firstId(
      transaction?.transferId,
      transaction?.transferID,
      transaction?.transfer_id,
      payload?.transferId,
      payload?.transferID,
      payload?.transfer_id,
      transaction?.linkedMovementId,
      transaction?.linked_movement_id,
      payload?.linkedMovementId,
      payload?.linked_movement_id,
      transaction?.contaOrigemId,
      transaction?.conta_origem_id,
      transaction?.contaDestinoId,
      transaction?.conta_destino_id,
      payload?.contaOrigemId,
      payload?.conta_origem_id,
      payload?.contaDestinoId,
      payload?.conta_destino_id
    )
  );
};

export const getProjectionMovementDirection = (
  transaction: any
): ProjectionMovementDirection => {
  const transactionType = normalizeText(transaction?.tipo ?? transaction?.type);
  const linkedDirection = getLinkedDirection(transaction);

  if (isPfPjMovementTransaction(transaction) && linkedDirection) {
    return linkedDirection;
  }

  if (transactionType === "receita") return "entrada";
  if (transactionType === "despesa" || transactionType === "cartao_credito") {
    return "saida";
  }

  const isTransfer = transactionType === "transferencia" || hasTransferMarkers(transaction);
  if (!isTransfer) return null;

  const value = Number(transaction?.valor ?? transaction?.amount ?? 0);
  if (Number.isFinite(value) && value > 0) return "entrada";
  if (Number.isFinite(value) && value < 0) return "saida";

  const payload = getPayload(transaction);
  const ownAccountId = getProjectionAccountId(transaction);
  const originAccountId = firstId(
    transaction?.contaOrigemId,
    transaction?.conta_origem_id,
    transaction?.transferFromId,
    transaction?.transfer_from_id,
    payload?.contaOrigemId,
    payload?.conta_origem_id,
    payload?.transferFromId,
    payload?.transfer_from_id,
    payload?.originAccountId,
    payload?.origin_account_id
  );
  const destinationAccountId = firstId(
    transaction?.contaDestinoId,
    transaction?.conta_destino_id,
    transaction?.transferToId,
    transaction?.transfer_to_id,
    payload?.contaDestinoId,
    payload?.conta_destino_id,
    payload?.transferToId,
    payload?.transfer_to_id,
    payload?.destinationAccountId,
    payload?.destination_account_id
  );

  if (ownAccountId && ownAccountId === originAccountId) return "saida";
  if (ownAccountId && ownAccountId === destinationAccountId) return "entrada";

  return linkedDirection;
};

export const matchesProjectionOriginFilter = (
  originFilter: ProjectionOriginFilter,
  originType: ProjectionOriginType
) => originFilter === "todos" || originFilter === originType;

export const matchesProjectionMovementFilter = (
  movementFilter: ProjectionMovementFilter,
  movementDirection: ProjectionMovementDirection
) => {
  if (movementFilter === "todos") return true;
  if (!movementDirection) return false;
  return movementFilter === "entradas"
    ? movementDirection === "entrada"
    : movementDirection === "saida";
};

export const matchesProjectionSearch = (search: string, values: unknown[]) => {
  const normalizedSearch = normalizeText(search);
  if (!normalizedSearch) return true;
  const searchable = values.map((value) => String(value ?? "")).join(" ").toLowerCase();
  return searchable.includes(normalizedSearch);
};
