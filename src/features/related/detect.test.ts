import { describe, expect, it } from "vitest";
import {
  detectNearDuplicates,
  detectPaypalBank,
  detectPaypalPurchase,
  detectTransfers,
  runDetectPipeline,
} from "./detect";
import type { DetectCandidate } from "./types";

function tx(
  partial: Partial<DetectCandidate> & Pick<DetectCandidate, "id" | "betrag">,
): DetectCandidate {
  return {
    datum: new Date(Date.UTC(2026, 6, 20)),
    sender: "",
    empfaenger: "",
    verwendungszweck: "",
    bank: "dkb",
    konto: "Girokonto",
    ...partial,
  };
}

describe("detectPaypalBank", () => {
  it("pairs same-sign PayPal and bank within tolerance", () => {
    const pairs = detectPaypalBank([
      tx({
        id: 1,
        bank: "paypal",
        konto: "PayPal",
        betrag: -25,
        verwendungszweck: "Shop",
      }),
      tx({
        id: 2,
        bank: "dkb",
        betrag: -25,
        verwendungszweck: "PayPal Europe",
        datum: new Date(Date.UTC(2026, 6, 21)),
      }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.type).toBe("paypal_bank");
    expect(pairs[0]!.members).toHaveLength(2);
  });

  it("rejects opposite signs", () => {
    const pairs = detectPaypalBank([
      tx({ id: 1, bank: "paypal", konto: "PayPal", betrag: -25 }),
      tx({ id: 2, bank: "dkb", betrag: 25 }),
    ]);
    expect(pairs).toHaveLength(0);
  });
});

describe("detectPaypalPurchase", () => {
  it("groups purchase + funding + bank debit", () => {
    const groups = detectPaypalPurchase([
      tx({
        id: 1,
        bank: "paypal",
        konto: "PayPal",
        betrag: -25,
        verwendungszweck: "Merchant XYZ",
      }),
      tx({
        id: 2,
        bank: "paypal",
        konto: "PayPal",
        betrag: 25,
        verwendungszweck: "Bank account",
        datum: new Date(Date.UTC(2026, 6, 20)),
      }),
      tx({
        id: 3,
        bank: "dkb",
        betrag: -25,
        verwendungszweck: "PayPal Europe S.a.r.l.",
        datum: new Date(Date.UTC(2026, 6, 21)),
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.type).toBe("paypal_purchase");
    expect(groups[0]!.members.map((m) => m.id).sort()).toEqual([1, 2, 3]);
  });

  it("is preferred over pairwise paypal_bank in the pipeline", () => {
    const candidates = [
      tx({
        id: 1,
        bank: "paypal",
        konto: "PayPal",
        betrag: -25,
        verwendungszweck: "Merchant",
      }),
      tx({
        id: 2,
        bank: "paypal",
        konto: "PayPal",
        betrag: 25,
        verwendungszweck: "Funding",
      }),
      tx({
        id: 3,
        bank: "dkb",
        betrag: -25,
        verwendungszweck: "PayPal",
      }),
    ];
    const { suggestions } = runDetectPipeline(candidates, new Set());
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.type).toBe("paypal_purchase");
    expect(suggestions[0]!.members).toHaveLength(3);
  });
});

describe("detectTransfers", () => {
  it("finds opposite-sign own-account move with keyword", () => {
    const pairs = detectTransfers([
      tx({
        id: 1,
        konto: "Girokonto",
        betrag: -500,
        verwendungszweck: "Umbuchung Tagesgeld",
      }),
      tx({
        id: 2,
        konto: "Tagesgeld",
        betrag: 500,
        verwendungszweck: "Umbuchung von Giro",
      }),
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.type).toBe("transfer");
  });

  it("skips same account", () => {
    const pairs = detectTransfers([
      tx({
        id: 1,
        konto: "Girokonto",
        betrag: -100,
        verwendungszweck: "Umbuchung",
      }),
      tx({
        id: 2,
        konto: "Girokonto",
        betrag: 100,
        verwendungszweck: "Umbuchung",
      }),
    ]);
    expect(pairs).toHaveLength(0);
  });
});

describe("detectNearDuplicates", () => {
  it("flags overlapping purpose on same day/account", () => {
    const pairs = detectNearDuplicates([
      tx({
        id: 1,
        betrag: -40,
        verwendungszweck: "Amazon Marketplace Bestellung ABC123",
      }),
      tx({
        id: 2,
        betrag: -40,
        verwendungszweck: "Amazon Marketplace Bestellung ABC123 Extra",
      }),
    ]);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs[0]!.type).toBe("near_duplicate");
  });

  it("ignores unrelated purposes", () => {
    const pairs = detectNearDuplicates([
      tx({ id: 1, betrag: -10, verwendungszweck: "REWE Einkauf Filiale" }),
      tx({ id: 2, betrag: -10, verwendungszweck: "Tankstelle Shell Station" }),
    ]);
    expect(pairs).toHaveLength(0);
  });
});
