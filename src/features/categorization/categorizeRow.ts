import {
  buildKeywordCatalog,
  matchKeywords,
  type CategorizeResult,
  type CategoryTreeForMatch,
  type KeywordCatalog,
} from "./matchKeywords";
import {
  matchLearnedRules,
  type LearnedRuleForMatch,
} from "./matchLearnedRules";

export type { CategorizeResult, CategoryTreeForMatch, KeywordCatalog };
export type { LearnedRuleForMatch };
export { buildKeywordCatalog, matchKeywords, matchLearnedRules };

/**
 * Hybrid pipeline: learned rules → keywords → Sonstiges/Unbekannt fallback.
 */
export function categorizeRow(
  catalog: KeywordCatalog,
  fields: {
    sender: string;
    empfaenger: string;
    verwendungszweck: string;
  },
  learnedRules: LearnedRuleForMatch[] = [],
): CategorizeResult & { learnedRuleId?: number } {
  const learned = matchLearnedRules(learnedRules, fields);
  if (learned) {
    return {
      categoryId: learned.categoryId,
      subcategoryId: learned.subcategoryId,
      confidenceScore: learned.confidenceScore,
      categorySource: "learned",
      learnedRuleId: learned.ruleId,
    };
  }

  const hit = matchKeywords(catalog, fields);
  if (hit) return hit;

  return {
    categoryId: catalog.fallbackCategoryId,
    subcategoryId: catalog.fallbackSubcategoryId,
    confidenceScore: 0,
    categorySource: "none",
  };
}
