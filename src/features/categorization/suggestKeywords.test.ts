import { describe, expect, it } from "vitest";
import {
  cleanCounterparty,
  stripPurposeTemplates,
  suggestKeywordsFromTransaction,
} from "./suggestKeywords";

describe("stripPurposeTemplates", () => {
  it("drops dated VISA purpose and keeps leftover merchant text", () => {
    expect(
      stripPurposeTemplates("VISA Debitkartenumsatz vom 12.07.2026 REWE Einkauf"),
    ).toBe("REWE Einkauf");
  });

  it("extracts PayPal Express merchant", () => {
    expect(
      stripPurposeTemplates("PayPal Express-Zahlung · Deutsche Post AG"),
    ).toBe("Deutsche Post AG");
  });
});

describe("cleanCounterparty", () => {
  it("strips card city suffix and dotted acquirer names", () => {
    expect(cleanCounterparty("PORTOKALI.DUSHKU.M./THESSALONIKI")).toBe(
      "PORTOKALI DUSHKU M",
    );
    expect(cleanCounterparty("SUMUP...LNDT.MULTITUDE/LEIPZIG")).toBe(
      "SUMUP LNDT MULTITUDE",
    );
  });
});

describe("suggestKeywordsFromTransaction", () => {
  it("suggests the card merchant, not the VISA template", () => {
    const kws = suggestKeywordsFromTransaction({
      sender: "ISSUER",
      empfaenger: "REWE Markt GmbH",
      verwendungszweck: "VISA Debitkartenumsatz vom 12.07.2026",
    });
    expect(kws.some((k) => /visa|debitkartenumsatz/i.test(k))).toBe(false);
    expect(kws).toContain("REWE");
    expect(kws[0]).toBe("REWE");
    expect(kws).not.toContain("ISSUER");
  });

  it("skips keywords already on the target subcategory", () => {
    const kws = suggestKeywordsFromTransaction(
      {
        sender: "ISSUER",
        empfaenger: "REWE Markt GmbH",
        verwendungszweck: "VISA Debitkartenumsatz vom 12.07.2026",
      },
      ["rewe"],
    );
    expect(kws.some((k) => k.toLowerCase() === "rewe")).toBe(false);
  });

  it("suggests PayPal merchant from purpose, not the own email", () => {
    const kws = suggestKeywordsFromTransaction({
      sender: "sonja@example.com",
      empfaenger: "sonja@example.com",
      verwendungszweck: "PayPal Express-Zahlung · OpenAI",
    });
    expect(kws.some((k) => k.includes("@"))).toBe(false);
    expect(kws).toContain("OpenAI");
  });

  it("does not suggest unique SEPA references", () => {
    const kws = suggestKeywordsFromTransaction({
      sender: "PayPal",
      empfaenger: "PayPal Europe S.a.r.l. et Cie S.C.A",
      verwendungszweck:
        "FOLGELASTSCHRIFT · EREF+1051529912701MREF+5KJJ224X4Y7K4CRED+LU96ZZZ0000000000000",
    });
    expect(kws.join(" ")).not.toMatch(/1051529912701/i);
    expect(kws.some((k) => /visa|folgelastschrift/i.test(k))).toBe(false);
  });

  it("offers PadelCity from SumUp + GmbH merchant names", () => {
    const dotted = suggestKeywordsFromTransaction({
      sender: "ISSUER",
      empfaenger: "SumUp..PadelCity.GmbH/Munchen",
      verwendungszweck: "VISA Debitkartenumsatz vom 02.09.2026",
    });
    expect(dotted.some((k) => /^padelcity$/i.test(k))).toBe(true);
    expect(dotted.some((k) => /^sumup$/i.test(k))).toBe(false);

    const spaced = suggestKeywordsFromTransaction({
      sender: "ISSUER",
      empfaenger: "SumUp PadelCity GmbH",
      verwendungszweck: "VISA Debitkartenumsatz vom 02.09.2026",
    });
    expect(spaced).toContain("PadelCity");
    expect(spaced.some((k) => /^sumup$/i.test(k))).toBe(false);
  });

  it("lists single words before multi-word phrases", () => {
    const kws = suggestKeywordsFromTransaction({
      sender: "ISSUER",
      empfaenger: "Deutsche Post AG",
      verwendungszweck: "VISA Debitkartenumsatz vom 01.01.2026",
    });
    expect(kws).toContain("Deutsche");
    expect(kws).toContain("Post");
    const firstPhrase = kws.findIndex((k) => k.includes(" "));
    const firstSingle = kws.findIndex((k) => !k.includes(" "));
    expect(firstSingle).toBeGreaterThanOrEqual(0);
    if (firstPhrase >= 0) {
      expect(firstSingle).toBeLessThan(firstPhrase);
    }
  });
});
