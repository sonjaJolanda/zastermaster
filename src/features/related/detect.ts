import type {
  DetectCandidate,
  RelatedSuggestion,
  RelatedTxPublic,
  RelatedType,
} from "./types";

export const DATE_TOLERANCE_DAYS = 3;
export const AMOUNT_TOLERANCE = 0.01;
export const SUGGESTION_CAP = 100;
export const NEAR_DUP_WORD_OVERLAP = 0.5;

const TRANSFER_KEYWORDS = [
  "umbuchung",
  "ueberweisung",
  "überweisung",
  "transfer",
  "eigene konten",
  "eigenuebertrag",
  "eigenübertrag",
  "sparen",
  "tagesgeld",
  "girokonto",
];

const STOPWORDS = new Set([
  "und",
  "oder",
  "the",
  "a",
  "an",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "ein",
  "eine",
  "einer",
  "eines",
  "zahlung",
  "sepa",
  "lastschrift",
  "gutschrift",
  "von",
  "an",
  "fur",
  "für",
  "mit",
  "bei",
]);

const TYPE_PRIORITY: Record<RelatedType, number> = {
  transfer: 3,
  paypal_bank: 2,
  near_duplicate: 1,
};

export function pairKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(a.getTime() - b.getTime());
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function amountCents(n: number): number {
  return Math.round(Math.abs(n) * 100);
}

function sign(n: number): number {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

function isWallet(bank: string): boolean {
  return bank.toLowerCase() === "paypal";
}

function isBankLeg(bank: string): boolean {
  return !isWallet(bank);
}

function accountKey(tx: DetectCandidate): string {
  return `${tx.bank.toLowerCase()}|${tx.konto.toLowerCase()}`;
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/\s+/g, " ")
    .trim();
}

function searchBlob(tx: DetectCandidate): string {
  return normalizeText(
    `${tx.verwendungszweck} ${tx.sender} ${tx.empfaenger} ${tx.konto}`,
  );
}

function hasTransferKeyword(tx: DetectCandidate): boolean {
  const blob = searchBlob(tx);
  return TRANSFER_KEYWORDS.some((kw) => blob.includes(normalizeText(kw)));
}

function tokens(tx: DetectCandidate): Set<string> {
  const words = searchBlob(tx)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return new Set(words);
}

function sharedToken(a: DetectCandidate, b: DetectCandidate): boolean {
  const ta = tokens(a);
  for (const w of tokens(b)) {
    if (ta.has(w)) return true;
  }
  return false;
}

function wordOverlap(a: DetectCandidate, b: DetectCandidate): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) {
    if (tb.has(w)) inter += 1;
  }
  const union = new Set([...ta, ...tb]).size;
  return union === 0 ? 0 : inter / union;
}

function formatAmountDe(n: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(n);
}

function dayLabel(dayDiff: number): string {
  if (dayDiff === 0) return "gleicher Tag";
  if (dayDiff === 1) return "1 Tag Abstand";
  return `${dayDiff} Tage Abstand`;
}

function toPublic(tx: DetectCandidate): RelatedTxPublic {
  return {
    id: tx.id,
    datum: tx.datum.toISOString().slice(0, 10),
    betrag: tx.betrag.toFixed(2),
    sender: tx.sender,
    empfaenger: tx.empfaenger,
    verwendungszweck: tx.verwendungszweck,
    bank: tx.bank,
    konto: tx.konto,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

type RawPair = {
  a: DetectCandidate;
  b: DetectCandidate;
  type: RelatedType;
  score: number;
  reason: string;
};

function preferPair(next: RawPair, prev: RawPair): boolean {
  if (next.score > prev.score + 0.05) return true;
  if (prev.score > next.score + 0.05) return false;
  return TYPE_PRIORITY[next.type] > TYPE_PRIORITY[prev.type];
}

/** Detector A — PayPal ↔ bank (same sign, ≈ amount, ≤ 3 days). */
export function detectPaypalBank(
  candidates: DetectCandidate[],
): RawPair[] {
  const wallets = candidates.filter((t) => isWallet(t.bank));
  const banks = candidates.filter((t) => isBankLeg(t.bank));
  if (wallets.length === 0 || banks.length === 0) return [];

  const bankByCents = new Map<number, DetectCandidate[]>();
  for (const b of banks) {
    const key = amountCents(b.betrag);
    const list = bankByCents.get(key) ?? [];
    list.push(b);
    bankByCents.set(key, list);
  }
  for (const list of bankByCents.values()) {
    list.sort((x, y) => x.datum.getTime() - y.datum.getTime());
  }

  const out: RawPair[] = [];

  for (const w of wallets) {
    const cents = amountCents(w.betrag);
    const neighbors: DetectCandidate[] = [];
    for (const delta of [-1, 0, 1]) {
      const bucket = bankByCents.get(cents + delta);
      if (bucket) neighbors.push(...bucket);
    }

    for (const b of neighbors) {
      if (sign(w.betrag) !== sign(b.betrag)) continue;
      if (sign(w.betrag) === 0) continue;

      const amountDiff = Math.abs(Math.abs(w.betrag) - Math.abs(b.betrag));
      if (amountDiff > AMOUNT_TOLERANCE) continue;

      const dayDiff = daysBetween(w.datum, b.datum);
      if (dayDiff > DATE_TOLERANCE_DAYS) continue;

      let score = clamp01(1.0 - 0.1 * dayDiff - 5 * amountDiff);
      if (searchBlob(b).includes("paypal")) {
        score = clamp01(score + 0.05);
      }

      out.push({
        a: w,
        b,
        type: "paypal_bank",
        score,
        reason: `Gleicher Betrag (${formatAmountDe(w.betrag)}), ${dayLabel(dayDiff)}`,
      });
    }
  }

  return out;
}

/** Detector B — internal transfer (opposite sign, different account). */
export function detectTransfers(candidates: DetectCandidate[]): RawPair[] {
  const byAbsCents = new Map<number, DetectCandidate[]>();
  for (const tx of candidates) {
    if (sign(tx.betrag) === 0) continue;
    const key = amountCents(tx.betrag);
    const list = byAbsCents.get(key) ?? [];
    list.push(tx);
    byAbsCents.set(key, list);
  }

  const out: RawPair[] = [];
  const seen = new Set<string>();

  for (const list of byAbsCents.values()) {
    list.sort((x, y) => x.datum.getTime() - y.datum.getTime());
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        const dayDiff = daysBetween(a.datum, b.datum);
        if (dayDiff > DATE_TOLERANCE_DAYS) break;

        if (accountKey(a) === accountKey(b)) continue;
        if (Math.abs(a.betrag + b.betrag) > AMOUNT_TOLERANCE) continue;

        const keyword =
          hasTransferKeyword(a) || hasTransferKeyword(b);
        const tokenHit = sharedToken(a, b);
        if (!keyword && !tokenHit) continue;

        const key = pairKey(a.id, b.id);
        if (seen.has(key)) continue;
        seen.add(key);

        let score = clamp01(0.85 - 0.1 * dayDiff);
        if (keyword) score = clamp01(score + 0.1);

        out.push({
          a,
          b,
          type: "transfer",
          score,
          reason: `Gegenbetrag, ${a.bank.toUpperCase()} ${a.konto} ↔ ${b.bank.toUpperCase()} ${b.konto}`,
        });
      }
    }
  }

  return out;
}

