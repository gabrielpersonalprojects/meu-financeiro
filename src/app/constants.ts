export const CATEGORIAS_PADRAO = {
  despesa: [
    "Alimentação",
    "Transporte",
    "Moradia",
    "Saúde",
    "Lazer",
    "Educação",
    "Assinaturas",
    "Compras",
    "Contas",
    "Outros",
  ],
  receita: ["Salário", "Freelance", "Vendas", "Investimentos", "Outros"],
};

export const STORAGE_KEYS = {
  TRANSACOES: "transacoes",
  FATURA_PAYMENTS: "fluxmoney:fatura_payments:v1",
  CC_TAGS: "fluxmoney_cc_tags",
  PROFILES: "accounts_list_v1",
  CREDIT_CARDS: "fluxmoney_creditCards",
  CREDIT_CARDS_LEGACY: "CREDIT_CARDS_V1",
  DISPLAY_NAME: "fluxmoney_display_name",
  DISPLAY_NAME_CONFIRMED: "fluxmoney_display_name_confirmed",
  DARK_MODE: "darkMode",
  THEME: "theme",
  ACTIVE_PROFILE_ID: "activeProfileId",
  FILTRO_CONTA: "filtroConta",
  FLUXMONEY_PROFILES: "fluxmoney_profiles",
} as const;

export const PROFILE_KEYS = {
  DEFAULT_ID: "default",
} as const;

export const buildProfilePrefix = (profileId: string) =>
  profileId === PROFILE_KEYS.DEFAULT_ID ? "" : `${profileId}_`;

export const normalizeFiltroContaValue = (value: unknown): string => {
  const s = String(value ?? "").trim().toLowerCase();

  if (!s) return "todas";
  if (s === "sem_conta" || s === "sem conta" || s === "sem contas" || s === "semconta") {
    return "todas";
  }

  return String(value);
};

export const buildProfileStorageKey = (
  profileId: string,
  baseKey: "transacoes" | "transactions" | "categorias" | "metodosPagamento" | "userName"
) => `${buildProfilePrefix(profileId)}${baseKey}`;