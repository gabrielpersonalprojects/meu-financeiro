import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildProjectionSelectionKeysForProfile,
  computeProjectionSelectionStats,
} from "../src/components/projection/projectionSelection";
import {
  EMPTY_PROJECTION_PREFERENCES,
  normalizeProjectionPreferences,
} from "../src/app/transactions/projectionPreferences";
import type { Transaction } from "../src/app/types";

const profiles = [
  { id: "acc-pf", perfilConta: "PF", name: "Conta PF" },
  { id: "acc-pj", perfilConta: "PJ", name: "Conta PJ" },
];
const creditCards = [
  { id: "card-pf", perfil: "pf", emissor: "Nubank" },
  { id: "card-pj", perfil: "pj", emissor: "Itau" },
];

const baseTransactions = [
  { id: "income-pf", tipo: "receita", contaId: "acc-pf", descricao: "Salário", valor: 1000 },
  { id: "expense-pf", tipo: "despesa", contaId: "acc-pf", descricao: "Mercado", valor: -100 },
  { id: "card-purchase-pf", tipo: "cartao_credito", cartaoId: "card-pf", descricao: "CapCut", valor: -59.9 },
  {
    id: "transfer-out-pf",
    tipo: "transferencia",
    contaId: "acc-pf",
    contaOrigemId: "acc-pf",
    contaDestinoId: "acc-pf-dst",
    transferId: "trf-pf-1",
    valor: -300,
  },
  {
    id: "transfer-in-pf",
    tipo: "transferencia",
    contaId: "acc-pf",
    contaOrigemId: "acc-pf-src",
    contaDestinoId: "acc-pf",
    transferId: "trf-pf-2",
    valor: 300,
  },
  {
    id: "pfpj-out",
    tipo: "despesa",
    contaId: "acc-pf",
    payload: {
      movementKind: "pf_pj",
      linkedMovementId: "mov-1",
      linkedMovementDirection: "saida",
    },
    valor: -200,
  },
  {
    id: "pfpj-in",
    tipo: "receita",
    contaId: "acc-pf",
    payload: {
      movementKind: "pf_pj",
      linkedMovementId: "mov-1",
      linkedMovementDirection: "entrada",
    },
    valor: 200,
  },
  { id: "installment-1", tipo: "cartao_credito", cartaoId: "card-pf", recorrenciaId: "parcelado-1", valor: -80 },
  { id: "installment-2", tipo: "cartao_credito", cartaoId: "card-pf", recorrenciaId: "parcelado-1", valor: -80 },
  { id: "single-pj", tipo: "despesa", contaId: "acc-pj", valor: -50 },
  { id: "card-pj", tipo: "cartao_credito", cartaoId: "card-pj", valor: -90 },
] as unknown as Transaction[];

const keysFor = (preferences: any = EMPTY_PROJECTION_PREFERENCES) =>
  buildProjectionSelectionKeysForProfile({
    transactions: baseTransactions,
    profile: "pf",
    profiles,
    creditCards,
    preferences: normalizeProjectionPreferences(preferences),
  });

const statsFor = (preferences: any = EMPTY_PROJECTION_PREFERENCES) => {
  const prefs = normalizeProjectionPreferences(preferences);
  const keys = keysFor(prefs);
  return computeProjectionSelectionStats({
    selectionKeys: keys,
    preferences: prefs,
  });
};

const keysForProfile = (
  profile: "pf" | "pj",
  preferences: any = EMPTY_PROJECTION_PREFERENCES
) =>
  buildProjectionSelectionKeysForProfile({
    transactions: baseTransactions,
    profile,
    profiles,
    creditCards,
    preferences: normalizeProjectionPreferences(preferences),
  });

const modalSource = () =>
  readFileSync(
    path.join(process.cwd(), "src", "components", "projection", "ProjectionConfigModal.tsx"),
    "utf8"
  );

const appSource = () =>
  readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");

const applyToggleAll = (preferences: any) => {
  const current = normalizeProjectionPreferences(preferences);
  const keys = keysFor(current);
  const stats = computeProjectionSelectionStats({ selectionKeys: keys, preferences: current });
  const excludedGroups = new Set(current.excludedGroupIds);
  const excludedTransactions = new Set(current.excludedTransactionIds);

  if (stats.allSelected) {
    for (const key of keys) {
      if (key.startsWith("transaction:")) {
        excludedTransactions.add(key.slice("transaction:".length));
      } else {
        excludedGroups.add(key);
      }
    }
  } else {
    for (const key of keys) {
      if (key.startsWith("transaction:")) {
        excludedTransactions.delete(key.slice("transaction:".length));
      } else {
        excludedGroups.delete(key);
      }
    }
  }

  return normalizeProjectionPreferences({
    ...current,
    excludedGroupIds: Array.from(excludedGroups),
    excludedTransactionIds: Array.from(excludedTransactions),
  });
};

