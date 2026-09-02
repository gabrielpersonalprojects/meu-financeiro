export type CardInvoicePriorityInfo = {
  rank: 0 | 1 | 2;
  dueTime: number;
  saldo: number;
};

const getCardActivityTime = (card: any) =>
  Math.max(
    new Date(String(card?.updatedAt ?? card?.updated_at ?? "")).getTime() || 0,
    new Date(String(card?.createdAt ?? card?.created_at ?? "")).getTime() || 0
  );

const getCardLabel = (card: any) =>
  String(card?.emissor ?? card?.name ?? card?.nome ?? "");

export const sortCardsByInvoicePriority = <T>(
  cards: T[],
  resolvePriority: (card: T) => CardInvoicePriorityInfo
) =>
  [...(cards ?? [])].sort((a: any, b: any) => {
    const aInactive = a?.is_active === false ? 1 : 0;
    const bInactive = b?.is_active === false ? 1 : 0;

    if (aInactive !== bInactive) return aInactive - bInactive;

    const infoA = resolvePriority(a);
    const infoB = resolvePriority(b);

    // A prioridade de situação nunca pode ser ultrapassada pela atividade recente.
    if (infoA.rank !== infoB.rank) return infoA.rank - infoB.rank;

    // Dentro da mesma situação, o cartão mexido mais recentemente vem primeiro.
    const aTime = getCardActivityTime(a);
    const bTime = getCardActivityTime(b);
    if (aTime !== bTime) return bTime - aTime;

    // Desempates preservam a urgência financeira e uma ordem estável.
    if (infoA.rank !== 2 && infoA.dueTime !== infoB.dueTime) {
      return infoA.dueTime - infoB.dueTime;
    }

    if (infoA.rank !== 2 && infoA.saldo !== infoB.saldo) {
      return infoB.saldo - infoA.saldo;
    }

    return getCardLabel(a).localeCompare(getCardLabel(b), "pt-BR");
  });
