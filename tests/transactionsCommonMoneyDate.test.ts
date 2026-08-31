import assert from "node:assert/strict";
import test from "node:test";

const {
  addMonthsLikeUi,
  parsePositiveAmount,
  splitMoneyInCents,
} = require("../api/_lib/transactionsCommon");

test("money policy preserves previously accepted numeric formats", () => {
  assert.equal(parsePositiveAmount(300), 300);
  assert.equal(parsePositiveAmount(10.25), 10.25);
  assert.equal(parsePositiveAmount("10.25"), 10.25);
  assert.equal(parsePositiveAmount(" 10.25 "), 10.25);
  assert.equal(parsePositiveAmount("1e2"), 100);
  assert.equal(parsePositiveAmount("+10"), 10);
  assert.equal(parsePositiveAmount(".50"), 0.5);
});

test("money policy rejects invalid and over-precision values", () => {
  for (const value of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, 1.001, "1.001", "1,00"] as any[]) {
    assert.throws(() => parsePositiveAmount(value));
  }
});

test("installment allocation keeps exact cents and puts residue in last installment", () => {
  assert.deepEqual(splitMoneyInCents(300, 3), [100, 100, 100]);
  assert.deepEqual(splitMoneyInCents(100, 3), [33.33, 33.33, 33.34]);
  assert.deepEqual(splitMoneyInCents(10, 6), [1.66, 1.66, 1.66, 1.66, 1.66, 1.7]);
  assert.equal(
    splitMoneyInCents(10, 6).reduce((sum: number, value: number) => sum + Math.round(value * 100), 0),
    1000
  );
});

test("monthly calendar keeps base day and clamps independently", () => {
  assert.equal(addMonthsLikeUi("2025-01-31", 1), "2025-02-28");
  assert.equal(addMonthsLikeUi("2025-01-31", 2), "2025-03-31");
  assert.equal(addMonthsLikeUi("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsLikeUi("2026-11-30", 2), "2027-01-30");
});
