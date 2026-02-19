// src/app/utils/storage.ts
import type { Transaction } from "../types";

const KEY = "transacoes";

function safeParseArray(raw: string | null): any[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeId(val: any): string {
  if (typeof val === "string") return val.trim();
  if (typeof val === "number" && Number.isFinite(val)) return String(val);
  return "";
}

function normalizeDate(val: any): string {
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().split("T")[0];
  }
  if (typeof val === "string") return val.trim();
  return "";
}

function normalizeTx(input: any) {
  if (!input || typeof input !== "object") return null;
  const t: any = input;

  const pickStr = (...vals: any[]) => {
    for (const v of vals) {
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    return "";
  };

  const pickNum = (...vals: any[]) => {
    for (const v of vals) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
    return NaN;
  };

  const pickBool = (...vals: any[]) => {
    for (const v of vals) {
      if (typeof v === "boolean") return v;
    }
    return undefined;
  };

  // --- tipo (aceita cartão de crédito) ---
  const tipoRaw = String(t.tipo ?? t.type ?? "").trim().toLowerCase();
  const tipoMap: Record<string, string> = {
    expense: "despesa",
    despesa: "despesa",
    income: "receita",
    receita: "receita",
    transfer: "transferencia",
    transferencia: "transferencia",
    cartao: "cartao_credito",
    credito: "cartao_credito",
    credit: "cartao_credito",
    cartao_credito: "cartao_credito",
  };
  const tipo = tipoMap[tipoRaw] ?? tipoRaw;

  if (!["despesa", "receita", "transferencia", "cartao_credito"].includes(tipo)) {
    return null;
  }

  // ✅ ID agora aceita string OU number
  const id = normalizeId(t.id ?? t.txId ?? t.uuid);
  if (!id) return null;

  const valor = pickNum(t.valor, t.value);
  if (!Number.isFinite(valor)) return null;

  const data = normalizeDate(t.data ?? t.date);
  if (!data) return null;

  const out: any = { id, tipo, valor, data };

  // descrição/categoria
  const descricao = pickStr(t.descricao, t.desc, t.description);
  if (descricao) out.descricao = descricao;

  const categoria = pickStr(t.categoria, t.category);
  if (categoria) out.categoria = categoria;

  // campos extras que você usa no app
  const metodoPagamento = pickStr(t.metodoPagamento);
  if (metodoPagamento) out.metodoPagamento = metodoPagamento;

  const qualCartao = pickStr(t.qualCartao);
  if (qualCartao) out.qualCartao = qualCartao;

  const tipoGasto = pickStr(t.tipoGasto);
  if (tipoGasto) out.tipoGasto = tipoGasto;

  const pago = pickBool(t.pago);
  if (typeof pago === "boolean") out.pago = pago;

  // transferência / cartão / recorrência / parcelas
  const transferId = pickStr(t.transferId, t.transferenciaId);
  if (transferId) out.transferId = transferId;

  const cartaoId = pickStr(t.cartaoId, t.creditCardId, t.selectedCreditCardId);
  if (cartaoId) out.cartaoId = cartaoId;

  const recorrenciaId = pickStr(t.recorrenciaId);
  if (recorrenciaId) out.recorrenciaId = recorrenciaId;

  const parcelaAtual = pickNum(t.parcelaAtual);
  if (Number.isFinite(parcelaAtual)) out.parcelaAtual = parcelaAtual;

  const totalParcelas = pickNum(t.totalParcelas);
  if (Number.isFinite(totalParcelas)) out.totalParcelas = totalParcelas;

  const isRecorrente = pickBool(t.isRecorrente);
  if (typeof isRecorrente === "boolean") out.isRecorrente = isRecorrente;

  return out;
}

function txIdentity(t: any) {
  const id = t?.id ?? "";
  const transferId = t?.transferId ?? "";
  const data = t?.data ?? "";
  const valor = t?.valor ?? "";
  const desc = t?.descricao ?? "";
  const tipo = t?.tipo ?? "";

  // campos importantes do cartão/parcelado
  const cartaoId = t?.cartaoId ?? "";
  const recorrenciaId = t?.recorrenciaId ?? "";
  const parcelaAtual = t?.parcelaAtual ?? "";
  const totalParcelas = t?.totalParcelas ?? "";

  return `${id}|${transferId}|${tipo}|${data}|${valor}|${desc}|${cartaoId}|${recorrenciaId}|${parcelaAtual}|${totalParcelas}`;
}

/**
 * Junta tudo que existir em chaves antigas e normaliza pra 1 chave só: "transacoes".
 * Idempotente: pode rodar sempre, não quebra.
 */
export function loadAllToTransacoesKey(): Transaction[] {
  const keys = Object.keys(localStorage);

  const legacyKeys = keys.filter(
    (k) =>
      k === "transactions" || // inglês (bug antigo)
      k === "transacoes" || // canônica
      k.endsWith("_transacoes")
  );

  const allRaw: any[] = [];
  for (const k of legacyKeys) {
    allRaw.push(...safeParseArray(localStorage.getItem(k)));
  }

  const all = allRaw.map(normalizeTx).filter(Boolean) as Transaction[];

  const seen = new Set<string>();
  const unique: Transaction[] = [];
  for (const t of all) {
    const sig = txIdentity(t);
    if (!seen.has(sig)) {
      seen.add(sig);
      unique.push(t);
    }
  }

  localStorage.setItem(KEY, JSON.stringify(unique));

  for (const k of legacyKeys) {
    if (k !== KEY) localStorage.removeItem(k);
  }

  return unique;
}

export function persistTransacoes(list: Transaction[]) {
  const normalized = (list ?? []).map(normalizeTx).filter(Boolean) as Transaction[];
  localStorage.setItem(KEY, JSON.stringify(normalized));
}

export { loadAllToTransacoesKey as loadOrMigrateTransacoes };
