import type { Profile } from "../types";

/**
 * Labels de "contas/cartões" disponíveis (sem duplicar)
 * Regra atual: pega profiles que possuem cartaoCredito e monta um label.
 */
export function getCartoesDisponiveis(profiles: Profile[]): string[] {
  const labels = (profiles || [])
    .filter((p) => !!p.possuiCartaoCredito)
    .map((p) => `${p.banco || p.name}${p.numeroConta ? ` • ${p.numeroConta}` : ""}`.trim())
    .filter(Boolean);

  return Array.from(new Set(labels)); // evita duplicados
}

/**
 * Label auxiliar (opcional) — mantive porque você tem isso logo abaixo no App.tsx.
 */
export function labelCartao(p: Profile): string {
  return `${p.perfilConta} • ${p.banco}${p.numeroConta ? ` • ${p.numeroConta}` : ""}`;
}
