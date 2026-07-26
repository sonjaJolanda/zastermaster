import { describe, expect, it } from "vitest";
import { idsToDropForNetting, type NettedTx } from "./netting";

function row(
  partial: Partial<NettedTx> & Pick<NettedTx, "id" | "betrag">,
): NettedTx {
  return {
    datum: new Date(Date.UTC(2026, 6, 20)),
    bank: "dkb",
    relatedTransactionId: null,
    relatedType: null,
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
});
