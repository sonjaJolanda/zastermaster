import { describe, expect, it } from "vitest";
import {
  computeInvestedTotal,
  detectInvestmentSuggestions,
} from "./detect";

describe("computeInvestedTotal", () => {
  it("turns buys into positive EK and sells reduce it", () => {
    expect(computeInvestedTotal([-50, -100, 30])).toBe(120);
  });
});

describe("detectInvestmentSuggestions", () => {
  it("matches keyword and skips rejected", () => {
    const { suggestions } = detectInvestmentSuggestions(
      [
        {
          id: 1,
          datum: new Date(Date.UTC(2026, 6, 22)),
          betrag: -50,
          sender: "",
          empfaenger: "",
          verwendungszweck: "BUY · MSCI World Test",
          bank: "traderepublic",
          konto: "Trade Republic",
        },
        {
          id: 2,
          datum: new Date(Date.UTC(2026, 6, 13)),
          betrag: 200,
          sender: "",
          empfaenger: "",
          verwendungszweck: "Incoming transfer",
          bank: "traderepublic",
          konto: "Trade Republic",
        },
      ],
      ["BUY", "MSCI"],
      new Set([1]),
    );
    expect(suggestions).toHaveLength(0);
  });

  it("finds BUY keyword", () => {
    const { suggestions } = detectInvestmentSuggestions(
      [
        {
          id: 3,
          datum: new Date(Date.UTC(2026, 6, 22)),
          betrag: -50,
          sender: "",
          empfaenger: "",
          verwendungszweck: "BUY · MSCI World Test",
          bank: "traderepublic",
          konto: "Trade Republic",
        },
      ],
      ["BUY"],
      new Set(),
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.matchedKeyword).toBe("BUY");
  });
});
