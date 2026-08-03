import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  matchesCardsResumoFilters,
  summarizeFilteredCardsResumo,
} from "../src/app/credit/cardsResumoFiltering";

type Item = {
  id: string;
  cardId: string;
  category: string;
  tag: string;
  month: string;
  value: number;
};

const items: Item[] = [
  { id: "match", cardId: "nubank", category: "Escala Vendas", tag: "Escala Vendas", month: "2026-08", value: -100 },
  { id: "wrong-tag", cardId: "nubank", category: "Escala Vendas", tag: "Assinatura", month: "2026-08", value: -30 },
  { id: "wrong-category", cardId: "nubank", category: "Software", tag: "Escala Vendas", month: "2026-08", value: -20 },
  { id: "other-card", cardId: "itau", category: "Software", tag: "Assinatura", month: "2026-08", value: -50 },
];

test("filtra cada lancamento e combina categoria e tag com AND", () => {
  const selected = { month: "2026-08", cardId: "todos", category: "Escala Vendas", tag: "Escala Vendas" };
  const filtered = items.filter((item) => matchesCardsResumoFilters(
    { ...item, searchMatches: true },
    selected
  ));

  assert.deepEqual(filtered.map((item) => item.id), ["match"]);
});

test("grupos, totais e contador usam somente os itens filtrados", () => {
  const selected = { month: "2026-08", cardId: "todos", category: "Escala Vendas", tag: "Escala Vendas" };
  const filtered = items.filter((item) => matchesCardsResumoFilters(
    { ...item, searchMatches: true },
    selected
  ));
  const summary = summarizeFilteredCardsResumo(filtered, (item) => item.cardId, (item) => item.value);

  assert.deepEqual([...summary.groups.keys()], ["nubank"]);
  assert.deepEqual(summary.groups.get("nubank")?.items.map((item) => item.id), ["match"]);
  assert.equal(summary.groups.has("itau"), false);
  assert.equal(summary.groups.get("nubank")?.total, 100);
  assert.equal(summary.total, 100);
  assert.equal(summary.count, 1);
  assert.equal(summary.groups.get("nubank")?.items[0], items[0]);
});

const getCardsResumoPdfSource = () =>
  readFileSync(
    path.join(process.cwd(), "src", "app", "credit", "reports", "cardsResumoPdfReport.ts"),
    "utf8"
  );

test("PDF mantem o cabecalho junto do primeiro lancamento", () => {
  const source = getCardsResumoPdfSource();
  const headerCss = source.match(/\.card-group-header\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(headerCss, /break-after:\s*avoid-page/);
  assert.match(headerCss, /page-break-after:\s*avoid/);
});

test("PDF nao quebra uma linha de lancamento entre paginas", () => {
  const source = getCardsResumoPdfSource();
  const rowCss = source.match(/\ntr\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(rowCss, /break-inside:\s*avoid-page/);
  assert.match(rowCss, /page-break-inside:\s*avoid/);
});

test("html2pdf usa seletores locais de quebra sem avoid-all", () => {
  const source = getCardsResumoPdfSource();
  const pagebreakConfig = source.match(/pagebreak:\s*\{([\s\S]*?)\n\s*\},/)?.[1] ?? "";

  assert.match(pagebreakConfig, /mode:\s*\["css",\s*"legacy"\]/);
  assert.match(pagebreakConfig, /avoid:\s*\["\.card-group",\s*"\.card-group-header",\s*"tr"/);
  assert.doesNotMatch(pagebreakConfig, /avoid-all/);
});
