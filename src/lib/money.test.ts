// Smoke checks for money math (run with `node --test`).
// We avoid pulling in vitest/jest for MVP — assert via node:test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateClaimerTotal, dollarsToCents, formatCents } from "./money";

test("zero subtotal short-circuits to 0", () => {
  assert.equal(calculateClaimerTotal(0, 0, 500, 200), 0);
});

test("proportional tax + tip", () => {
  // bill: subtotal 10000, tax 800, tip 2000, total 12800
  // claimer subtotal 2500 (25%) → tax 200, tip 500, total 3200
  assert.equal(
    calculateClaimerTotal(2500, 10000, 800, 2000),
    2500 + 200 + 500
  );
});

test("rounding stays to nearest cent", () => {
  // 333/1000 = 0.333 → tax of 100 -> 33.3 -> 33
  assert.equal(calculateClaimerTotal(333, 1000, 100, 0), 333 + 33);
});

test("dollarsToCents handles strings and floats", () => {
  assert.equal(dollarsToCents("12.50"), 1250);
  assert.equal(dollarsToCents("0.05"), 5);
  assert.equal(dollarsToCents(""), 0);
  assert.equal(dollarsToCents(7), 700);
});

test("formatCents prints USD with two decimals", () => {
  assert.equal(formatCents(1250), "$12.50");
  assert.equal(formatCents(0), "$0.00");
});
