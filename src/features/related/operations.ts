import { randomUUID } from "node:crypto";
import { HttpError } from "wasp/server";
import type {
  ConfirmRelatedPair,
  DetectRelatedTransactions,
  RejectRelatedPair,
  SearchRelatedLinkCandidates,
  UnlinkRelatedPair,
} from "wasp/server/operations";
import { runDetectPipeline } from "./detect";
import type {
  ConfirmRelatedArgs,
  DetectCandidate,
  DetectRelatedResult,
  RejectRelatedArgs,
  RelatedTxPublic,
  RelatedType,
  SearchRelatedLinkArgs,
  UnlinkRelatedArgs,
} from "./types";

export type {
  ConfirmRelatedArgs,
  DetectRelatedResult,
  RejectRelatedArgs,
  RelatedSuggestion,
  RelatedType,
  RelatedTxPublic,
  SearchRelatedLinkArgs,
  UnlinkRelatedArgs,
} from "./types";
export {
  matchesPaypalPurchase,
  suggestRelatedType,
  suggestRelatedTypeForGroup,
} from "./suggestType";

function allPairIds(ids: number[]): { low: number; high: number }[] {
  const sorted = [...ids].sort((a, b) => a - b);
  const pairs: { low: number; high: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push({ low: sorted[i]!, high: sorted[j]! });
    }
  }
  return pairs;
}

const RELATED_TYPES: RelatedType[] = [
  "paypal_bank",
  "paypal_purchase",
  "transfer",
  "near_duplicate",
];

function parseRelatedType(raw: string): RelatedType {
  if ((RELATED_TYPES as string[]).includes(raw)) {
    return raw as RelatedType;
  }
  throw new HttpError(400, `Ungültiger Verknüpfungstyp: ${raw}`);
}

function parseGroupIds(raw: number[] | undefined): number[] {
  if (!raw || !Array.isArray(raw)) {
    throw new HttpError(400, "ids sind erforderlich.");
  }
  const ids = [...new Set(raw.map(Number))].filter((n) => Number.isFinite(n));
  if (ids.length !== 2 && ids.length !== 3) {
    throw new HttpError(400, "Genau 2 oder 3 Transaktionen verknüpfen.");
  }
  if (ids.length !== raw.length) {
    throw new HttpError(400, "Doppelte oder ungültige Ids.");
  }
  return ids;
}

export const detectRelatedTransactions: DetectRelatedTransactions<
  void,
  DetectRelatedResult
> = async (_args, context) => {
  const [rows, rejects] = await Promise.all([
    context.entities.Transaction.findMany({
      where: {
        relatedTransactionId: null,
        relatedGroupId: null,
      },
      select: {
        id: true,
        datum: true,
        betrag: true,
        sender: true,
        empfaenger: true,
        verwendungszweck: true,
        bank: true,
        konto: true,
      },
      orderBy: [{ datum: "asc" }, { id: "asc" }],
    }),
    context.entities.RelatedRejection.findMany({
      select: { txIdLow: true, txIdHigh: true },
    }),
  ]);

  const candidates: DetectCandidate[] = rows.map((r) => ({
    id: r.id,
    datum: r.datum,
    betrag: Number(r.betrag.toString()),
    sender: r.sender,
    empfaenger: r.empfaenger,
    verwendungszweck: r.verwendungszweck,
    bank: r.bank,
    konto: r.konto,
  }));

  const rejectedKeys = new Set(
    rejects.map((r) => `${r.txIdLow}:${r.txIdHigh}`),
  );

  return runDetectPipeline(candidates, rejectedKeys);
};

export const confirmRelatedPair: ConfirmRelatedPair<
  ConfirmRelatedArgs,
  { ok: true }
> = async (args, context) => {
  if (!args?.type) {
    throw new HttpError(400, "type ist erforderlich.");
  }
  const ids = parseGroupIds(args.ids);
  const type = parseRelatedType(args.type);

  if (type === "paypal_purchase" && ids.length !== 3) {
    throw new HttpError(
      400,
      "PayPal-Kauf braucht genau drei Buchungen.",
    );
  }

  const rows = await context.entities.Transaction.findMany({
    where: { id: { in: ids } },
  });
  if (rows.length !== ids.length) {
    throw new HttpError(404, "Transaktion nicht gefunden.");
  }

  for (const row of rows) {
    if (row.relatedTransactionId != null || row.relatedGroupId != null) {
      throw new HttpError(409, "Eine der Transaktionen ist bereits verknüpft.");
    }
  }

  const groupId = randomUUID();

  if (ids.length === 2) {
    const [aId, bId] = ids;
    await context.entities.Transaction.update({
      where: { id: aId },
      data: {
        relatedTransactionId: bId,
        relatedGroupId: groupId,
        relatedType: type,
      },
    });
    await context.entities.Transaction.update({
      where: { id: bId },
      data: {
        relatedTransactionId: aId,
        relatedGroupId: groupId,
        relatedType: type,
      },
    });
  } else {
    await context.entities.Transaction.updateMany({
      where: { id: { in: ids } },
      data: {
        relatedGroupId: groupId,
        relatedType: type,
        relatedTransactionId: null,
      },
    });
  }

  for (const pair of allPairIds(ids)) {
    await context.entities.RelatedRejection.deleteMany({
      where: { txIdLow: pair.low, txIdHigh: pair.high },
    });
  }

  // Share strongest category across the group.
  const sourceRank: Record<string, number> = {
    manual: 4,
    learned: 3,
    keyword: 2,
    none: 1,
  };
  const categorized = rows.filter(
    (r) => r.categoryId != null && r.subcategoryId != null,
  );
  if (categorized.length > 0) {
    categorized.sort((a, b) => {
      const ra = sourceRank[a.categorySource] ?? 0;
      const rb = sourceRank[b.categorySource] ?? 0;
      if (rb !== ra) return rb - ra;
      return a.id - b.id;
    });
    const best = categorized[0]!;
    await context.entities.Transaction.updateMany({
      where: { id: { in: ids } },
      data: {
        categoryId: best.categoryId,
        subcategoryId: best.subcategoryId,
        categorySource: best.categorySource,
        confidenceScore: best.confidenceScore,
      },
    });
  }

  return { ok: true };
};

