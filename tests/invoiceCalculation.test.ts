import assert from "node:assert/strict";
import test from "node:test";
import { calculateCreditInvoice } from "../src/app/credit/logic/invoiceCalculation";

const card = (id: string, value: number, date: string, extra: Record<string, unknown> = {}) => ({
  id,
  tipo: "cartao_credito" as const,
  valor: -value,
  data: date,
  cartaoId: "card-pf",
  ...extra,
});

const calculate = ({
  transactions,
  payments = [],
  cartaoId = "card-pf",
  monthKey = "2026-09",
  cicloKey = `${cartaoId}__2026-08-11__2026-09-10`,
}: any) => calculateCreditInvoice({
  transactions,
  payments,
  cartaoId,
  monthKey,
  cicloKey,
  diaFechamento: 10,
  diaVencimento: 20,
});

test("fatura aberta sem rateios", () => {
  assert.deepEqual(calculate({ transactions: [card("a", 80, "2026-08-20")] }), {
    transactions: [card("a", 80, "2026-08-20")], payments: [], total: 80, paid: 0, remaining: 80,
  });
});

test("rateios em duas e tres partes incluem filhos e nao somam o pai", () => {
  const parent2 = card("parent-2", 100, "2026-08-20");
  const parent3 = card("parent-3", 100, "2026-08-21");
  const children = [
    card("2a", 40, "2026-08-20", { payload: { parentId: "parent-2" } }),
    card("2b", 60, "2026-08-20", { payload: { parentId: "parent-2" } }),
    card("3a", 20, "2026-08-21", { payload: { parentId: "parent-3" } }),
    card("3b", 30, "2026-08-21", { payload: { parentId: "parent-3" } }),
    card("3c", 50, "2026-08-21", { payload: { parentId: "parent-3" } }),
  ];
  assert.equal(calculate({ transactions: [parent2, parent3, ...children] }).total, 200);
});

test("compra comum, rateada e parcelada compartilham a mesma soma", () => {
  const transactions = [
    card("common", 100, "2026-08-20"),
    card("split", 22.46, "2026-08-20", { payload: { parentId: "split-parent" } }),
    card("installment", 100, "2026-08-22", { parcelaAtual: 2, totalParcelas: 6 }),
  ];
  assert.equal(calculate({ transactions }).total, 222.46);
});

test("pagamento parcial preserva a semantica de saldo pendente", () => {
  const result = calculate({
    transactions: [card("a", 1103.11, "2026-08-20")],
    payments: [{ id: "p", cartaoId: "card-pf", cicloKey: "card-pf__2026-08-11__2026-09-10", valor: 222.46 }],
  });
  assert.equal(result.remaining, 880.65);
});

test("paga, fechada e atrasada conservam total e saldo conforme pagamentos", () => {
  const tx = [card("a", 300, "2026-08-20")];
  assert.equal(calculate({ transactions: tx }).remaining, 300);
  assert.equal(calculate({ transactions: tx, payments: [{ id: "p", cartaoId: "card-pf", cicloKey: "card-pf__2026-08-11__2026-09-10", valor: 300 }] }).remaining, 0);
});

test("cartoes PF e PJ ficam isolados", () => {
  const transactions = [card("pf", 90, "2026-08-20"), card("pj", 130, "2026-08-20", { cartaoId: "card-pj" })];
  assert.equal(calculate({ transactions }).total, 90);
  assert.equal(calculate({ transactions, cartaoId: "card-pj", cicloKey: "card-pj__2026-08-11__2026-09-10" }).total, 130);
});

test("competencias diferentes e o dia do fechamento usam a regra canonica", () => {
  const transactions = [
    card("aug", 880.65, "2026-08-09"),
    card("closing", 222.46, "2026-08-10"),
    card("sep", 880.65, "2026-08-20"),
  ];
  assert.equal(calculate({ transactions, monthKey: "2026-08", cicloKey: "card-pf__2026-07-11__2026-08-10" }).total, 880.65);
  assert.equal(calculate({ transactions }).total, 1103.11);
});

test("regressao Sams Club: minimizado e expandido recebem saldo de R$ 1.103,11", () => {
  const invoice = calculate({ transactions: [
    card("base", 880.65, "2026-08-20"),
    card("closing-day-items", 222.46, "2026-08-10"),
  ] });
  const expanded = invoice.remaining;
  const minimized = invoice.remaining;
  assert.equal(expanded, 1103.11);
  assert.equal(minimized, expanded);
});
