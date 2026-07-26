import { describe, expect, it } from "vitest";
import {
  computeTransactionsSummary,
  toTransactionsSummary,
} from "./summary";

describe("computeTransactionsSummary", () => {
  it("sums income, expense, net and count", () => {
    const summary = computeTransactionsSummary([100, -40, -10, 0, 25.5]);
    expect(summary.income).toBe("125.50");
    expect(summary.expense).toBe("50.00");
    expect(summary.net).toBe("75.50");
    expect(summary.count).toBe(5);
  });

  it("handles only expenses", () => {
    const summary = computeTransactionsSummary([-12.34, -0.66]);
    expect(summary.income).toBe("0.00");
    expect(summary.expense).toBe("13.00");
    expect(summary.net).toBe("-13.00");
    expect(summary.count).toBe(2);
  });

  it("handles empty set", () => {
    expect(computeTransactionsSummary([])).toEqual({
      income: "0.00",
      expense: "0.00",
      net: "0.00",
      count: 0,
    });
  });
});

describe("toTransactionsSummary", () => {
  it("formats prisma-style aggregates", () => {
    expect(toTransactionsSummary(200, -50, 3)).toEqual({
      income: "200.00",
      expense: "50.00",
      net: "150.00",
      count: 3,
    });
  });
});
