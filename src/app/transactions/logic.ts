// src/app/transactions/logic.ts
import type { Transaction } from "../types";

export const passarFiltroConta = (
  t: Transaction,
  filtroConta: string | null | undefined,
  activeProfileId: string
) => {
  const anyt: any = t as any;

  // 1) "todas"
  if (String(filtroConta) === "todas") return true;

  // 2) helpers
  const getTxContaId = () =>
    String(
      anyt.profileId ??
        anyt.contaId ??
        anyt.accountId ??
        anyt.perfilId ??
        anyt.idConta ??
        anyt.contaVinculadaId ??
        ""
    );

  const alvo = String(filtroConta ?? "");

  // 3) Sem conta / perfil atual (mantém sua lógica original)
  if (!alvo) return true;

  // Se você tiver um caso "sem_conta" no seu app, mantém aqui:
  if (alvo === "sem_conta") {
    const txContaId = getTxContaId();
    return !txContaId || txContaId === "null" || txContaId === "undefined";
  }

  // 4) Match direto por contaId
  const txContaId = getTxContaId();
  if (txContaId && txContaId === alvo) return true;

  // 5) Fallback: se o filtro usa o profile atual
  if (alvo === activeProfileId) return true;

  return false;
};

export const maskLast4 = (v: string) => {
  if (!v) return "";
  const digits = String(v).replace(/\D/g, "");
  if (digits.length <= 4) return digits;
  return "****" + digits.slice(-4);
};