/** Detector C — near-duplicate on same account/day. */
export function detectNearDuplicates(
  candidates: DetectCandidate[],
): RawPair[] {
  const byAccountDay = new Map<string, DetectCandidate[]>();
  for (const tx of candidates) {
    const day = tx.datum.toISOString().slice(0, 10);
    const key = `${accountKey(tx)}|${day}`;
    const list = byAccountDay.get(key) ?? [];
    list.push(tx);
    byAccountDay.set(key, list);
  }

  const out: RawPair[] = [];
  const seen = new Set<string>();

  for (const list of byAccountDay.values()) {
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (!sameCalendarDay(a.datum, b.datum)) continue;
        if (sign(a.betrag) !== sign(b.betrag)) continue;
        if (Math.abs(a.betrag - b.betrag) > AMOUNT_TOLERANCE) continue;

        const overlap = wordOverlap(a, b);
        if (overlap < NEAR_DUP_WORD_OVERLAP) continue;

        const key = pairKey(a.id, b.id);
        if (seen.has(key)) continue;
        seen.add(key);

        const pct = Math.round(overlap * 100);
        out.push({
          a,
          b,
          type: "near_duplicate",
          score: clamp01(overlap),
          reason: `Gleiches Konto/Tag/Betrag, ${pct}% Textähnlichkeit`,
        });
      }
    }
  }

  return out;
}

export function mergeAndRank(
  rawPairs: RawPair[],
  rejectedKeys: Set<string>,
): { suggestions: RelatedSuggestion[]; truncated: boolean } {
  const bestByKey = new Map<string, RawPair>();

  for (const pair of rawPairs) {
    const key = pairKey(pair.a.id, pair.b.id);
    if (rejectedKeys.has(key)) continue;

    const prev = bestByKey.get(key);
    if (!prev || preferPair(pair, prev)) {
      bestByKey.set(key, pair);
    }
  }

  const ranked = [...bestByKey.values()].sort((x, y) => {
    if (y.score !== x.score) return y.score - x.score;
    return TYPE_PRIORITY[y.type] - TYPE_PRIORITY[x.type];
  });
  const used = new Set<number>();
  const suggestions: RelatedSuggestion[] = [];

  for (const pair of ranked) {
    if (used.has(pair.a.id) || used.has(pair.b.id)) continue;
    used.add(pair.a.id);
    used.add(pair.b.id);
    suggestions.push({
      pairKey: pairKey(pair.a.id, pair.b.id),
      type: pair.type,
      score: Math.round(pair.score * 1000) / 1000,
      reason: pair.reason,
      a: toPublic(pair.a),
      b: toPublic(pair.b),
    });
  }

  const truncated = suggestions.length > SUGGESTION_CAP;
  return {
    suggestions: suggestions.slice(0, SUGGESTION_CAP),
    truncated,
  };
}

/** Full pipeline: PayPal↔bank, Umbuchung, near-duplicate. */
export function runDetectPipeline(
  candidates: DetectCandidate[],
  rejectedKeys: Set<string>,
): { suggestions: RelatedSuggestion[]; truncated: boolean } {
  const raw = [
    ...detectPaypalBank(candidates),
    ...detectTransfers(candidates),
    ...detectNearDuplicates(candidates),
  ];
  return mergeAndRank(raw, rejectedKeys);
}
