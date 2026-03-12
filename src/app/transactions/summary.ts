import type { Profile, Transaction } from "../types";
import { sortByValueDesc } from "../utils/sort";
import { asId } from "../../utils/asId";

export type SpendingByCategoryDatum = {
  name: string;
  value: number;
  percentage: string;
};

export type PerfilView = "geral" | "pf" | "pj";

const getPerfilContaFromTransaction = (
  t: Transaction,
  profiles: Profile[]
): "PF" | "PJ" | null => {
  const profileId = asId(
  (t as any)?.profileId ??
    (t as any)?.contaId ??
    (t as any)?.qualConta ??
    (t as any)?.conta?.id ??
    (t as any)?.profile?.id ??
    ""
);
  if (!profileId) return null;

  const profile = (profiles ?? []).find((p) => asId((p as any)?.id) === profileId);
  const perfil = String((profile as any)?.perfilConta ?? "")
    .trim()
    .toUpperCase();

  if (perfil === "PF" || perfil === "PJ") return perfil;
  return null;
};

export const computeSpendingByCategoryData = (
  transacoes: Transaction[],
  filtroMes?: string,
  perfilView: PerfilView = "geral",
  profiles: Profile[] = []
): SpendingByCategoryDatum[] => {
  const mesPrefix = filtroMes || "";

  const currentExpenses = (transacoes ?? []).filter((t) => {
    const isMesOk = String(t?.data ?? "").startsWith(mesPrefix);
    const isDespesa = t?.tipo === "despesa";

    if (!isMesOk || !isDespesa) return false;

    if (perfilView === "geral") return true;

    const perfilConta = getPerfilContaFromTransaction(t, profiles);

    if (perfilView === "pf") return perfilConta === "PF";
    if (perfilView === "pj") return perfilConta === "PJ";

    return true;
  });

  const totalExpense = currentExpenses.reduce(
    (s, t) => s + Math.abs(Number(t.valor) || 0),
    0
  );

  const categoriesMap: Record<string, number> = {};

  currentExpenses.forEach((t) => {
    const categoria = String(t.categoria || "Sem categoria").trim() || "Sem categoria";

    categoriesMap[categoria] =
      (categoriesMap[categoria] || 0) + Math.abs(Number(t.valor) || 0);
  });

  return sortByValueDesc(
    Object.entries(categoriesMap).map(([name, value]) => ({
      name,
      value,
      percentage:
        totalExpense > 0 ? ((value / totalExpense) * 100).toFixed(1) : "0",
    }))
  );
};