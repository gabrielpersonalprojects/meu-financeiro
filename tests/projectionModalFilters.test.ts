import assert from "node:assert/strict";
import test from "node:test";
import {
  getProjectionMovementDirection,
  matchesProjectionMovementFilter,
  matchesProjectionOriginFilter,
  matchesProjectionSearch,
  type ProjectionMovementFilter,
  type ProjectionOriginFilter,
  type ProjectionOriginType,
} from "../src/components/projection/projectionModalFilters";

type Entry = {
  id: string;
  originType: ProjectionOriginType;
  originLabel: string;
  transaction: any;
};

const entries: Entry[] = [
  {
    id: "income-common",
    originType: "contas",
    originLabel: "Conta PF",
    transaction: {
      id: "income-common",
      tipo: "receita",
      valor: 100,
      descricao: "Salario",
      categoria: "Receita",
      contaId: "pf-1",
      data: "2026-08-10",
    },
  },
  {
    id: "expense-common",
    originType: "contas",
    originLabel: "Conta PF",
    transaction: {
      id: "expense-common",
      tipo: "despesa",
      valor: -40,
      descricao: "Mercado",
      categoria: "Despesa",
      contaId: "pf-1",
      data: "2026-08-11",
    },
  },
  {
    id: "card-purchase",
    originType: "cartoes",
    originLabel: "Cartao PF",
    transaction: {
      id: "card-purchase",
      tipo: "cartao_credito",
      valor: -59.9,
      descricao: "CapCut",
      categoria: "Assinaturas",
      cartaoId: "card-1",
      data: "2026-08-12",
    },
  },
  {
    id: "transfer-out",
    originType: "contas",
    originLabel: "Conta Origem",
    transaction: {
      id: "transfer-out",
      tipo: "transferencia",
      valor: -200,
      descricao: "Transferencia interna",
      contaId: "acc-a",
      contaOrigemId: "acc-a",
      contaDestinoId: "acc-b",
      transferId: "trf-1",
      data: "2026-08-13",
    },
  },
  {
    id: "transfer-in",
    originType: "contas",
    originLabel: "Conta Destino",
    transaction: {
      id: "transfer-in",
      tipo: "transferencia",
      valor: 200,
      descricao: "Transferencia interna",
      contaId: "acc-b",
      contaOrigemId: "acc-a",
      contaDestinoId: "acc-b",
      transferId: "trf-1",
      data: "2026-08-13",
    },
  },
  {
    id: "pfpj-out",
    originType: "contas",
    originLabel: "Conta PJ",
    transaction: {
      id: "pfpj-out",
      tipo: "despesa",
      valor: -300,
      descricao: "Transferencia PJ para PF",
      contaId: "pj-1",
      payload: {
        movementKind: "pf_pj",
        linkedMovementId: "mov-1",
        linkedMovementDirection: "saida",
      },
      data: "2026-08-14",
    },
  },
  {
    id: "pfpj-in",
    originType: "contas",
    originLabel: "Conta PF",
    transaction: {
      id: "pfpj-in",
      tipo: "receita",
      valor: 300,
      descricao: "Transferencia PJ para PF",
      contaId: "pf-1",
      payload: {
        movementKind: "pf_pj",
        linkedMovementId: "mov-1",
        linkedMovementDirection: "entrada",
      },
      data: "2026-08-14",
    },
  },
];

const runFilters = (params: {
  origin: ProjectionOriginFilter;
  movement: ProjectionMovementFilter;
  search?: string;
}) => {
  const search = params.search ?? "";
  return entries
    .filter((entry) => matchesProjectionOriginFilter(params.origin, entry.originType))
    .filter((entry) =>
      matchesProjectionMovementFilter(
        params.movement,
        getProjectionMovementDirection(entry.transaction)
      )
    )
    .filter((entry) =>
      matchesProjectionSearch(search, [
        entry.transaction.descricao,
        entry.transaction.categoria,
        entry.transaction.tag,
        entry.originLabel,
      ])
    )
    .map((entry) => entry.id);
};

test("classifica direcao real de receitas, despesas, cartoes e transferencias", () => {
  const byId = Object.fromEntries(
    entries.map((entry) => [entry.id, getProjectionMovementDirection(entry.transaction)])
  );

  assert.equal(byId["income-common"], "entrada");
  assert.equal(byId["expense-common"], "saida");
  assert.equal(byId["card-purchase"], "saida");
  assert.equal(byId["transfer-out"], "saida");
  assert.equal(byId["transfer-in"], "entrada");
  assert.equal(byId["pfpj-out"], "saida");
  assert.equal(byId["pfpj-in"], "entrada");
});

test("combina origem e movimentacao sem alterar classificacao existente", () => {
  assert.deepEqual(runFilters({ origin: "todos", movement: "todos" }), [
    "income-common",
    "expense-common",
    "card-purchase",
    "transfer-out",
    "transfer-in",
    "pfpj-out",
    "pfpj-in",
  ]);
  assert.deepEqual(runFilters({ origin: "contas", movement: "todos" }), [
    "income-common",
    "expense-common",
    "transfer-out",
    "transfer-in",
    "pfpj-out",
    "pfpj-in",
  ]);
  assert.deepEqual(runFilters({ origin: "cartoes", movement: "todos" }), [
    "card-purchase",
  ]);
  assert.deepEqual(runFilters({ origin: "todos", movement: "entradas" }), [
    "income-common",
    "transfer-in",
    "pfpj-in",
  ]);
  assert.deepEqual(runFilters({ origin: "todos", movement: "saidas" }), [
    "expense-common",
    "card-purchase",
    "transfer-out",
    "pfpj-out",
  ]);
  assert.deepEqual(runFilters({ origin: "contas", movement: "entradas" }), [
    "income-common",
    "transfer-in",
    "pfpj-in",
  ]);
  assert.deepEqual(runFilters({ origin: "contas", movement: "saidas" }), [
    "expense-common",
    "transfer-out",
    "pfpj-out",
  ]);
  assert.deepEqual(runFilters({ origin: "cartoes", movement: "saidas" }), [
    "card-purchase",
  ]);
  assert.deepEqual(runFilters({ origin: "cartoes", movement: "entradas" }), []);
});

test("busca funciona em conjunto com origem e movimentacao", () => {
  assert.deepEqual(
    runFilters({ origin: "todos", movement: "entradas", search: "salario" }),
    ["income-common"]
  );
  assert.deepEqual(
    runFilters({ origin: "contas", movement: "saidas", search: "mercado" }),
    ["expense-common"]
  );
  assert.deepEqual(
    runFilters({ origin: "cartoes", movement: "saidas", search: "capcut" }),
    ["card-purchase"]
  );
  assert.deepEqual(
    runFilters({ origin: "contas", movement: "entradas", search: "conta destino" }),
    ["transfer-in"]
  );
});
