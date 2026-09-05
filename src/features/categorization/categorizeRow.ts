import {
  buildKeywordCatalog,
  matchKeywords,
  type CategorizeResult,
  type CategoryTreeForMatch,
  type KeywordCatalog,
} from "./matchKeywords";

export type { CategorizeResult, CategoryTreeForMatch, KeywordCatalog };
export { buildKeywordCatalog, matchKeywords };

/**
 * Hybrid pipeline: keywords → Sonstiges/Unbekannt fallback.
 */
export function categorizeRow(
  catalog: KeywordCatalog,
  fields: {
    sender: string;
    empfaenger: string;
    verwendungszweck: string;
  },
): CategorizeResult {
  const hit = matchKeywords(catalog, fields);
  if (hit) return hit;

  return {
    categoryId: catalog.fallbackCategoryId,
    subcategoryId: catalog.fallbackSubcategoryId,
    confidenceScore: 0,
    categorySource: "none",
  };
}
