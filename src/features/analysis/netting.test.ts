import { describe, expect, it } from "vitest";
import { idsToDropForNetting, summarizeNetted, type NettedTx } from "./netting";

function row(
  partial: Partial<NettedTx> & Pick<NettedTx, "id" | "betrag">,
): NettedTx {
  return {
    datum: new Date(Date.UTC(2026, 6, 20)),
    bank: "dkb",
    relatedTransactionId: null,
    relatedType: null,
    relatedGroupId: null,
    ...partial,
  };
}

describe("idsToDropForNetting", () => {
  it("drops both legs of a transfer", () => {
    const rows = [
      row({
        id: 1,
        betrag: -200,
        relatedTransactionId: 2,
        relatedType: "transfer",
      }),
      row({
        id: 2,
        betrag: 200,
        relatedTransactionId: 1,
        relatedType: "transfer",
        bank: "dkb",
      }),
    ];
    const drop = idsToDropForNetting(rows);
    expect(drop.has(1)).toBe(true);
    expect(drop.has(2)).toBe(true);
  });

  it("keeps PayPal leg and drops bank for paypal_bank", () => {
    const rows = [
      row({
        id: 1,
        betrag: -25,
        bank: "paypal",
        relatedTransactionId: 2,
        relatedType: "paypal_bank",
      }),
      row({
        id: 2,
        betrag: -25,
        bank: "dkb",
        relatedTransactionId: 1,
        relatedType: "paypal_bank",
      }),
    ];
    const drop = idsToDropForNetting(rows);
    expect(drop.has(1)).toBe(false);
    expect(drop.has(2)).toBe(true);
  });

  it("keeps PayPal purchase and drops wallet credit + bank funding", () => {
    const rows = [
      row({
        id: 1,
        betrag: -25,
        bank: "paypal",
        relatedGroupId: "g1",
        relatedType: "paypal_purchase",
      }),
      row({
        id: 2,
        betrag: 25,
        bank: "paypal",
        relatedGroupId: "g1",
        relatedType: "paypal_purchase",
      }),
      row({
        id: 3,
        betrag: -25,
        bank: "dkb",
        relatedGroupId: "g1",
        relatedType: "paypal_purchase",
      }),
    ];
    const drop = idsToDropForNetting(rows);
    expect(drop.has(1)).toBe(false);
    expect(drop.has(2)).toBe(true);
    expect(drop.has(3)).toBe(true);
    expect(summarizeNetted(rows)).toEqual({
      income: 0,
      expense: 25,
      count: 1,
    });
  });

  it("drops PayPal funding when the purchase is outside the filter", () => {
    const rows = [
      row({
        id: 2,
        betrag: 25,
        bank: "paypal",
        relatedGroupId: "g1",
        relatedType: "paypal_purchase",
      }),
      row({
        id: 3,
        betrag: -25,
        bank: "dkb",
        relatedGroupId: "g1",
        relatedType: "paypal_purchase",
      }),
    ];
    expect(summarizeNetted(rows)).toEqual({
      income: 0,
      expense: 0,
      count: 0,
    });
  });

  it("keeps a lone PayPal purchase when funding is outside the filter", () => {
    const rows = [
      row({
        id: 1,
        betrag: -25,
        bank: "paypal",
        relatedGroupId: "g1",
        relatedType: "paypal_purchase",
      }),
    ];
    expect(summarizeNetted(rows)).toEqual({
      income: 0,
      expense: 25,
      count: 1,
    });
  });
});
