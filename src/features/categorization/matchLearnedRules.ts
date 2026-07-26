import type { CategorizeResult } from "./matchKeywords";

export type LearnedRuleForMatch = {
  id: number;
  descriptionFragment: string;
  categoryId: number;
  subcategoryId: number;
  confidence: number;
  usageCount: number;
};

const WEIGHT_THRESHOLD = 0.3;

function pickText(fields: {
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
}): string {
  const zweck = fields.verwendungszweck.trim();
  if (zweck) return zweck;
  const sender = fields.sender.trim();
  if (sender) return sender;
  return fields.empfaenger.trim();
}

/**
 * Best learned-rule hit: fragment is case-insensitive substring of
 * Verwendungszweck, else sender, else empfaenger.
 */
export function matchLearnedRules(
  rules: LearnedRuleForMatch[],
  fields: {
    sender: string;
    empfaenger: string;
    verwendungszweck: string;
  },
): (CategorizeResult & { ruleId: number }) | null {
  if (rules.length === 0) return null;

  const candidates = [
    fields.verwendungszweck,
    fields.sender,
    fields.empfaenger,
  ]
    .map((t) => t.trim())
    .filter(Boolean);

  if (candidates.length === 0) return null;

  let best: {
    rule: LearnedRuleForMatch;
    weighted: number;
  } | null = null;

  for (const rule of rules) {
    const fragment = rule.descriptionFragment.trim();
    if (fragment.length < 2) continue;
    const fragLower = fragment.toLowerCase();

    for (const text of candidates) {
      if (!text.toLowerCase().includes(fragLower)) continue;
      const weighted =
        (fragment.length / Math.max(text.length, 1)) *
        (1 + rule.usageCount * 0.1);
      if (weighted <= WEIGHT_THRESHOLD) continue;
      if (!best || weighted > best.weighted) {
        best = { rule, weighted };
      }
      break; // first matching field for this rule (zweck → sender → empfaenger)
    }
  }

  if (!best) return null;

  return {
    categoryId: best.rule.categoryId,
    subcategoryId: best.rule.subcategoryId,
    confidenceScore: Math.min(1, best.weighted * best.rule.confidence),
    categorySource: "learned",
    ruleId: best.rule.id,
  };
}

/** Fragment used when saving “merken” from a transaction. */
export function fragmentFromTransaction(fields: {
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
}): string | null {
  const text = pickText(fields);
  const trimmed = text.trim();
  if (trimmed.length < 2) return null;
  // Cap extreme lengths so unique index stays practical
  return trimmed.slice(0, 500);
}
