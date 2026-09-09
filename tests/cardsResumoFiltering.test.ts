import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  getCardsResumoInvoiceMonth,
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

test("total do cartao soma exatamente os lancamentos visiveis", () => {
  const visibleItems = [
    { cardId: "sams-club", value: -36.63 },
    { cardId: "sams-club", value: -46.82 },
  ];
  const summary = summarizeFilteredCardsResumo(
    visibleItems,
    (item) => item.cardId,
    (item) => item.value
  );

  assert.equal(summary.groups.get("sams-club")?.total, 83.45);
  assert.equal(summary.total, 83.45);
  assert.equal(summary.count, 2);
});

test("filtros nao reintroduzem itens nem o total completo da fatura", () => {
  const selected = { month: "2026-08", cardId: "todos", category: "Escala Vendas", tag: "Escala Vendas" };
  const filtered = items.filter((item) => matchesCardsResumoFilters(
    { ...item, searchMatches: true },
    selected
  ));
  const summary = summarizeFilteredCardsResumo(filtered, (item) => item.cardId, (item) => item.value);

  assert.equal(summary.groups.get("nubank")?.total, 100);
  assert.notEqual(summary.groups.get("nubank")?.total, 150);
  assert.equal(summary.groups.has("itau"), false);
});

test("cabecalho do resumo exibe somente o total filtrado, sem estado de fatura", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");
  const grouping = source.slice(
    source.indexOf("const cardsResumoAgrupado = useMemo"),
    source.indexOf("const cardsResumoTotalGeral = useMemo")
  );
  const header = source.slice(
    source.indexOf('<div className="w-[170px] text-right">', source.indexOf("cardsResumoAgrupado.map")),
    source.indexOf('<div className="space-y-2">', source.indexOf("cardsResumoAgrupado.map"))
  );

  assert.match(header, /Total: \{formatarMoeda\(grupo\.total\)\}/);
  assert.doesNotMatch(header, /ATRASADA|Atrasada|EM ABERTO|Em aberto|PAGA|Paga|Venc\./);
  assert.doesNotMatch(grouping, /pagamentosFatura|faturasStatusManual|remaining|dueDate|displayStatus/);
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

test("PDF exibe somente o total filtrado do grupo, sem estado de fatura", () => {
  const source = getCardsResumoPdfSource();

  assert.match(source, /Total: \$\{escapeHtml\(formatarMoeda\(Number\(grupo\.total \?\? 0\)\)\)\}/);
  assert.doesNotMatch(source, /ATRASADA|Atrasada|EM ABERTO|Em aberto|PAGA|Paga|saldo pendente|Venc\./);
});

test("html2pdf usa seletores locais de quebra sem avoid-all", () => {
  const source = getCardsResumoPdfSource();
  const pagebreakConfig = source.match(/pagebreak:\s*\{([\s\S]*?)\n\s*\},/)?.[1] ?? "";

  assert.match(pagebreakConfig, /mode:\s*\["css",\s*"legacy"\]/);
  assert.match(pagebreakConfig, /avoid:\s*\["\.card-group",\s*"\.card-group-header",\s*"tr"/);
  assert.doesNotMatch(pagebreakConfig, /avoid-all/);
});

test("resumo usa a mesma competencia da fatura no dia exato do fechamento", () => {
  const card = { id: "sams-club", diaFechamento: 23, diaVencimento: 3 };

  assert.equal(
    getCardsResumoInvoiceMonth({ transactionDate: "2026-08-22", card }),
    "2026-09"
  );
  assert.equal(
    getCardsResumoInvoiceMonth({ transactionDate: "2026-08-23", card }),
    "2026-10"
  );
  assert.equal(
    getCardsResumoInvoiceMonth({ transactionDate: "2026-08-24", card }),
    "2026-10"
  );
});

test("regressao Sams Club: 26 itens mais quatro do fechamento totalizam a fatura", () => {
  const card = { id: "sams-club", diaFechamento: 23, diaVencimento: 3 };
  const itensResumo = Array.from({ length: 26 }, (_, index) => ({
    id: `resumo-${index}`, cartaoId: card.id, data: "2026-08-25",
    valor: index === 0 ? 1507.78 : 0,
  }));
  const itensDoFechamento = [20, 27, 29.72, 36.96].map((valor, index) => ({
    id: `fechamento-${index}`, cartaoId: card.id, data: "2026-08-23", valor,
  }));
  const outubro = [...itensResumo, ...itensDoFechamento].filter(
    (item) => getCardsResumoInvoiceMonth({ transactionDate: item.data, card }) === "2026-10"
  );
  const result = summarizeFilteredCardsResumo(
    outubro, (item) => item.cartaoId, (item) => item.valor
  );

  assert.equal(result.count, 30);
  assert.equal(Number(result.total.toFixed(2)), 1621.46);
});

test("correcao do resumo nao altera a regra global de fechamento", () => {
  const source = readFileSync(path.join(process.cwd(), "src", "App.tsx"), "utf8");
  const cycleStart = source.indexOf("function getCardCycleMonthFromDate(");
  const cycleEnd = source.indexOf("function makeCardCycleDate", cycleStart);
  const cycleSource = source.slice(cycleStart, cycleEnd);

  assert.match(cycleSource, /if \(dia > fechamentoEfetivo\)/);
  assert.match(source, /getCardsResumoInvoiceMonth\(\{/);
});
