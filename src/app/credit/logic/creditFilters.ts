import type { CreditTransactionUI } from "../types";
import { formatDateOnlyISO } from "./cardCycles";

export const normalizeCreditSearchText = (value: any) =>
  String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

export const resolveCreditSpendingType = (
  tx: any
): "normal" | "fixo" | "parcelado" => {
  const payloadTipo = String(tx?.payload?.tipoGasto ?? "").trim().toLowerCase();
  const raizTipo = String(tx?.tipoGasto ?? "").trim().toLowerCase();

  const parcelaAtual = Number(
    tx?.parcelaAtual ?? tx?.payload?.parcelaAtual ?? 0
  );

  const parcelasTotal = Number(
    tx?.parcelasTotal ??
      tx?.totalParcelas ??
      tx?.payload?.parcelasTotal ??
      tx?.payload?.totalParcelas ??
      0
  );

  const isParcelado =
    parcelasTotal > 1 ||
    parcelaAtual > 0 ||
    String(tx?.origemLancamento ?? "").trim().toLowerCase() ===
      "compra_parcelada";

  if (isParcelado) return "parcelado";

  if (payloadTipo === "fixo" || raizTipo === "fixo") return "fixo";
  if (payloadTipo === "parcelado" || raizTipo === "parcelado") return "parcelado";

  return "normal";
};

export const getCreditCategoryLabel = (tx: any) => {
  const categoria = tx?.categoria;

  if (!categoria) return "";
  if (typeof categoria === "string") return categoria.trim();

  return String(
    categoria?.nome ?? categoria?.label ?? categoria?.value ?? ""
  ).trim();
};

export const getCreditCategoriesFromTransactions = (
  transactions: CreditTransactionUI[]
) => {
  return Array.from(
    new Set(
      (transactions ?? [])
        .map((tx) => getCreditCategoryLabel(tx))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
};

export const getCreditTagsFromTransactions = (
  transactions: CreditTransactionUI[]
) => {
  return Array.from(
    new Set(
      (transactions ?? [])
        .map((tx: any) => String(tx?.tag ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));
};