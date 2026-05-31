export const getCreditTransactionCardRef = (tx: any) =>
  String(
    tx?.cartaoId ??
      tx?.cartao_id ??
      tx?.qualCartao ??
      tx?.qual_cartao ??
      tx?.qualConta ??
      tx?.qual_conta ??
      tx?.payload?.cartaoId ??
      tx?.payload?.cartao_id ??
      tx?.payload?.qualCartao ??
      tx?.payload?.qual_cartao ??
      tx?.payload?.qualConta ??
      tx?.payload?.qual_conta ??
      tx?.payload?.targetId ??
      tx?.payload?.target_id ??
      ""
  ).trim();

export const normalizeCreditTransactionCardRefs = (tx: any) => {
  if (String(tx?.tipo ?? "").trim().toLowerCase() !== "cartao_credito") {
    return tx;
  }

  const payload =
    tx?.payload && typeof tx.payload === "object" ? tx.payload : {};

  const cardRef = getCreditTransactionCardRef({
    ...tx,
    payload,
  });

  if (!cardRef) {
    return {
      ...tx,
      payload,
    };
  }

  return {
    ...tx,
    cartaoId: cardRef,
    qualCartao: cardRef,
    payload: {
      ...payload,
      cartaoId: cardRef,
      qualCartao: cardRef,
      targetId: String(payload?.targetId ?? payload?.target_id ?? cardRef).trim(),
    },
  };
};