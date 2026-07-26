import { normalizeForMatch } from "../categorization/matchKeywords";

export type InvestmentCandidate = {
  id: number;
  datum: Date;
  betrag: number;
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
  bank: string;
  konto: string;
};

export type InvestmentSuggestion = {
  transactionId: number;
  matchedKeyword: string;
  datum: string;
  betrag: string;
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
  bank: string;
  konto: string;
};

export const INVESTMENT_SUGGESTION_CAP = 100;

function keywordMatches(haystackNorm: string, keywordNorm: string): boolean {
  if (!keywordNorm || !haystackNorm) return false;
  return (
    haystackNorm === keywordNorm ||
    haystackNorm.startsWith(`${keywordNorm} `) ||
    haystackNorm.endsWith(` ${keywordNorm}`) ||
    haystackNorm.includes(` ${keywordNorm} `) ||
    haystackNorm.includes(keywordNorm)
  );
}

/** Find txs matching any investment keyword (longest keyword wins per tx). */
export function detectInvestmentSuggestions(
  candidates: InvestmentCandidate[],
  keywords: string[],
  rejectedIds: Set<number>,
): { suggestions: InvestmentSuggestion[]; truncated: boolean } {
  const norms = keywords
    .map((k) => ({ raw: k.trim(), norm: normalizeForMatch(k) }))
    .filter((k) => k.norm.length > 0)
    .sort((a, b) => b.norm.length - a.norm.length);

  const suggestions: InvestmentSuggestion[] = [];

  for (const tx of candidates) {
    if (rejectedIds.has(tx.id)) continue;
    const haystacks = [
      normalizeForMatch(tx.sender),
      normalizeForMatch(tx.empfaenger),
      normalizeForMatch(tx.verwendungszweck),
    ].filter(Boolean);

    let matched: string | null = null;
    for (const hay of haystacks) {
      for (const kw of norms) {
        if (keywordMatches(hay, kw.norm)) {
          matched = kw.raw;
          break;
        }
      }
      if (matched) break;
    }
    if (!matched) continue;

    suggestions.push({
      transactionId: tx.id,
      matchedKeyword: matched,
      datum: tx.datum.toISOString().slice(0, 10),
      betrag: tx.betrag.toFixed(2),
      sender: tx.sender,
      empfaenger: tx.empfaenger,
      verwendungszweck: tx.verwendungszweck,
      bank: tx.bank,
      konto: tx.konto,
    });
  }

  suggestions.sort((a, b) => {
    if (a.datum !== b.datum) return a.datum < b.datum ? 1 : -1;
    return b.transactionId - a.transactionId;
  });

  const truncated = suggestions.length > INVESTMENT_SUGGESTION_CAP;
  return {
    suggestions: truncated
      ? suggestions.slice(0, INVESTMENT_SUGGESTION_CAP)
      : suggestions,
    truncated,
  };
}

/** Invested cost basis: −Σ betrag over confirmed investment rows. */
export function computeInvestedTotal(amounts: readonly number[]): number {
  let sum = 0;
  for (const a of amounts) sum -= a;
  return sum;
}
