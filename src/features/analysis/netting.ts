import type { RelatedType } from "../related/types";

export type NettedTx = {
  id: number;
  datum: Date;
  betrag: number;
  bank: string;
  relatedTransactionId: number | null;
  relatedType: RelatedType | null;
};

/**
 * Drop ids that should not count in Analyse aggregates when both legs
 * of a confirmed pair are present in `rows`.
 */
export function idsToDropForNetting(rows: NettedTx[]): Set<number> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const drop = new Set<number>();
  const seenPairs = new Set<string>();

  for (const row of rows) {
    if (row.relatedTransactionId == null || row.relatedType == null) continue;
    const partner = byId.get(row.relatedTransactionId);
    if (!partner) continue;

    const key =
      row.id < partner.id
        ? `${row.id}:${partner.id}`
        : `${partner.id}:${row.id}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);

    if (row.relatedType === "transfer") {
      drop.add(row.id);
      drop.add(partner.id);
      continue;
    }

    if (row.relatedType === "paypal_bank") {
      const keep = pickPaypalBankKeep(row, partner);
      const other = keep.id === row.id ? partner : row;
      drop.add(other.id);
    }
  }

  return drop;
}

function pickPaypalBankKeep(a: NettedTx, b: NettedTx): NettedTx {
  if (a.bank.toLowerCase() === "paypal") return a;
  if (b.bank.toLowerCase() === "paypal") return b;
  if (a.datum.getTime() !== b.datum.getTime()) {
    return a.datum.getTime() < b.datum.getTime() ? a : b;
  }
  return a.id < b.id ? a : b;
}

export function summarizeNetted(rows: NettedTx[]): {
  income: number;
  expense: number;
  count: number;
} {
  const drop = idsToDropForNetting(rows);
  let income = 0;
  let expense = 0;
  let count = 0;

  for (const row of rows) {
    if (drop.has(row.id)) continue;
    count += 1;
    if (row.betrag > 0) income += row.betrag;
    else if (row.betrag < 0) expense += Math.abs(row.betrag);
  }

  return { income, expense, count };
}
