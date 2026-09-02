import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  sortCardsByInvoicePriority,
  type CardInvoicePriorityInfo,
} from "../src/app/credit/logic/cardListOrdering";

type TestCard = {
  id: string;
  emissor: string;
  updatedAt: string;
  is_active?: boolean;
  priority: CardInvoicePriorityInfo;
};

const card = (
  id: string,
  rank: 0 | 1 | 2,
  updatedAt: string,
  dueTime = 0,
  saldo = 0
): TestCard => ({
  id,
  emissor: id,
  updatedAt,
  priority: { rank, dueTime, saldo },
});

const sort = (cards: TestCard[]) =>
  sortCardsByInvoicePriority(cards, (item) => item.priority);

test("ordena primeiro atrasados, depois fechados e por ultimo abertos", () => {
  const result = sort([
    card("aberto", 2, "2026-09-02T12:00:00.000Z"),
    card("fechado", 1, "2026-09-01T12:00:00.000Z"),
    card("atrasado", 0, "2026-08-01T12:00:00.000Z"),
  ]);

  assert.deepEqual(result.map((item) => item.id), ["atrasado", "fechado", "aberto"]);
});

test("cartao mexido mais recentemente sobe dentro do mesmo status", () => {
  const result = sort([
    card("atrasado-antigo", 0, "2026-09-01T10:00:00.000Z"),
    card("atrasado-mexido", 0, "2026-09-02T10:00:00.000Z"),
    card("fechado-antigo", 1, "2026-09-01T10:00:00.000Z"),
    card("fechado-mexido", 1, "2026-09-02T10:00:00.000Z"),
    card("aberto-antigo", 2, "2026-09-01T10:00:00.000Z"),
    card("aberto-mexido", 2, "2026-09-02T10:00:00.000Z"),
  ]);

  assert.deepEqual(result.map((item) => item.id), [
    "atrasado-mexido",
    "atrasado-antigo",
    "fechado-mexido",
    "fechado-antigo",
    "aberto-mexido",
    "aberto-antigo",
  ]);
});

test("atividade recente nunca ultrapassa uma situacao mais prioritaria", () => {
  const result = sort([
    card("aberto-agora", 2, "2026-09-02T12:00:00.000Z"),
    card("fechado-antigo", 1, "2025-01-01T12:00:00.000Z"),
    card("atrasado-antigo", 0, "2024-01-01T12:00:00.000Z"),
  ]);

  assert.deepEqual(result.map((item) => item.id), [
    "atrasado-antigo",
    "fechado-antigo",
    "aberto-agora",
  ]);
});

test("nao altera o array original", () => {
  const original = [
    card("aberto", 2, "2026-09-02T12:00:00.000Z"),
    card("atrasado", 0, "2026-09-01T12:00:00.000Z"),
  ];

  sort(original);
  assert.deepEqual(original.map((item) => item.id), ["aberto", "atrasado"]);
});

test("bloco Novo cartao continua antes da lista ordenada", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");
  const novoCartaoIndex = source.indexOf("Novo cartão");
  const listaIndex = source.indexOf("{paginatedCreditCards.map", novoCartaoIndex);

  assert.ok(novoCartaoIndex >= 0);
  assert.ok(listaIndex > novoCartaoIndex);
});
