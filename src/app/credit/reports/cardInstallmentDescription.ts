const INSTALLMENT_SUFFIX_PATTERN =
  /\s*(?:\(\s*\d+\s*\/\s*\d+\s*\)|(?:[-–—]\s*)?parcela\s+\d+\s*(?:\/|de)\s*\d+)\s*$/i;

export const removeInstallmentSuffixFromDescription = (value: unknown) =>
  String(value ?? "").replace(INSTALLMENT_SUFFIX_PATTERN, "").trim();
