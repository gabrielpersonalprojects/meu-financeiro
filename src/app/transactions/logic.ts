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

export const getContaPartsById = (accountId: string, contas: any[]) => {
  const c = contas.find((x: any) => x.id === accountId);
  if (!c) return null;

  const banco = c.banco || "Conta";
  const perfil = (c.tipoConta || "").toUpperCase(); // PF ou PJ
  const tipo = (c.perfilConta || "").toUpperCase(); // CONTA CORRENTE, POUPANÇA...

  const numero = c.numeroConta ? `Nº da conta: ${maskLast4(c.numeroConta)}` : "";
  const agencia = c.numeroAgencia ? `Ag: ${c.numeroAgencia}` : "";

  return { banco, perfil, tipo, numero, agencia };
};

export const formatContaLabelById = (accountId: string, contas: any[]) => {
  const c = contas.find((x: any) => x.id === accountId);
  if (!c) return "Conta";

  // Ajuste os nomes dos campos conforme seu modelo:
  const nome = c.banco || "Conta";
  const numero = c.numeroConta;
  const agencia = c.numeroAgencia;

  const parts: string[] = [nome];
  if (numero) parts.push(`Nº da conta: ${maskLast4(numero)}`);
  if (agencia) parts.push(`Ag: ${agencia}`);

  return parts.join(" - ");
};
