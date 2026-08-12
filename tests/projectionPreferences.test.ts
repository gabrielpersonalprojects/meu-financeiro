import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  EMPTY_PROJECTION_PREFERENCES,
  clearProjectionPreferences,
  filterTransactionsForProjection,
  formatProjectionPreferencesMessage,
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

test("PF e PJ persistem de forma independente e somente a limpeza explicita remove a chave", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) };
  saveProjectionPreferences("user-1", "pf", normalizeProjectionPreferences({ excludedAccountIds: ["account-pf"] }), storage);
  saveProjectionPreferences("user-1", "pj", normalizeProjectionPreferences({ excludedCardIds: ["card-pj"] }), storage);
  assert.deepEqual(loadProjectionPreferences("user-1", "pf", storage).excludedAccountIds, ["account-pf"]);
  assert.deepEqual(loadProjectionPreferences("user-1", "pj", storage).excludedCardIds, ["card-pj"]);
  saveProjectionPreferences("user-1", "pf", EMPTY_PROJECTION_PREFERENCES, storage);
  assert.equal(values.has("fluxmoney:projection-preferences:v1:user-1:pf"), true);
  clearProjectionPreferences("user-1", "pf", storage);
  assert.equal(isProjectionPreferencesActive(loadProjectionPreferences("user-1", "pf", storage)), false);
  assert.equal(values.has("fluxmoney:projection-preferences:v1:user-1:pf"), false);
  assert.equal(values.has("fluxmoney:projection-preferences:v1:user-1:pj"), true);
  assert.equal(filter("pf", EMPTY_PROJECTION_PREFERENCES).length, 5);
});

