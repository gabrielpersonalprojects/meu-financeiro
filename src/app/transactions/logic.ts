// src/app/transactions/logic.ts
import type { Transaction } from "../types";
const isPaid = (v: any) => v === true || v === 1 || v === "1" || v === "true" || v === "pago";

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
      anyt.contaid ??        // <- novo
      anyt.qualConta ??      // <- novo
      anyt.qualconta ??      // <- novo
      anyt.conta ??          // <- novo
      anyt.accountId ??
      anyt.perfilId ??
      anyt.idConta ??
      anyt.contaVinculadaId ??
      ""
  );

  const alvo = String(filtroConta ?? "");

  // 3) Sem conta / perfil atual (mantém sua lógica original)
  if (!alvo) return true;

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
const normAccId = (v: any) => String(v ?? "").trim().replace(/^acc_/, "");
export const getContaPartsById = (accountId: string, contas: any[]) => {
  const c = contas.find((x: any) => normAccId(x?.id) === normAccId(accountId));
  if (!c) return null;

  const banco = c.banco || "Conta";
  const perfil = (c.tipoConta || "").toUpperCase(); // PF ou PJ
  const tipo = (c.perfilConta || "").toUpperCase(); // CONTA CORRENTE, POUPANÇA...

  const numero = c.numeroConta ? `Nº da conta: ${maskLast4(c.numeroConta)}` : "";
  const agencia = c.numeroAgencia ? `Ag: ${c.numeroAgencia}` : "";

  return { banco, perfil, tipo, numero, agencia };
};

export const formatContaLabelById = (accountId: string, contas: any[]) => {
  const c = contas.find((x: any) => normAccId(x?.id) === normAccId(accountId));
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

export const mergeTransfers = (list: Transaction[]) => {
  const safeList = (Array.isArray(list) ? list : []).filter(Boolean) as any[];

  const normTid = (v: any) => String(v ?? "").trim().replace(/^tr_+/g, "");
  const getTid = (x: any) => normTid(x?.transferId ?? x?.transferID ?? x?.transfer_id);

  const out: Transaction[] = [];
  const seen = new Set<string>();

  for (const t of safeList) {
    if (!t) continue;

    const tid = getTid(t);
    if (!tid) {
      out.push(t as Transaction);
      continue;
    }

    if (seen.has(tid)) continue;
    seen.add(tid);

    const group = safeList.filter((x) => x && getTid(x) === tid);

        // ✅ se não tiver as DUAS pernas, não mescla
    const hasDespesa = group.some((x) => String((x as any).tipo) === "despesa");
    const hasReceita = group.some((x) => String((x as any).tipo) === "receita");
    if (!hasDespesa || !hasReceita) {
      out.push(t as Transaction);
      continue;
    }


    if (group.length < 2) {
      out.push(...(group as Transaction[]));
      continue;
    }

    // escolhe pernas de forma robusta
    const saida =
      group.find((x) => Number((x as any).valor) < 0) ??
      group.find((x) => (x as any).tipo === "despesa") ??
      group[0];

    const entrada =
      group.find((x) => Number((x as any).valor) > 0) ??
      group.find((x) => (x as any).tipo === "receita") ??
      group[1] ??
      group[0];

    const abs = Math.abs(Number((saida as any).valor ?? (entrada as any).valor ?? 0)) || 0;

    const merged: any = {
      ...saida,

      id: `tr_${tid}`,
      tipo: "transferencia" as any,
      categoria: "Transferência",
      transferId: tid,

contaOrigemId: String(
  (saida as any).contaOrigemId ??
  (saida as any).transferFromId ??
  (saida as any).contaId ??
  ""
),

contaDestinoId: String(
  (entrada as any).contaDestinoId ??
  (entrada as any).transferToId ??
  (entrada as any).contaId ??
  ""
),

      valor: abs,
      valorSaida: -abs,
      valorEntrada: abs,

      // ✅ pago = true só se TODAS as pernas estão pagas
      
      pago: group.every((x: any) => isPaid(x?.pago)),


      data: (saida as any).data ?? (entrada as any).data,

      _sourceIds: group.map((x: any) => x?.id).filter(Boolean),
    };

    out.push(merged as Transaction);
  }

  return out;
};