test("C01 - todas selecionadas -> checkbox geral marcado", () => {
  const stats = statsFor(EMPTY_PROJECTION_PREFERENCES);
  assert.equal(stats.allSelected, true);
  assert.equal(stats.noneSelected, false);
  assert.equal(stats.indeterminate, false);
});

test("C02 - nenhuma selecionada -> checkbox geral desmarcado", () => {
  const none = applyToggleAll(EMPTY_PROJECTION_PREFERENCES);
  const stats = statsFor(none);
  assert.equal(stats.allSelected, false);
  assert.equal(stats.noneSelected, true);
  assert.equal(stats.indeterminate, false);
});

test("C03 - seleção parcial -> checkbox geral indeterminado", () => {
  const partial = normalizeProjectionPreferences({ excludedTransactionIds: ["income-pf"] });
  const stats = statsFor(partial);
  assert.equal(stats.allSelected, false);
  assert.equal(stats.noneSelected, false);
  assert.equal(stats.indeterminate, true);
});

test("C04 - clique no estado marcado desmarca todas", () => {
  const after = applyToggleAll(EMPTY_PROJECTION_PREFERENCES);
  const stats = statsFor(after);
  assert.equal(stats.noneSelected, true);
});

test("C05 - clique no estado desmarcado marca todas", () => {
  const none = applyToggleAll(EMPTY_PROJECTION_PREFERENCES);
  const after = applyToggleAll(none);
  const stats = statsFor(after);
  assert.equal(stats.allSelected, true);
});

test("C06 - clique no estado indeterminado marca todas", () => {
  const partial = normalizeProjectionPreferences({ excludedTransactionIds: ["income-pf"] });
  const after = applyToggleAll(partial);
  const stats = statsFor(after);
  assert.equal(stats.allSelected, true);
});

test("C07 - desmarcar todas inclui todos os ids/grupos elegíveis nas exclusões", () => {
  const keys = keysFor(EMPTY_PROJECTION_PREFERENCES);
  const none = applyToggleAll(EMPTY_PROJECTION_PREFERENCES);

  const expectedTx = keys
    .filter((key: string) => key.startsWith("transaction:"))
    .map((key: string) => key.slice("transaction:".length))
    .sort();
  const expectedGroups = keys
    .filter((key: string) => !key.startsWith("transaction:"))
    .sort();

  assert.deepEqual([...none.excludedTransactionIds].sort(), expectedTx);
  assert.deepEqual([...none.excludedGroupIds].sort(), expectedGroups);
});

test("C08 - marcar todas remove todos os ids/grupos elegíveis das exclusões", () => {
  const none = applyToggleAll(EMPTY_PROJECTION_PREFERENCES);
  const all = applyToggleAll(none);
  assert.deepEqual(all.excludedTransactionIds, []);
  assert.deepEqual(all.excludedGroupIds, []);
});

test("C09 - busca/filtros visuais não limitam a ação geral", () => {
  const keys = keysFor(EMPTY_PROJECTION_PREFERENCES);
  const none = applyToggleAll(EMPTY_PROJECTION_PREFERENCES);

  const hasIncome = keys.some((key: string) => key === "transaction:income-pf");
  const hasCard = keys.some((key: string) => key === "transaction:card-purchase-pf");
  const hasTransfer = keys.some((key: string) => key === "linked:trf-pf-1");

  assert.equal(hasIncome, true);
  assert.equal(hasCard, true);
  assert.equal(hasTransfer, true);
  assert.equal(none.excludedTransactionIds.includes("income-pf"), true);
  assert.equal(none.excludedTransactionIds.includes("card-purchase-pf"), true);
  assert.equal(none.excludedGroupIds.includes("linked:trf-pf-1"), true);
});

test("C10 - itens fora da área visível também são alterados", () => {
  const none = applyToggleAll(EMPTY_PROJECTION_PREFERENCES);
  assert.equal(none.excludedTransactionIds.includes("income-pf"), true);
  assert.equal(none.excludedTransactionIds.includes("expense-pf"), true);
  assert.equal(none.excludedTransactionIds.includes("card-purchase-pf"), true);
});

test("C11 - marcação individual atualiza estado geral", () => {
  const partial = normalizeProjectionPreferences({ excludedTransactionIds: ["expense-pf"] });
  const stats = statsFor(partial);
  assert.equal(stats.indeterminate, true);
});