export const rejectRelatedPair: RejectRelatedPair<
  RejectRelatedArgs,
  { ok: true }
> = async (args, context) => {
  const ids = parseGroupIds(args?.ids);
  for (const pair of allPairIds(ids)) {
    await context.entities.RelatedRejection.upsert({
      where: {
        txIdLow_txIdHigh: { txIdLow: pair.low, txIdHigh: pair.high },
      },
      create: { txIdLow: pair.low, txIdHigh: pair.high },
      update: {},
    });
  }
  return { ok: true };
};

/** Clear entire related group from Details; also reject member pairs. */
export const unlinkRelatedPair: UnlinkRelatedPair<
  UnlinkRelatedArgs,
  { ok: true }
> = async (args, context) => {
  if (!args?.transactionId) {
    throw new HttpError(400, "transactionId ist erforderlich.");
  }

  const tx = await context.entities.Transaction.findUnique({
    where: { id: args.transactionId },
    select: {
      id: true,
      relatedTransactionId: true,
      relatedGroupId: true,
    },
  });
  if (!tx) throw new HttpError(404, "Transaktion nicht gefunden.");
  if (tx.relatedTransactionId == null && tx.relatedGroupId == null) {
    throw new HttpError(400, "Transaktion ist nicht verknüpft.");
  }

  let memberIds: number[] = [tx.id];
  if (tx.relatedGroupId != null) {
    const members = await context.entities.Transaction.findMany({
      where: { relatedGroupId: tx.relatedGroupId },
      select: { id: true },
    });
    memberIds = members.map((m) => m.id);
  } else if (tx.relatedTransactionId != null) {
    memberIds = [tx.id, tx.relatedTransactionId];
  }

  await context.entities.Transaction.updateMany({
    where: { id: { in: memberIds } },
    data: {
      relatedTransactionId: null,
      relatedGroupId: null,
      relatedType: null,
    },
  });

  for (const pair of allPairIds(memberIds)) {
    await context.entities.RelatedRejection.upsert({
      where: {
        txIdLow_txIdHigh: { txIdLow: pair.low, txIdHigh: pair.high },
      },
      create: { txIdLow: pair.low, txIdHigh: pair.high },
      update: {},
    });
  }

  return { ok: true };
};

function toPublicCandidate(r: {
  id: number;
  datum: Date;
  betrag: { toString(): string };
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
  bank: string;
  konto: string;
}): RelatedTxPublic {
  return {
    id: r.id,
    datum: r.datum.toISOString().slice(0, 10),
    betrag: r.betrag.toString(),
    sender: r.sender,
    empfaenger: r.empfaenger,
    verwendungszweck: r.verwendungszweck,
    bank: r.bank,
    konto: r.konto,
  };
}

/** Manual link picker: only show candidates within this many days of the anchor tx. */
export const MANUAL_LINK_DATE_WINDOW_DAYS = 10;

function parseAroundDate(raw: string | undefined): Date {
  const m = raw?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new HttpError(400, "aroundDate (YYYY-MM-DD) ist erforderlich.");
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function addUtcDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Unlinked candidates for manual link picker in Details (±10 days). */
export const searchRelatedLinkCandidates: SearchRelatedLinkCandidates<
  SearchRelatedLinkArgs,
  RelatedTxPublic[]
> = async (args, context) => {
  const excludeIds = [...new Set((args?.excludeIds ?? []).map(Number))].filter(
    (n) => Number.isFinite(n),
  );
  if (excludeIds.length === 0) {
    throw new HttpError(400, "excludeIds ist erforderlich.");
  }
  const around = parseAroundDate(args.aroundDate);
  const dateFrom = addUtcDays(around, -MANUAL_LINK_DATE_WINDOW_DAYS);
  const dateTo = addUtcDays(around, MANUAL_LINK_DATE_WINDOW_DAYS);
  const limit = Math.min(Math.max(args.limit ?? 40, 1), 80);
  const search = args.search?.trim() ?? "";

  const base = {
    relatedTransactionId: null,
    relatedGroupId: null,
    isBalanceAdjustment: false,
    id: { notIn: excludeIds },
    datum: { gte: dateFrom, lte: dateTo },
  };

  const idExact = /^\d+$/.test(search) ? Number(search) : null;

  const rows = await context.entities.Transaction.findMany({
    where:
      search.length === 0
        ? base
        : {
            AND: [
              base,
              {
                OR: [
                  ...(idExact != null ? [{ id: idExact }] : []),
                  {
                    verwendungszweck: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    sender: { contains: search, mode: "insensitive" as const },
                  },
                  {
                    empfaenger: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                  { bank: { contains: search, mode: "insensitive" as const } },
                  { konto: { contains: search, mode: "insensitive" as const } },
                ],
              },
            ],
          },
    orderBy: [{ datum: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      datum: true,
      betrag: true,
      sender: true,
      empfaenger: true,
      verwendungszweck: true,
      bank: true,
      konto: true,
    },
  });

  return rows.map(toPublicCandidate);
};
