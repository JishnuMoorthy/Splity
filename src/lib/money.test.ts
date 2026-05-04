import { describe, expect, it } from "vitest";
import {
  calculateClaimerTotal,
  centsToDollarString,
  dollarsToCents,
  formatCents,
} from "./money";

describe("dollarsToCents", () => {
  it.each([
    ["12.50", 1250],
    ["12.5", 1250],
    ["0.5", 50],
    [".5", 50],
    ["0", 0],
    ["", 0],
    ["abc", 0],
    ["1.005", 100],
    ["1.999", 200],
    [12.5, 1250],
    [7, 700],
  ] as Array<[string | number, number]>)(
    "dollarsToCents(%j) === %i",
    (input, expected) => {
      expect(dollarsToCents(input)).toBe(expected);
    }
  );
});

describe("centsToDollarString", () => {
  it.each([
    [0, ""],
    [50, "0.50"],
    [1250, "12.50"],
    [99, "0.99"],
    [100000, "1000.00"],
  ])("centsToDollarString(%i) === %j", (cents, expected) => {
    expect(centsToDollarString(cents)).toBe(expected);
  });
});

describe("formatCents", () => {
  it("formats USD with two decimals", () => {
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(0)).toBe("$0.00");
  });
});

describe("calculateClaimerTotal", () => {
  it("returns 0 when bill subtotal is 0", () => {
    expect(calculateClaimerTotal(0, 0, 500, 200)).toBe(0);
  });

  it("allocates tax+tip proportionally", () => {
    expect(calculateClaimerTotal(2500, 10000, 800, 2000)).toBe(
      2500 + 200 + 500
    );
  });

  it("rounds to nearest cent", () => {
    expect(calculateClaimerTotal(333, 1000, 100, 0)).toBe(333 + 33);
  });
});