test("C12 - controle geral afeta receitas, despesas, cartão, transferências e recorrências", () => {
  const none = applyToggleAll(EMPTY_PROJECTION_PREFERENCES);

  assert.equal(none.excludedTransactionIds.includes("income-pf"), true);
  assert.equal(none.excludedTransactionIds.includes("expense-pf"), true);
  assert.equal(none.excludedTransactionIds.includes("card-purchase-pf"), true);
  assert.equal(none.excludedGroupIds.includes("linked:trf-pf-1"), true);
  assert.equal(none.excludedGroupIds.includes("linked:mov-1"), true);
  assert.equal(none.excludedGroupIds.includes("recurrence:parcelado-1"), true);
});

test("C13 - controle geral respeita exclusões de conta/cartão já existentes", () => {
  const prefs = normalizeProjectionPreferences({
    excludedAccountIds: ["acc-pf"],
    excludedCardIds: ["card-pf"],
  });
  const keys = keysFor(prefs);
  assert.equal(keys.length, 0);

  const after = applyToggleAll(prefs);
  assert.deepEqual(after.excludedTransactionIds, []);
  assert.deepEqual(after.excludedGroupIds, []);
});

test("C14 - marcar todas remove ids órfãos sem erro", () => {
  const withOrphans = normalizeProjectionPreferences({
    excludedTransactionIds: ["income-pf", "tx-orfao"],
    excludedGroupIds: ["linked:trf-pf-1", "group-orfao"],
  });

  assert.doesNotThrow(() => {
    const after = applyToggleAll(withOrphans);
    assert.equal(after.excludedTransactionIds.includes("income-pf"), false);
    assert.equal(after.excludedGroupIds.includes("linked:trf-pf-1"), false);
    assert.equal(after.excludedTransactionIds.includes("tx-orfao"), true);
    assert.equal(after.excludedGroupIds.includes("group-orfao"), true);
  });
});

test("C15 - toggle geral não altera excludedAccountIds nem excludedCardIds", () => {
  const baseline = normalizeProjectionPreferences({
    excludedAccountIds: ["acc-pj"],
    excludedCardIds: ["card-pj"],
  });

  const after = applyToggleAll(baseline);
  assert.deepEqual(after.excludedAccountIds, ["acc-pj"]);
  assert.deepEqual(after.excludedCardIds, ["card-pj"]);
});

test("C16 - checkbox real usa HTMLInputElement.indeterminate e atualiza por efeito", () => {
  const source = modalSource();
  assert.match(source, /transactionsAllRef\s*=\s*useRef<HTMLInputElement \| null>\(null\)/);
  assert.match(source, /transactionsAllRef\.current\.indeterminate = transactionSelectionStats\.indeterminate/);
  assert.match(source, /useEffect\(\(\) => \{/);
});

test("C17 - toggle geral não altera filtros visuais e cálculos da Projeção", () => {
  const source = modalSource();
  const start = source.indexOf("const toggleAllTransactions = () => {");
  const end = source.indexOf("return (", start);
  const block = start >= 0 && end > start ? source.slice(start, end) : "";

  assert.ok(block.length > 0);
  assert.equal(block.includes("setSearch("), false);
  assert.equal(block.includes("setOrigin("), false);
  assert.equal(block.includes("setMovement("), false);

  const app = appSource();
  assert.match(app, /filterTransactionsForProjection\(/);
});

test("C18 - cancelar e fechar no X não disparam salvamento", () => {
  const source = modalSource();
  assert.match(source, /onClick=\{onCancel\}/);
  assert.match(source, /onClick=\{\(\) => \{ void handleApply\(\); \}\}/);
  assert.equal(source.includes("onClick={onApply}"), false);
});

test("C19 - aplicar persiste pelo fluxo Supabase existente", () => {
  const source = appSource();
  assert.match(source, /await upsertProjectionPreferencesRemote\(/);
  assert.match(source, /setProjectionPreferencesByProfile\(\(current\) => \(\{ \.\.\.current, \[profile\]: sanitized \}\)\)/);
  assert.match(source, /profileId: profile/);
});

test("C20 - PF e PJ continuam isolados e padrão visual segue Contas/Cartões", () => {
  const pfKeys = keysForProfile("pf", EMPTY_PROJECTION_PREFERENCES);
  const pjKeys = keysForProfile("pj", EMPTY_PROJECTION_PREFERENCES);
  assert.equal(pfKeys.some((key: string) => key.includes("single-pj") || key.includes("card-pj")), false);
  assert.equal(pjKeys.some((key: string) => key.includes("income-pf") || key.includes("card-purchase-pf")), false);

  const source = modalSource();
  assert.match(source, /Contas", accounts, "excludedAccountIds", "Selecionar todas"/);
  assert.match(source, /Cartões", cards, "excludedCardIds", "Selecionar todos"/);
  assert.match(source, /Lançamentos considerados/);
  assert.match(source, /Selecionar todas/);
  assert.match(source, /className="flex cursor-pointer items-center gap-2 text-xs font-bold text-violet-700 dark:text-violet-300"/);
});
