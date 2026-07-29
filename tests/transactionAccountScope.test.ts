import test from "node:test";
import assert from "node:assert/strict";
import {
  getPfPjLegAccountIds,
  isPfPjMovementTransaction,
} from "../src/app/transactions/transactionAccountScope";

const basePayload = {
  movementKind: "pf_pj",
  linkedMovementId: "mov_123",
  originAccountId: "nu-pf",
  destinationAccountId: "itau-pj",
};

test("movimento PF/PJ de saída pertence somente à conta de origem", () => {
  const ids = getPfPjLegAccountIds({
    tipo: "despesa",
    contaId: "nu-pf",
    contaOrigemId: "nu-pf",
    contaDestinoId: "itau-pj",
    payload: { ...basePayload, linkedMovementDirection: "saida" },
  });

  assert.deepEqual(ids, ["nu-pf"]);
  assert.equal(ids.includes("itau-pj"), false);
});

test("movimento PF/PJ de entrada pertence somente à conta de destino", () => {
  const ids = getPfPjLegAccountIds({
    tipo: "receita",
    contaId: "itau-pj",
    contaOrigemId: "nu-pf",
    contaDestinoId: "itau-pj",
    payload: { ...basePayload, linkedMovementDirection: "entrada" },
  });

  assert.deepEqual(ids, ["itau-pj"]);
  assert.equal(ids.includes("nu-pf"), false);
});

test("reconhece movimento PF/PJ por metadados em snake_case", () => {
  assert.equal(
    isPfPjMovementTransaction({
      tipo: "receita",
      payload: {
        movement_kind: "pf_pj",
        linked_movement_id: "mov_456",
        linked_movement_direction: "entrada",
      },
    }),
    true
  );
});

test("fallback por linkedMovementId e direção não mistura contraparte", () => {
  const transaction = {
    tipo: "despesa",
    conta_id: "origem",
    conta_origem_id: "origem",
    conta_destino_id: "destino",
    payload: {
      linked_movement_id: "mov_789",
      linked_movement_direction: "saida",
    },
  };

  assert.equal(isPfPjMovementTransaction(transaction), true);
  assert.deepEqual(getPfPjLegAccountIds(transaction), ["origem"]);
});
