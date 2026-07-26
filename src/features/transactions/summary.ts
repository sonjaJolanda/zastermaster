import type { TransactionsSummary } from "./types";

/**
 * Format income / |expense| / net / count (same rules as getTransactionsSummary).
 */
export function toTransactionsSummary(
  income: number,
  expenseRaw: number,
  count: number,
): TransactionsSummary {
  const expense = Math.abs(expenseRaw);
  return {
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    net: (income - expense).toFixed(2),
    count,
  };
}

/**
 * Pure summary over a filtered amount list (unit tests / in-memory).
 * Zero amounts count toward `count` but not income/expense.
 */
export function computeTransactionsSummary(
  amounts: readonly number[],
): TransactionsSummary {
  let income = 0;
  let expenseRaw = 0;
  for (const betrag of amounts) {
    if (betrag > 0) income += betrag;
    else if (betrag < 0) expenseRaw += betrag;
  }
  return toTransactionsSummary(income, expenseRaw, amounts.length);
}
