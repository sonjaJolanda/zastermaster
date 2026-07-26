import { describe, expect, it } from "vitest";
import {
  detectLikelyBank,
  ImportParseError,
  parseGermanAmount,
  parseGermanDate,
  stripBom,
} from "./types";

describe("stripBom", () => {
  it("removes UTF-8 BOM", () => {
    expect(stripBom("\uFEFFhello")).toBe("hello");
  });

  it("leaves plain text alone", () => {
    expect(stripBom("hello")).toBe("hello");
  });
});

describe("parseGermanAmount", () => {
  it("parses de-DE with thousands and cents", () => {
    expect(parseGermanAmount("1.234,56")).toBe("1234.56");
  });

  it("parses negative amounts", () => {
    expect(parseGermanAmount("-12,34")).toBe("-12.34");
  });

  it("strips euro and spaces", () => {
    expect(parseGermanAmount(" 12,00 € ")).toBe("12.00");
  });

  it("rejects empty", () => {
    expect(() => parseGermanAmount("")).toThrow(ImportParseError);
  });
});

describe("parseGermanDate", () => {
  it("parses TT.MM.JJJJ as UTC midnight", () => {
    expect(parseGermanDate("24.07.2026").toISOString()).toBe(
      "2026-07-24T00:00:00.000Z",
    );
  });

  it("expands two-digit years", () => {
    expect(parseGermanDate("02.01.26").toISOString()).toBe(
      "2026-01-02T00:00:00.000Z",
    );
  });

  it("rejects bad input", () => {
    expect(() => parseGermanDate("2026-07-24")).toThrow(ImportParseError);
  });
});

describe("detectLikelyBank", () => {
  it("detects DKB headers", () => {
    expect(
      detectLikelyBank("Buchungsdatum;x;Betrag (€)"),
    ).toBe("dkb");
  });

  it("detects PayPal headers", () => {
    expect(
      detectLikelyBank("Datum\tNetto\tTransaktionscode\tAbsender E-Mail"),
    ).toBe("paypal");
  });

  it("returns null for unknown", () => {
    expect(detectLikelyBank("hello world")).toBeNull();
  });
});
