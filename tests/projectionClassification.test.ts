import assert from "node:assert/strict";
import test from "node:test";
import { computeProjection12Months } from "../src/app/transactions/projection";

const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const date = `${month}-10`;
const accountId = "account-pj";
const cardId = "card-pj";
const profiles = [{ id: accountId, perfilConta: "PJ" }] as any;
const creditCards = [{ id: cardId, perfil: "PJ" }] as any;
const assertMoney = (actual: number, expected: number) =>
  assert.equal(Math.round(actual * 100), Math.round(expected * 100));

const expense = (id: string, value: number, fields: Record<string, unknown>) => ({
  id,
  tipo: "despesa",
  valor: -value,
  data: date,
  contaId: accountId,
  ...fields,
});

const project = (transactions: any[]) =>
  computeProjection12Months({
    transacoes: transactions,
    getMesAnoExtenso: (value) => value,
    saldoInicialBase: 50_000,
    perfilView: "pj",
    profiles,
    creditCards,
    selectedProfileIds: [accountId],
    selectedCreditCardIds: [cardId],
  })[0];

test("recorrente mensal fixo entra em Despesas Fixas", () => {
  const row = project([expense("monthly-fixed", 100, { payload: { spending_type: "fixed", isRecorrente: true }, recorrenciaId: "fixed-series" })]);
  assertMoney(row.fixas, 100);
  assertMoney(row.variaveis, 0);
});

test("recorrente mensal variavel entra em Variaveis", () => {
  const row = project([expense("monthly-variable", 200, { spendingType: "variable", isRecorrente: true, recorrenciaId: "variable-series" })]);
  assertMoney(row.fixas, 0);
  assertMoney(row.variaveis, 200);
});

test("avulso fixo entra em Despesas Fixas", () => {
  const row = project([expense("single-fixed", 300, { tipo_gasto: "fixo" })]);
  assertMoney(row.fixas, 300);
  assertMoney(row.variaveis, 0);
});

test("avulso variavel entra em Variaveis", () => {
  const row = project([expense("single-variable", 400, { payload: { tipoGasto: "Variável" } })]);
  assertMoney(row.fixas, 0);
  assertMoney(row.variaveis, 400);
});

test("normaliza aliases no objeto e payload em portugues e ingles", () => {
  const cases = [
    { fields: { tipoGasto: "fixo" }, bucket: "fixas" },
    { fields: { tipo_gasto: "fixed" }, bucket: "fixas" },
    { fields: { spendingType: "FIXO" }, bucket: "fixas" },
    { fields: { spending_type: "fixed" }, bucket: "fixas" },
    { fields: { payload: { tipoGasto: "variável" } }, bucket: "variaveis" },
    { fields: { payload: { tipo_gasto: "variavel" } }, bucket: "variaveis" },
    { fields: { payload: { spendingType: "variable" } }, bucket: "variaveis" },
    { fields: { payload: { spending_type: "normal" } }, bucket: "variaveis" },
    { fields: { tipoGasto: "", payload: { spending_type: "comum" } }, bucket: "variaveis" },
  ] as const;

  cases.forEach(({ fields, bucket }, index) => {
    const row = project([expense(`alias-${index}`, 10, fields)]);
    assertMoney(row[bucket], 10);
  });
});

test("movimento PF/PJ recorrente respeita exclusivamente o tipo salvo", () => {
  const movement = { isRecorrente: true, recorrenciaId: "movement-series", payload: { movementKind: "pf_pj" } };
  const fixed = project([expense("movement-fixed", 50, { ...movement, tipoGasto: "fixo" })]);
  const variable = project([expense("movement-variable", 60, { ...movement, tipoGasto: "variável" })]);

  assertMoney(fixed.fixas, 50);
  assertMoney(fixed.variaveis, 0);
  assertMoney(variable.fixas, 0);
  assertMoney(variable.variaveis, 60);
});

test("tipo de gasto valido prevalece sobre recorrencia", () => {
  const row = project([
    expense("withdrawal", 3_690.24, { tipoGasto: "Variável" }),
    expense("corrected-fixed-series", 5_800, { payload: { tipoGasto: "fixo", isRecorrente: true, recorrenciaId: "corrected-series" } }),
  ]);
  assertMoney(row.fixas, 5_800);
  assertMoney(row.variaveis, 3_690.24);
});

test("cartoes continuam nas variaveis e reclassificacao preserva total e saldo", () => {
  const common = [
    expense("other-fixed", 14_652.06, { tipoGasto: "fixo" }),
    expense("withdrawal", 3_690.24, { tipoGasto: "Variável" }),
    { id: "card", tipo: "cartao_credito", valor: -4_531.07, data: date, faturaMes: month, cartaoId: cardId },
  ];
  const before = project([...common, expense("inconsistent-series", 5_800, { tipoGasto: "Variável", isRecorrente: true, recorrenciaId: "series" })]);
  const after = project([...common, expense("corrected-series", 5_800, { tipoGasto: "fixo", isRecorrente: true, recorrenciaId: "series" })]);

  assertMoney(after.fixas, 20_452.06);
  assertMoney(after.variaveis, 8_221.31);
  assertMoney(before.fixas + before.variaveis, after.fixas + after.variaveis);
  assertMoney(before.saldo, after.saldo);
});

test("registro legado sem tipo valido nao presume que recorrencia e fixa", () => {
  const row = project([expense("legacy", 500, { isRecorrente: true, recorrenciaId: "legacy-series" })]);
  assertMoney(row.fixas, 0);
  assertMoney(row.variaveis, 0);
});
