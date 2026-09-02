import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { computeProjection12Months } from "../src/app/transactions/projection";
import {
  getProjectionTransactionPeriod,
  isProjectionPeriodWithinRange,
} from "../src/app/transactions/projectionPeriod";
import { EMPTY_PROJECTION_PREFERENCES } from "../src/app/transactions/projectionPreferences";
import { buildProjectionSelectionKeysForProfile } from "../src/components/projection/projectionSelection";

const pad2 = (value: number) => String(value).padStart(2, "0");
const periodAt = (offset: number) => {
  const now = new Date();
  const date = new Date(now.getFullYear(), now.getMonth() + offset, 1, 12, 0, 0, 0);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
};
const dateAt = (offset: number, day = 10) => `${periodAt(offset)}-${pad2(day)}`;

const profile = { id: "acc-pf", perfilConta: "PF", name: "Conta PF" };
const card = {
  id: "card-pf",
  perfil: "PF",
  name: "Cartão PF",
  diaFechamento: 20,
  diaVencimento: 10,
};

test("tabela expõe exatamente a janela mensal usada pelo modal", () => {
  const rows = computeProjection12Months({
    transacoes: [],
    getMesAnoExtenso: (period) => period,
  });

  assert.equal(rows.length, 12);
  assert.equal(rows[0].period, periodAt(0));
  assert.equal(rows[11].period, periodAt(11));
});

test("competência do cartão respeita faturaMes mesmo quando a compra é antiga", () => {
  const transaction = {
    id: "old-card-installment",
    tipo: "cartao_credito",
    cartaoId: card.id,
    data: dateAt(-2),
    faturaMes: periodAt(0),
  };

  assert.equal(getProjectionTransactionPeriod(transaction, [card]), periodAt(0));
  assert.equal(
    isProjectionPeriodWithinRange(
      getProjectionTransactionPeriod(transaction, [card]),
      periodAt(0),
      periodAt(11)
    ),
    true
  );
});

test("seleção geral ignora histórico e usa apenas grupos presentes nos 12 meses projetados", () => {
  const transactions = [
    {
      id: "old-single",
      tipo: "despesa",
      contaId: profile.id,
      data: dateAt(-2),
    },
    {
      id: "series-old",
      tipo: "despesa",
      contaId: profile.id,
      data: dateAt(-2),
      recorrenciaId: "monthly-series",
    },
    {
      id: "series-current",
      tipo: "despesa",
      contaId: profile.id,
      data: dateAt(0),
      recorrenciaId: "monthly-series",
    },
    {
      id: "series-next",
      tipo: "despesa",
      contaId: profile.id,
      data: dateAt(1),
      recorrenciaId: "monthly-series",
    },
    {
      id: "current-single",
      tipo: "receita",
      contaId: profile.id,
      data: dateAt(0),
    },
    {
      id: "old-card-installment",
      tipo: "cartao_credito",
      cartaoId: card.id,
      data: dateAt(-2),
      faturaMes: periodAt(0),
      installmentGroupId: "card-installments",
    },
    {
      id: "outside-horizon",
      tipo: "despesa",
      contaId: profile.id,
      data: dateAt(12),
    },
  ] as any[];

  const keys = buildProjectionSelectionKeysForProfile({
    transactions,
    profile: "pf",
    profiles: [profile],
    creditCards: [card],
    preferences: EMPTY_PROJECTION_PREFERENCES,
    projectionPeriodStart: periodAt(0),
    projectionPeriodEnd: periodAt(11),
  }).sort();

  assert.deepEqual(keys, [
    "installment:card-installments",
    "recurrence:monthly-series",
    "transaction:current-single",
  ]);
  assert.equal(keys.includes("transaction:old-single"), false);
  assert.equal(keys.includes("transaction:outside-horizon"), false);
});

test("modal mostra competência projetada e não a data histórica bruta", () => {
  const modal = readFileSync(
    path.join(process.cwd(), "src", "components", "projection", "ProjectionConfigModal.tsx"),
    "utf8"
  );
  const tab = readFileSync(
    path.join(process.cwd(), "src", "components", "tabs", "ProjecaoTab.tsx"),
    "utf8"
  );

  assert.match(modal, /formatProjectionPeriod\(entry\.period\)/);
  assert.doesNotMatch(modal, /formatarData\(tx\?\.data\)/);
  assert.match(tab, /projection12Months\[0\]\?\.period/);
  assert.match(tab, /projectionPeriodStart=\{projectionPeriodStart\}/);
  assert.match(tab, /projectionPeriodEnd=\{projectionPeriodEnd\}/);
});
