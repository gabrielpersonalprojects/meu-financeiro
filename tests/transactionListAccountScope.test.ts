import test from "node:test";
import assert from "node:assert/strict";

import {
  getTransactionAccountScopeIds,
} from "../src/app/transactions/transactionAccountScope";

test("lista PF/PJ: saída pertence somente à conta de origem", () => {
  const transaction = {
    tipo: "despesa",
    contaId: "origem-pf",
    contaOrigemId: "origem-pf",
    contaDestinoId: "destino-pj",
    payload: {
      movement_kind: "pf_pj",
      linked_movement_direction: "saida",
      contaId: "origem-pf",
      contaOrigemId: "origem-pf",
      contaDestinoId: "destino-pj",
    },
  };

  const accountIds = getTransactionAccountScopeIds(transaction);

  assert.deepEqual(accountIds, ["origem-pf"]);
  assert.equal(accountIds.includes("destino-pj"), false);
});

test("lista PF/PJ: entrada pertence somente à conta de destino", () => {
  const transaction = {
    tipo: "receita",
    contaId: "destino-pj",
    contaOrigemId: "origem-pf",
    contaDestinoId: "destino-pj",
    payload: {
      movementKind: "pf_pj",
      linkedMovementDirection: "entrada",
      contaId: "destino-pj",
      contaOrigemId: "origem-pf",
      contaDestinoId: "destino-pj",
    },
  };

  const accountIds = getTransactionAccountScopeIds(transaction);

  assert.deepEqual(accountIds, ["destino-pj"]);
  assert.equal(accountIds.includes("origem-pf"), false);
});

test("lista de transferência comum continua relacionada às duas contas", () => {
  const transaction = {
    tipo: "transferencia",
    contaOrigemId: "conta-a",
    contaDestinoId: "conta-b",
  };

  const accountIds = getTransactionAccountScopeIds(transaction);

  assert.equal(accountIds.includes("conta-a"), true);
  assert.equal(accountIds.includes("conta-b"), true);
});

test("lista de lançamento comum usa a própria conta", () => {
  const transaction = {
    tipo: "despesa",
    contaId: "conta-c",
  };

  assert.deepEqual(getTransactionAccountScopeIds(transaction), ["conta-c"]);
});
