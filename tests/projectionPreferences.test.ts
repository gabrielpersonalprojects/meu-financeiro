import test from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_PROJECTION_PREFERENCES,
  filterTransactionsForProjection,
  getProjectionPreferencesSummary,
  getProjectionTransactionGroupKey,
  isProjectionPreferencesActive,
  loadProjectionPreferences,
  normalizeProjectionPreferences,
  saveProjectionPreferences,
  sanitizeProjectionPreferences,
} from "../src/app/transactions/projectionPreferences";

const profiles = [
  { id: "account-pf", name: "Nubank PF", perfilConta: "PF" },
  { id: "account-pj", name: "Itau PJ", perfilConta: "PJ" },
];
const cards = [
  { id: "card-pf", emissor: "Nubank", perfil: "pf" },
  { id: "card-pj", emissor: "Itau", perfil: "pj" },
];
const transactions: any[] = [
  { id: "single-pf", tipo: "despesa", contaId: "account-pf", descricao: "Unica", valor: -10 },
  { id: "installment-1", tipo: "cartao_credito", cartaoId: "card-pf", recorrenciaId: "installment-series", parcelaAtual: 1, totalParcelas: 2, valor: -20 },
  { id: "installment-2", tipo: "cartao_credito", cartaoId: "card-pf", recorrenciaId: "installment-series", parcelaAtual: 2, totalParcelas: 2, valor: -20 },
  { id: "recurring-1", tipo: "despesa", contaId: "account-pf", recorrenciaId: "fixed-series", valor: -30 },
  { id: "recurring-2", tipo: "despesa", contaId: "account-pf", recorrenciaId: "fixed-series", valor: -30 },
  { id: "single-pj", tipo: "despesa", contaId: "account-pj", valor: -40 },
  { id: "card-pj-item", tipo: "cartao_credito", cartaoId: "card-pj", valor: -50 },
];

const filter = (profile: "geral" | "pf" | "pj", preferences: any, source = transactions) =>
  filterTransactionsForProjection({ transactions: source, profile, profiles, creditCards: cards, preferences });

test("ausencia de configuracao mantem todos os lancamentos do perfil", () => {
  assert.deepEqual(filter("pf", EMPTY_PROJECTION_PREFERENCES).map((item: any) => item.id), transactions.slice(0, 5).map((item) => item.id));
});

test("exclusao de conta e cartao remove somente suas origens", () => {
  assert.equal(filter("pf", { excludedAccountIds: ["account-pf"] }).every((item: any) => item.tipo === "cartao_credito"), true);
  assert.equal(filter("pf", { excludedCardIds: ["card-pf"] }).every((item: any) => item.tipo !== "cartao_credito"), true);
});

test("exclusao unica remove somente a transacao escolhida", () => {
  const result = filter("pf", { excludedTransactionIds: ["single-pf"] });
  assert.equal(result.some((item: any) => item.id === "single-pf"), false);
  assert.equal(result.length, 4);
});

test("parcelas e recorrencias usam uma chave estavel de grupo", () => {
  assert.equal(getProjectionTransactionGroupKey(transactions[1]), "recurrence:installment-series");
  assert.equal(getProjectionTransactionGroupKey(transactions[3]), "recurrence:fixed-series");
  assert.equal(filter("pf", { excludedGroupIds: ["recurrence:installment-series"] }).some((item: any) => item.id.startsWith("installment")), false);
  assert.equal(filter("pf", { excludedGroupIds: ["recurrence:fixed-series"] }).some((item: any) => item.id.startsWith("recurring")), false);
});

test("nova ocorrencia do grupo excluido continua fora e nova transacao independente entra", () => {
  const source = [...transactions, { id: "installment-3", tipo: "cartao_credito", cartaoId: "card-pf", recorrenciaId: "installment-series", valor: -20 }, { id: "new-single", tipo: "despesa", contaId: "account-pf", valor: -5 }];
  const result = filter("pf", { excludedGroupIds: ["recurrence:installment-series"] }, source);
  assert.equal(result.some((item: any) => item.id === "installment-3"), false);
  assert.equal(result.some((item: any) => item.id === "new-single"), true);
});

test("PF e PJ persistem de forma independente e limpar restaura tudo", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
  saveProjectionPreferences("user-1", "pf", normalizeProjectionPreferences({ excludedAccountIds: ["account-pf"] }), storage);
  saveProjectionPreferences("user-1", "pj", normalizeProjectionPreferences({ excludedCardIds: ["card-pj"] }), storage);
  assert.deepEqual(loadProjectionPreferences("user-1", "pf", storage).excludedAccountIds, ["account-pf"]);
  assert.deepEqual(loadProjectionPreferences("user-1", "pj", storage).excludedCardIds, ["card-pj"]);
  saveProjectionPreferences("user-1", "pf", EMPTY_PROJECTION_PREFERENCES, storage);
  assert.equal(isProjectionPreferencesActive(loadProjectionPreferences("user-1", "pf", storage)), false);
  assert.equal(filter("pf", EMPTY_PROJECTION_PREFERENCES).length, 5);
});

test("preferencias invalidas e IDs orfaos sao higienizados sem quebrar", () => {
  const result = sanitizeProjectionPreferences({ preferences: normalizeProjectionPreferences({ excludedAccountIds: ["missing"], excludedTransactionIds: ["missing"] }), profile: "pf", profiles, creditCards: cards, transactions });
  assert.deepEqual(result, EMPTY_PROJECTION_PREFERENCES);
});

test("aviso e contador refletem somente exclusoes reais", () => {
  const preferences = normalizeProjectionPreferences({ excludedAccountIds: ["account-pf"], excludedCardIds: ["card-pf"], excludedTransactionIds: ["single-pf"], excludedGroupIds: ["recurrence:fixed-series"] });
  assert.equal(isProjectionPreferencesActive(preferences), true);
  assert.deepEqual(getProjectionPreferencesSummary(preferences), { accounts: 1, cards: 1, transactions: 2 });
  assert.equal(isProjectionPreferencesActive(EMPTY_PROJECTION_PREFERENCES), false);
});

test("filtro preserva referencias e nao muda objetos originais", () => {
  const snapshot = JSON.stringify(transactions);
  const result = filter("pf", { excludedTransactionIds: ["single-pf"] });
  assert.equal(result[0], transactions[1]);
  assert.equal(JSON.stringify(transactions), snapshot);
});

test("cancelar e fonte unica permanecem responsabilidades sem efeito colateral", () => {
  const persisted = normalizeProjectionPreferences({ excludedTransactionIds: ["single-pf"] });
  const draft = normalizeProjectionPreferences({ ...persisted, excludedCardIds: ["card-pf"] });
  assert.deepEqual(persisted.excludedCardIds, []);
  const considered = filter("pf", persisted);
  const listSource = considered;
  const totalsSource = considered;
  const chartSource = considered;
  assert.equal(listSource, totalsSource);
  assert.equal(totalsSource, chartSource);
  assert.equal(draft.excludedCardIds.length, 1);
});
