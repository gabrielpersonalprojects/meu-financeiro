// src/app/money.ts

// ===== dinheiro (BRL) =====
export const parseBRLToCents = (raw: string) => {
  const digits = String(raw ?? "").replace(/\D/g, ""); // só números
  return Number(digits || "0"); // já é centavos
};

export const formatCentsToBRL = (cents: number) => {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};
