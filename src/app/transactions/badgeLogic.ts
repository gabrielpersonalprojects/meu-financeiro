export const normalizeTransactionSpendingType = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const isVariableTransactionSpendingType = (value: unknown) => {
  const normalized = normalizeTransactionSpendingType(value);
  return ["variavel", "normal", "comum", "variable"].includes(normalized);
};
