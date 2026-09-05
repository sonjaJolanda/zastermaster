import { describe, expect, it } from "vitest";
import { categorizeRow } from "./categorizeRow";
import { buildKeywordCatalog } from "./matchKeywords";

const tree = [
  {
    id: 1,
    name: "Einkaufen",
    keywords: ["shopping"],
    subcategories: [
      { id: 11, name: "Supermärkte", keywords: ["rewe", "aldi"] },
      { id: 12, name: "Unbekannt", keywords: [] },
    ],
  },
  {
    id: 9,
    name: "Sonstiges",
    keywords: [],
    subcategories: [{ id: 91, name: "Unbekannt", keywords: [] }],
  },
];

describe("categorizeRow", () => {
  const catalog = buildKeywordCatalog(tree);

  it("matches subcategory keyword", () => {
    const result = categorizeRow(catalog, {
      sender: "",
      empfaenger: "REWE Markt GmbH",
      verwendungszweck: "Einkauf",
    });
    expect(result.categorySource).toBe("keyword");
    expect(result.categoryId).toBe(1);
    expect(result.subcategoryId).toBe(11);
    expect(result.confidenceScore).toBe(0.7);
  });

  it("falls back to Sonstiges / Unbekannt", () => {
    const result = categorizeRow(catalog, {
      sender: "X",
      empfaenger: "Y",
      verwendungszweck: "irgendwas unbekanntes",
    });
    expect(result.categorySource).toBe("none");
    expect(result.categoryId).toBe(9);
    expect(result.subcategoryId).toBe(91);
    expect(result.confidenceScore).toBe(0);
  });
});
