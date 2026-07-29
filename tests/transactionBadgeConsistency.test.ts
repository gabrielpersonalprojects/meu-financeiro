import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInstallmentPlanningFields,
  normalizeSpendingType,
} from "../api/_lib/transactionsCommon";
import { isVariableTransactionSpendingType } from "../src/app/transactions/badgeLogic";

test("despesa comum da API usa metadado canônico de variável", () => {
  assert.equal(normalizeSpendingType(undefined, "despesa"), "variável");
  assert.equal(normalizeSpendingType("normal", "despesa"), "variável");
  assert.equal(normalizeSpendingType("variavel", "despesa"), "variável");
  assert.equal(normalizeSpendingType("variável", "despesa"), "variável");
});

test("receita avulsa continua sem tipo de gasto artificial", () => {
  assert.equal(normalizeSpendingType(undefined, "receita"), "");
});

test("frontend reconhece registros legados normal como variável", () => {
  assert.equal(isVariableTransactionSpendingType("normal"), true);
  assert.equal(isVariableTransactionSpendingType("Variável"), true);
  assert.equal(isVariableTransactionSpendingType("comum"), true);
  assert.equal(isVariableTransactionSpendingType("fixo"), false);
});

test("parcelamento grava número atual e total de parcelas", () => {
  assert.deepEqual(
    buildInstallmentPlanningFields("despesa", 2, 6, "rec_123"),
    {
      tipoGasto: "fixo",
      recorrenciaId: "rec_123",
      isRecorrente: false,
      parcelaAtual: 2,
      totalParcelas: 6,
    }
  );
});
