// src/utils/storage.ts
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

function txIdentity(t: any) {
  // se tiver id, ótimo; senão, fallback bem estável
  const id = t?.id ?? "";
  const transferId = t?.transferId ?? "";
  const data = t?.data ?? "";
  const valor = t?.valor ?? "";
  const desc = t?.descricao ?? "";
  const tipo = t?.tipo ?? "";
  return `${id}|${transferId}|${tipo}|${data}|${valor}|${desc}`;
}

/**
 * Junta tudo que existir em chaves antigas e normaliza pra 1 chave só: "transacoes".
 * Idempotente: pode rodar sempre, não quebra.
 */
export function loadAllToTransacoesKey(): Transaction[] {
  const keys = Object.keys(localStorage);

  // pega TODAS as chaves antigas de transações
  const legacyKeys = keys.filter(
    (k) =>
      k === "transactions" || // inglês (bug antigo)
      k === "transacoes" ||   // canônica
      k.endsWith("_transacoes")
  );

  // junta tudo
  const all: any[] = [];
  for (const k of legacyKeys) {
    all.push(...safeParseArray(localStorage.getItem(k)));
  }

  // deduplica
  const seen = new Set<string>();
  const unique: any[] = [];
  for (const t of all) {
    const sig = txIdentity(t);
    if (!seen.has(sig)) {
      seen.add(sig);
      unique.push(t);
    }
  }

  // salva na chave canônica
  localStorage.setItem(KEY, JSON.stringify(unique));

  // apaga chaves antigas, exceto a canônica
  for (const k of legacyKeys) {
    if (k !== KEY) localStorage.removeItem(k);
  }

  // 1) salva tudo na chave canônica
localStorage.setItem(KEY, JSON.stringify(all));

// 2) APAGA as chaves antigas pra não voltar no F5
for (const k of legacyKeys) {
  if (k !== KEY) localStorage.removeItem(k);
}

  return unique as Transaction[];
}

export function persistTransacoes(list: Transaction[]) {
  localStorage.setItem(KEY, JSON.stringify(list ?? []));
}

export { loadAllToTransacoesKey as loadOrMigrateTransacoes };