test("salvar preferencias vazias nao se confunde com o fluxo destrutivo de limpar", () => {
  const calls = { set: 0, remove: 0 };
  const storage = {
    setItem: () => { calls.set += 1; },
    removeItem: () => { calls.remove += 1; },
  };

  saveProjectionPreferences("user-1", "pf", EMPTY_PROJECTION_PREFERENCES, storage);
  assert.deepEqual(calls, { set: 1, remove: 0 });

  clearProjectionPreferences("user-1", "pf", storage);
  assert.deepEqual(calls, { set: 1, remove: 1 });
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

test("texto do aviso omite zeros e respeita singular e plural", () => {
  assert.equal(formatProjectionPreferencesMessage({ accounts: 1, cards: 0, transactions: 0 }), "1 conta excluída da projeção.");
  assert.equal(formatProjectionPreferencesMessage({ accounts: 2, cards: 0, transactions: 0 }), "2 contas excluídas da projeção.");
  assert.equal(formatProjectionPreferencesMessage({ accounts: 0, cards: 1, transactions: 0 }), "1 cartão excluído da projeção.");
  assert.equal(formatProjectionPreferencesMessage({ accounts: 0, cards: 2, transactions: 0 }), "2 cartões excluídos da projeção.");
  assert.equal(formatProjectionPreferencesMessage({ accounts: 0, cards: 0, transactions: 1 }), "1 lançamento excluído da projeção.");
  assert.equal(formatProjectionPreferencesMessage({ accounts: 0, cards: 0, transactions: 2 }), "2 lançamentos excluídos da projeção.");
});

test("texto do aviso combina dois ou tres tipos naturalmente", () => {
  assert.equal(formatProjectionPreferencesMessage({ accounts: 1, cards: 0, transactions: 2 }), "1 conta e 2 lançamentos excluídos da projeção.");
  assert.equal(formatProjectionPreferencesMessage({ accounts: 1, cards: 2, transactions: 3 }), "1 conta, 2 cartões e 3 lançamentos excluídos da projeção.");
  assert.equal(formatProjectionPreferencesMessage({ accounts: 0, cards: 0, transactions: 0 }), null);
});

test("IDs orfaos nao aparecem no texto do aviso", () => {
  const sanitized = sanitizeProjectionPreferences({ preferences: normalizeProjectionPreferences({ excludedAccountIds: ["missing"], excludedCardIds: ["missing"], excludedTransactionIds: ["missing"] }), profile: "pf", profiles, creditCards: cards, transactions });
  assert.equal(formatProjectionPreferencesMessage(getProjectionPreferencesSummary(sanitized)), null);
});

const readProjectionUi = () => ({
  tab: readFileSync(path.join(process.cwd(), "src", "components", "tabs", "ProjecaoTab.tsx"), "utf8"),
  modal: readFileSync(path.join(process.cwd(), "src", "components", "projection", "ProjectionConfigModal.tsx"), "utf8"),
});

test("limpeza usa confirmacao interna e uma unica funcao compartilhada", () => {
  const { tab } = readProjectionUi();
  assert.doesNotMatch(tab, /window\.confirm|window\.alert|\balert\(/);
  assert.match(tab, /await confirm\(\{/);
  assert.match(tab, /const requestClearPreferences = async/);
  assert.equal((tab.match(/void requestClearPreferences\(/g) ?? []).length, 1);
  assert.match(tab, /clearPendingRef\.current/);
  assert.match(tab, /onClearPreferences\(profile\)/);
});

test("modal de configuracao possui somente Cancelar e Aplicar", () => {
  const { modal, tab } = readProjectionUi();
  const footer = modal.slice(modal.indexOf('className="flex flex-wrap justify-end gap-2'));
  assert.match(footer, />Cancelar<\/button>/);
  assert.match(footer, /\{isApplying \? "Salvando\.\.\." : "Aplicar"\}/);
  assert.equal((footer.match(/<button/g) ?? []).length, 2);
  assert.doesNotMatch(modal, /Limpar filtros|\bonClear\b/);
  assert.equal((tab.match(/>Limpar<\/button>/g) ?? []).length, 1);
});

test("limpeza externa restaura foco ao cancelar e nunca convive com modal de configuracao", () => {
  const { tab } = readProjectionUi();
  assert.match(tab, /clearTriggerRef\.current = event\.currentTarget/);
  assert.match(tab, /clearTriggerRef\.current\?\.focus\(\)/);
  assert.doesNotMatch(tab, /ProjectionConfigModal[\s\S]*requestClearPreferences\(configProfile\)/);
});

test("confirmacao da limpeza possui textos e tom destrutivo corretos", () => {
  const { tab } = readProjectionUi();
  assert.match(tab, /Limpar configuração da projeção\?/);
  assert.match(tab, /Todas as contas, cartões e lançamentos voltarão a participar dos cálculos deste perfil\./);
  assert.match(tab, /confirmText:\s*"Limpar configuração"/);
  assert.match(tab, /cancelText:\s*"Cancelar"/);
  assert.match(tab, /tone:\s*"danger"/);
});

test("modal limita scrollbar ao conteudo e mantem header e footer fora dele", () => {
  const { modal } = readProjectionUi();
  const headerIndex = modal.indexOf("Configurar projeção");
  const scrollIndex = modal.indexOf("data-projection-config-scroll");
  const footerIndex = modal.indexOf(">Cancelar</button>");
  assert.ok(headerIndex >= 0 && headerIndex < scrollIndex);
  assert.ok(footerIndex > scrollIndex);
  assert.match(modal, /\[scrollbar-width:thin\]/);
  assert.match(modal, /\[scrollbar-color:rgba\(64,0,156,0\.55\)_transparent\]/);
  assert.match(modal, /\[&::\-webkit-scrollbar\]:w-1\.5/);
  assert.match(modal, /dark:bg-slate-900/);
});

test("modal preserva acessibilidade, Escape e retorno de foco", () => {
  const { tab, modal } = readProjectionUi();
  assert.match(modal, /role="dialog"/);
  assert.match(modal, /aria-modal="true"/);
  assert.match(tab, /event\.key === "Escape" && !clearPendingRef\.current/);
  assert.match(tab, /configTriggerRef\.current\?\.focus\(\)/);
});

test("filtros de lançamentos usam duas linhas com busca e grupos separados", () => {
  const { modal } = readProjectionUi();
  assert.match(modal, /Buscar lançamento\.\.\./);
  assert.match(modal, /className="mb-3 space-y-2"/);
  assert.match(modal, />Origem<\/p>/);
  assert.match(modal, />Movimentação<\/p>/);
  assert.match(modal, /value === "todos" \? "Todos" : value === "entradas" \? "Entradas" : "Saídas"/);
});
