export type CategorySource = "manual" | "learned" | "keyword" | "none";

export type CategorizeResult = {
  categoryId: number;
  subcategoryId: number;
  confidenceScore: number;
  categorySource: CategorySource;
};

export type KeywordCatalog = {
  /** Subcategory keywords, longest first for specificity. */
  subKeywords: Array<{
    keywordNorm: string;
    keywordLen: number;
    categoryId: number;
    subcategoryId: number;
  }>;
  /** Main-category keywords, longest first. */
  mainKeywords: Array<{
    keywordNorm: string;
    keywordLen: number;
    categoryId: number;
  }>;
  /** Per category: Unbekannt / Allgemein / first subcategory. */
  defaultSubByCategoryId: Map<number, number>;
  fallbackCategoryId: number;
  fallbackSubcategoryId: number;
};

export type CategoryTreeForMatch = {
  id: number;
  name: string;
  keywords: string[];
  subcategories: Array<{
    id: number;
    name: string;
    keywords: string[];
  }>;
};

/** Lowercase + collapse separators so "H & M" ≈ "h m". */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9äöüß]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordMatches(haystackNorm: string, keywordNorm: string): boolean {
  if (!keywordNorm) return false;
  if (!haystackNorm) return false;
  // Whole-token / substring with flexible separators already collapsed to spaces.
  return (
    haystackNorm === keywordNorm ||
    haystackNorm.startsWith(`${keywordNorm} `) ||
    haystackNorm.endsWith(` ${keywordNorm}`) ||
    haystackNorm.includes(` ${keywordNorm} `) ||
    haystackNorm.includes(keywordNorm)
  );
}

function pickDefaultSubId(
  subs: Array<{ id: number; name: string }>,
): number | null {
  if (subs.length === 0) return null;
  const unbekannt = subs.find((s) => s.name.toLowerCase() === "unbekannt");
  if (unbekannt) return unbekannt.id;
  const allgemein = subs.find((s) => s.name.toLowerCase() === "allgemein");
  if (allgemein) return allgemein.id;
  return subs[0]!.id;
}

export function buildKeywordCatalog(
  categories: CategoryTreeForMatch[],
): KeywordCatalog {
  const subKeywords: KeywordCatalog["subKeywords"] = [];
  const mainKeywords: KeywordCatalog["mainKeywords"] = [];
  const defaultSubByCategoryId = new Map<number, number>();

  let fallbackCategoryId: number | null = null;
  let fallbackSubcategoryId: number | null = null;

  for (const cat of categories) {
    const defaultSub = pickDefaultSubId(cat.subcategories);
    if (defaultSub != null) {
      defaultSubByCategoryId.set(cat.id, defaultSub);
    }

    const nameLower = cat.name.toLowerCase();
    if (
      (nameLower === "sonstiges" || nameLower === "sonstige") &&
      fallbackCategoryId == null
    ) {
      fallbackCategoryId = cat.id;
      const unb = cat.subcategories.find(
        (s) => s.name.toLowerCase() === "unbekannt",
      );
      fallbackSubcategoryId = unb?.id ?? defaultSub;
    }

    for (const kw of cat.keywords) {
      const keywordNorm = normalizeForMatch(kw);
      if (!keywordNorm) continue;
      mainKeywords.push({
        keywordNorm,
        keywordLen: keywordNorm.length,
        categoryId: cat.id,
      });
    }

    for (const sub of cat.subcategories) {
      for (const kw of sub.keywords) {
        const keywordNorm = normalizeForMatch(kw);
        if (!keywordNorm) continue;
        subKeywords.push({
          keywordNorm,
          keywordLen: keywordNorm.length,
          categoryId: cat.id,
          subcategoryId: sub.id,
        });
      }
    }
  }

  if (fallbackCategoryId == null || fallbackSubcategoryId == null) {
    const first = categories[0];
    if (!first || first.subcategories.length === 0) {
      throw new Error(
        "Keine Kategorien für Fallback (Sonstiges/Unbekannt) vorhanden — zuerst seedCategoriesIfEmpty.",
      );
    }
    fallbackCategoryId = first.id;
    fallbackSubcategoryId =
      pickDefaultSubId(first.subcategories) ?? first.subcategories[0]!.id;
  }

  subKeywords.sort((a, b) => b.keywordLen - a.keywordLen);
  mainKeywords.sort((a, b) => b.keywordLen - a.keywordLen);

  return {
    subKeywords,
    mainKeywords,
    defaultSubByCategoryId,
    fallbackCategoryId,
    fallbackSubcategoryId,
  };
}

/**
 * Keyword match: fields sender → empfaenger → verwendungszweck.
 * Prefer longest subcategory keyword, else main keyword → default sub.
 */
export function matchKeywords(
  catalog: KeywordCatalog,
  fields: {
    sender: string;
    empfaenger: string;
    verwendungszweck: string;
  },
): CategorizeResult | null {
  const haystacks = [
    normalizeForMatch(fields.sender),
    normalizeForMatch(fields.empfaenger),
    normalizeForMatch(fields.verwendungszweck),
  ].filter(Boolean);

  if (haystacks.length === 0) return null;

  for (const hay of haystacks) {
    for (const kw of catalog.subKeywords) {
      if (keywordMatches(hay, kw.keywordNorm)) {
        return {
          categoryId: kw.categoryId,
          subcategoryId: kw.subcategoryId,
          confidenceScore: 0.7,
          categorySource: "keyword",
        };
      }
    }
  }

  for (const hay of haystacks) {
    for (const kw of catalog.mainKeywords) {
      if (keywordMatches(hay, kw.keywordNorm)) {
        const subcategoryId =
          catalog.defaultSubByCategoryId.get(kw.categoryId) ??
          catalog.fallbackSubcategoryId;
        return {
          categoryId: kw.categoryId,
          subcategoryId,
          confidenceScore: 0.7,
          categorySource: "keyword",
        };
      }
    }
  }

  return null;
}
