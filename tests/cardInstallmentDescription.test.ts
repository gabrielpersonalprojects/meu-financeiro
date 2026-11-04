import assert from "node:assert/strict";
import test from "node:test";

import { removeInstallmentSuffixFromDescription } from "../src/app/credit/reports/cardInstallmentDescription";

test("remove o sufixo atual de parcela entre parênteses", () => {
  assert.equal(
    removeInstallmentSuffixFromDescription("Notebook (2/12)"),
    "Notebook",
  );
});

test("remove sufixos legados com barra", () => {
  assert.equal(
    removeInstallmentSuffixFromDescription("Shopee *Transflux - Parcela 1/3"),
    "Shopee *Transflux",
  );
  assert.equal(
    removeInstallmentSuffixFromDescription("Mercadolivre*Pontodobo – parcela 4/5"),
    "Mercadolivre*Pontodobo",
  );
});

test("remove sufixos legados no formato parcela N de N", () => {
  assert.equal(
    removeInstallmentSuffixFromDescription("Curso — Parcela 3 de 10"),
    "Curso",
  );
});

test("preserva descrições comuns", () => {
  assert.equal(
    removeInstallmentSuffixFromDescription("Curso Parcela Premium"),
    "Curso Parcela Premium",
  );
  assert.equal(removeInstallmentSuffixFromDescription("Mercado"), "Mercado");
});
